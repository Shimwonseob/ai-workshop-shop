import bcrypt from "bcryptjs";
const CATEGORIES = [
  "\uAC04\uD3B8\uC2DD",
  "\uBCA0\uC774\uCEE4\uB9AC",
  "\uC2E0\uC120\uC2DD\uD488",
  "\uBC18\uCC2C",
];
const SESSION_COOKIE = "shop_session";
const SHIPPING_THRESHOLD = 30000;
const SHIPPING_FEE = 3000;

export default { async fetch(request, env) { const url = new URL(request.url); try { return url.pathname.startsWith("/api/") ? await handleApi(request, env, url) : env.ASSETS.fetch(request); } catch (error) { console.error(error); return json({ error: "????癲????????븐뼐???????????癲ル슢??룸퀬苑???? ????븐뼐???????????????????" }, 500); } } };

async function handleApi(request, env, url) {
  const method = request.method;
  if (url.pathname === "/api/auth/signup" && method === "POST") return signup(request, env, url);
  if (url.pathname === "/api/auth/login" && method === "POST") return login(request, env, url);
  if (url.pathname === "/api/auth/logout" && method === "POST") return logout(request, env, url);
  if (url.pathname === "/api/auth/me" && method === "GET") return me(request, env);
  if (url.pathname === "/api/ai/product-intro" && method === "POST") return productIntro(request, env);
  if (url.pathname === "/api/payments/config" && method === "GET") return paymentConfig(env);
  const protectedSession = await requireAuth(request, env);
  if (method === "GET" && url.pathname === "/api/orders") { if (!protectedSession) return json({ error: "login required" }, 401); const { results } = await env.DB.prepare("SELECT id, subtotal, discount_total, shipping_fee, total, status, payment_method, paid_at, created_at FROM orders WHERE session_id = ? ORDER BY created_at DESC").bind(protectedSession.id).all(); return json({ orders: results }); }
  if (method === "POST" && url.pathname === "/api/payments/confirm") { if (!protectedSession) return json({ error: "login required" }, 401); return confirmPayment(request, env, protectedSession); }
  if (method === "POST" && url.pathname === "/api/orders") { if (!protectedSession) return json({ error: "login required" }, 401); return createOrder(request, env, protectedSession); }
  if (!protectedSession && (url.pathname.startsWith("/api/cart") || url.pathname.startsWith("/api/orders"))) return json({ error: "?棺??짆??嶺뚮ㅎ?닻???ш끽維???筌뤾퍓???" }, 401); const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/); const cartItemMatch = url.pathname.match(/^\/api\/cart\/(\d+)$/); const orderMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)$/i);
  if (method === "GET" && url.pathname === "/api/categories") { const { results } = await env.DB.prepare("SELECT c.name AS category, COUNT(p.id) AS count FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1 WHERE c.is_active = 1 GROUP BY c.id, c.name ORDER BY c.sort_order").all(); return json({ categories: CATEGORIES.map((name) => ({ name, count: results.find((x) => x.category === name)?.count || 0 })) }); }
  if (method === "GET" && url.pathname === "/api/products") { const category = url.searchParams.get("category") || ""; const query = (url.searchParams.get("query") || "").trim().slice(0, 80); const sort = url.searchParams.get("sort") || "recommended"; if (category && !CATEGORIES.includes(category)) return json({ error: "?????????? ??? ?????筌뤾퍓愿???????釉랁닑???????????????癲?筌??" }, 400); const order = { recommended: "sales_rank ASC, id ASC", new: "is_new DESC, id DESC", sales: "sales_rank ASC, id ASC", price: "sale_price ASC, id ASC" }[sort] || "sales_rank ASC, id ASC"; const clauses = ["p.is_active = 1"]; const binds = []; if (category) { clauses.push("c.name = ?"); binds.push(category); } if (query) { clauses.push("(name LIKE ? OR short_description LIKE ? OR description LIKE ?)"); binds.push(`%${query}%`, `%${query}%`, `%${query}%`); } const { results } = await env.DB.prepare(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${clauses.join(" AND ")} ORDER BY ${order}`).bind(...binds).all(); return json({ products: results, count: results.length }); }
  if (method === "GET" && productMatch) { const product = await env.DB.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").bind(Number(productMatch[1])).first(); return product ? json({ product }) : json({ error: "???????⑥ル츧癲???????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404); }
  if (!url.pathname.startsWith("/api/cart") && !url.pathname.startsWith("/api/orders")) return json({ error: "????癲?????癲됱빖???嶺??????????????寃몃탿???????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404);
  const session = protectedSession || await ensureSession(request, env); const headers = session.created ? { "Set-Cookie": makeSessionCookie(session.id, url) } : {};
  if (method === "GET" && url.pathname === "/api/cart") return json(await readCart(env, session.id), 200, headers);
  if (method === "POST" && url.pathname === "/api/cart") { const body = await readJson(request); const productId = toPositiveInteger(body.productId); const qty = toQuantity(body.qty); if (!productId || !qty) return json({ error: "???????⑥ル츧癲?????????????遺얘턁?????????????????獄쏅챷??????????" }, 400, headers); const product = await env.DB.prepare("SELECT id FROM products WHERE id = ? AND is_active = 1").bind(productId).first(); if (!product) return json({ error: "???????⑥ル츧癲???????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404, headers); await env.DB.prepare(`INSERT INTO cart_items (session_id, product_id, qty) VALUES (?, ?, ?) ON CONFLICT(session_id, product_id) DO UPDATE SET qty = MIN(99, cart_items.qty + excluded.qty)`).bind(session.id, productId, qty).run(); return json(await readCart(env, session.id), 200, headers); }
  if (method === "PATCH" && cartItemMatch) { const qty = toQuantity((await readJson(request)).qty); if (!qty) return json({ error: "??????? 1~99???????ル?????????????⑤챷竊?" }, 400, headers); const result = await env.DB.prepare("UPDATE cart_items SET qty = ? WHERE id = ? AND session_id = ?").bind(qty, Number(cartItemMatch[1]), session.id).run(); return result.meta.changes ? json(await readCart(env, session.id), 200, headers) : json({ error: "?????蹂㏓?????????????????????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404, headers); }
  if (method === "DELETE" && cartItemMatch) { const result = await env.DB.prepare("DELETE FROM cart_items WHERE id = ? AND session_id = ?").bind(Number(cartItemMatch[1]), session.id).run(); return result.meta.changes ? json(await readCart(env, session.id), 200, headers) : json({ error: "?????蹂㏓?????????????????????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404, headers); }
  if (method === "POST" && url.pathname === "/api/orders") { const body = await readJson(request); const selected = Array.isArray(body.itemIds) && body.itemIds.length ? body.itemIds.map(Number).filter(Number.isInteger) : null; const cart = await readCart(env, session.id, selected); if (!cart.items.length) return json({ error: "????傭?끆??????????????蹂㏓???????????????????⑥ル츧癲?????????濚밸Ŧ援???????????⑤챷竊?" }, 400, headers); const orderId = crypto.randomUUID(); const statements = [env.DB.prepare("INSERT INTO orders (id, session_id, subtotal, discount_total, shipping_fee, total, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')").bind(orderId, session.id, cart.subtotal, cart.discountTotal, cart.shippingFee, cart.total), ...cart.items.map((item) => env.DB.prepare("INSERT INTO order_items (order_id, product_id, product_name, qty, price, original_price) VALUES (?, ?, ?, ?, ?, ?)").bind(orderId, item.product_id, item.name || "???????????닿틢???????됰슣類?", item.qty, item.sale_price, item.original_price)), env.DB.prepare(`DELETE FROM cart_items WHERE session_id = ?${selected ? ` AND id IN (${selected.map(() => "?").join(",")})` : ""}`).bind(session.id, ...(selected || []))]; await env.DB.batch(statements); return json({ orderId }, 201, headers); }
  if (method === "GET" && orderMatch) { const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ? AND session_id = ?").bind(orderMatch[1], session.id).first(); if (!order) return json({ error: "??????獄쏅챷???饔낅떽??????怨몃뮡???????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404, headers); const { results: items } = await env.DB.prepare("SELECT oi.product_id, oi.product_name, oi.qty, oi.price, oi.original_price, COALESCE(p.name, '?????????????源낅펰?????????⑥ル츧癲?') AS name, COALESCE(p.image_url, '') AS image_url FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id").bind(order.id).all(); return json({ order: { ...order, items } }, 200, headers); }
  return json({ error: "????癲?????癲됱빖???嶺??????????????寃몃탿???????븐뼐?????????????????濚밸Ŧ援???????????⑤챷竊?" }, 404, headers);
}
async function ensureSession(request, env) { const candidate = parseCookies(request.headers.get("Cookie") || "")[SESSION_COOKIE]; const valid = candidate && /^[0-9a-f-]{36}$/i.test(candidate); const id = valid ? candidate : crypto.randomUUID(); const existing = valid ? await env.DB.prepare("SELECT id FROM guest_sessions WHERE id = ?").bind(id).first() : null; if (!existing) await env.DB.prepare("INSERT OR IGNORE INTO guest_sessions (id) VALUES (?)").bind(id).run(); return { id, created: !existing }; }
async function readCart(env, sessionId, selectedIds = null) { const where = ["ci.session_id = ?"]; const binds = [sessionId]; if (selectedIds) { if (!selectedIds.length) return emptyCart(); where.push(`ci.id IN (${selectedIds.map(() => "?").join(",")})`); binds.push(...selectedIds); } const { results: items } = await env.DB.prepare(`SELECT ci.id, ci.product_id, ci.qty, p.name, p.image_url, p.original_price, p.sale_price, p.discount_rate, p.coupon_label, CASE WHEN p.id IS NULL OR p.is_active = 0 THEN 1 ELSE 0 END AS unavailable FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ${where.join(" AND ")} ORDER BY ci.id`).bind(...binds).all(); const available = items.filter(x => !x.unavailable); const originalSubtotal = available.reduce((s, x) => s + x.original_price * x.qty, 0); const subtotal = available.reduce((s, x) => s + x.sale_price * x.qty, 0); const discountTotal = originalSubtotal - subtotal; const shippingFee = subtotal && subtotal < SHIPPING_THRESHOLD ? SHIPPING_FEE : 0; return { items, itemCount: items.reduce((s, x) => s + x.qty, 0), originalSubtotal, subtotal, discountTotal, shippingFee, total: subtotal + shippingFee }; }
function emptyCart() { return { items: [], itemCount: 0, originalSubtotal: 0, subtotal: 0, discountTotal: 0, shippingFee: 0, total: 0 }; }
function parseCookies(header) { return Object.fromEntries(header.split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf("="); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]; })); }
function makeSessionCookie(id, url) { return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`; }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function toPositiveInteger(v) { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; }
function toQuantity(v) { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null; }
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extra } }); }












async function requireAuth(request,env){const c=parseCookies(request.headers.get("Cookie")||"");const id=c[SESSION_COOKIE];if(!id)return null;return env.DB.prepare("SELECT gs.id,gs.user_id,u.email,u.name FROM guest_sessions gs JOIN users u ON u.id=gs.user_id WHERE gs.id=?").bind(id).first()}
async function signup(request,env,url){const b=await readJson(request),email=String(b.email||"").trim().toLowerCase(),password=String(b.password||""),name=String(b.name||"").trim();if(!email||password.length<8||!name)return json({error:"????곸죷??좊즴????嶺뚮Ĳ?됮????낆뒩??뗫빝??"},400);try{const h=await bcrypt.hash(password,12);await env.DB.prepare("INSERT INTO users(email,password_hash,name) VALUES(?,?,?)").bind(email,h,name).run()}catch{return json({error:"???? ??좊읈?????놁땍 ???嶺??繹먮끏?????덊렡."},409)}return loginWithUser(env,url,email)}
async function login(request,env,url){const b=await readJson(request),u=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(String(b.email||"").trim().toLowerCase()).first();if(!u||!(await bcrypt.compare(String(b.password||""),u.password_hash)))return json({error:"?嶺뚮ㅎ?댐ℓ?????됰꽡"},401);return loginWithUser(env,url,u.email)}
async function loginWithUser(env,url,email){const u=await env.DB.prepare("SELECT id,email,name FROM users WHERE email=?").bind(email).first(),sid=crypto.randomUUID();await env.DB.prepare("INSERT INTO guest_sessions(id,user_id) VALUES(?,?)").bind(sid,u.id).run();return json({user:u},200,{"Set-Cookie":makeSessionCookie(sid,url)})}
async function logout(request,env){const c=parseCookies(request.headers.get("Cookie")||"");if(c[SESSION_COOKIE])await env.DB.prepare("DELETE FROM guest_sessions WHERE id=?").bind(c[SESSION_COOKIE]).run();return json({ok:true})}
async function me(request,env){const s=await requireAuth(request,env);return s?json({user:{id:s.user_id,email:s.email,name:s.name}}):json({user:null})}

function paymentConfig(env) {
  if (!env.TOSS_CLIENT_KEY) return json({ error: "Toss client key is not configured" }, 503);
  return json({ clientKey: env.TOSS_CLIENT_KEY });
}

async function createOrder(request, env, session) {
  const body = await readJson(request);
  const selected = Array.isArray(body.itemIds) && body.itemIds.length ? body.itemIds.map(Number).filter(Number.isInteger) : null;
  const cart = await readCart(env, session.id, selected);
  if (!cart.items.some(item => !item.unavailable)) return json({ error: "cart is empty" }, 400);
  const pending = await env.DB.prepare("SELECT id, total FROM orders WHERE session_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").bind(session.id).first();
  if (pending) return json({ orderId: pending.id, amount: pending.total, reused: true }, 200);
  const orderId = crypto.randomUUID();
  const available = cart.items.filter(item => !item.unavailable);
  const statements = [env.DB.prepare("INSERT INTO orders (id, session_id, subtotal, discount_total, shipping_fee, total, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')").bind(orderId, session.id, cart.subtotal, cart.discountTotal, cart.shippingFee, cart.total), ...available.map(item => env.DB.prepare("INSERT INTO order_items (order_id, product_id, product_name, qty, price, original_price) VALUES (?, ?, ?, ?, ?, ?)").bind(orderId, item.product_id, item.name, item.qty, item.sale_price, item.original_price))];
  await env.DB.batch(statements);
  return json({ orderId, amount: cart.total }, 201);
}

async function productIntro(request, env) {
  if (!env.AI) return json({ error: "AI is not configured" }, 503);
  const body = await readJson(request);
  const id = toPositiveInteger(body.productId);
  if (!id) return json({ error: "invalid product" }, 400);
  const product = await env.DB.prepare("SELECT name, short_description, description FROM products WHERE id = ? AND is_active = 1").bind(id).first();
  if (!product) return json({ error: "product not found" }, 404);
  const prompt = `Translate the supplied product name and descriptions into a calm, factual English introduction. Return only the introduction itself as exactly two or three complete sentences of plain prose. Never output the product name on its own. Do not include headings, labels, notes, prefixes, or field names such as Translated, Translation, English, Introduction, Product name, Short description, Description, or Note. Do not infer or add any adjective, adverb, cuisine, origin, ingredients, certifications, health claims, quantities, quality claims, taste, aroma, texture, or marketing phrase. Use only direct facts explicitly present in the supplied text. Do not repeat a sentence or noun phrase. Product name: ${product.name}\nShort description: ${product.short_description || ""}\nDescription: ${product.description || ""}`;
  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", { prompt, max_tokens: 180, temperature: 0, top_p: 0.1 });
  let text = String(result?.response || result || "").replace(/\s+/g, " ").trim();
  text = text.replace(/(?:^|\s)(?:Translated|Translation|English(?:\s+Introduction)?|Introduction|Product name|Short description|Description|Note)\s*:?\s*(?=[A-Z])/gi, " ").trim();
  const candidates = (text.match(/[^.!?]+[.!?]+/g) || [])
    .filter((sentence) => /[A-Za-z]/.test(sentence) && !/[가-힣]/.test(sentence))
    .map((sentence) => sentence.trim())
    .filter((sentence) => !/[\uAC00-\uD7AF]/.test(sentence));
  const unique = [];
  for (const sentence of candidates) {
    const words = new Set(sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
    const duplicate = unique.some((previous) => {
      const priorWords = new Set(previous.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
      const overlap = [...words].filter((word) => priorWords.has(word)).length;
      return overlap / Math.max(1, Math.min(words.size, priorWords.size)) >= 0.8;
    });
    if (!duplicate) unique.push(sentence);
    if (unique.length === 3) break;
  }
  if (unique.length < 2) return json({ error: "AI returned too few sentences" }, 502);
  return json({ intro: unique.join(" ") });
}

async function confirmPayment(request, env, session) {
  const body = await readJson(request);
  const orderId = String(body.orderId || "");
  const paymentKey = String(body.paymentKey || "");
  const amount = Number(body.amount);
  if (!orderId || !paymentKey || !Number.isInteger(amount) || amount < 0) return json({ error: "invalid payment" }, 400);
  const order = await env.DB.prepare("SELECT id, total, status FROM orders WHERE id = ? AND session_id = ?").bind(orderId, session.id).first();
  if (!order) return json({ error: "order not found" }, 404);
  if (order.status === "paid") return json({ ok: true, orderId, status: "paid" });
  if (order.status !== "pending") return json({ error: "order is not payable" }, 409);
  if (amount !== order.total) return json({ error: "amount mismatch" }, 400);
  if (!env.TOSS_SECRET_KEY) return json({ error: "Toss secret key is not configured" }, 503);
  const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(`${env.TOSS_SECRET_KEY}:`)}`, "Content-Type": "application/json", "Idempotency-Key": orderId },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossData = await tossResponse.json();
  if (!tossResponse.ok) return json({ error: tossData.message || "payment approval failed", code: tossData.code }, tossResponse.status);
  const method = typeof tossData.method === "string" ? tossData.method : null;
  const updated = await env.DB.prepare("UPDATE orders SET status = 'paid', payment_key = ?, payment_method = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ? AND session_id = ? AND status = 'pending'").bind(paymentKey, method, orderId, session.id).run();
  if (!updated.meta.changes) return json({ ok: true, orderId, status: "paid" });
  await env.DB.prepare("DELETE FROM cart_items WHERE session_id = ? AND product_id IN (SELECT product_id FROM order_items WHERE order_id = ?)").bind(session.id, orderId).run();
  return json({ ok: true, orderId, status: "paid" });
}
