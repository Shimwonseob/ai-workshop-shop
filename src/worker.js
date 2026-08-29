const CATEGORIES = new Set(["잡화", "뷰티", "신발", "식품"]);
const SESSION_COOKIE = "shop_session";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: "요청을 처리하지 못했습니다." }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const method = request.method;
  const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
  const cartItemMatch = url.pathname.match(/^\/api\/cart\/(\d+)$/);
  const orderMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]+)$/i);

  if (method === "GET" && url.pathname === "/api/products") {
    const category = url.searchParams.get("category");
    if (category && !CATEGORIES.has(category)) {
      return json({ error: "올바르지 않은 분류입니다." }, 400);
    }

    const statement = category
      ? env.DB.prepare("SELECT * FROM products WHERE category = ? ORDER BY id").bind(category)
      : env.DB.prepare("SELECT * FROM products ORDER BY id");
    const { results } = await statement.all();
    return json({ products: results });
  }

  if (method === "GET" && productMatch) {
    const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?")
      .bind(Number(productMatch[1]))
      .first();
    return product ? json({ product }) : json({ error: "상품을 찾을 수 없습니다." }, 404);
  }

  if (url.pathname === "/api/cart" || cartItemMatch || url.pathname === "/api/orders" || orderMatch) {
    const session = await ensureSession(request, env);
    const headers = session.created ? { "Set-Cookie": makeSessionCookie(session.id, url) } : {};

    if (method === "GET" && url.pathname === "/api/cart") {
      const cart = await readCart(env, session.id);
      return json(cart, 200, headers);
    }

    if (method === "POST" && url.pathname === "/api/cart") {
      const body = await readJson(request);
      const productId = toPositiveInteger(body.productId);
      const qty = toQuantity(body.qty);
      if (!productId || !qty) return json({ error: "상품과 수량을 확인해주세요." }, 400, headers);

      const product = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(productId).first();
      if (!product) return json({ error: "상품을 찾을 수 없습니다." }, 404, headers);

      await env.DB.prepare(
        `INSERT INTO cart_items (session_id, product_id, qty) VALUES (?, ?, ?)
         ON CONFLICT(session_id, product_id)
         DO UPDATE SET qty = MIN(99, cart_items.qty + excluded.qty)`,
      ).bind(session.id, productId, qty).run();
      return json(await readCart(env, session.id), 200, headers);
    }

    if (method === "PATCH" && cartItemMatch) {
      const body = await readJson(request);
      const qty = toQuantity(body.qty);
      if (!qty) return json({ error: "수량은 1부터 99까지 입력해주세요." }, 400, headers);

      const result = await env.DB.prepare("UPDATE cart_items SET qty = ? WHERE id = ? AND session_id = ?")
        .bind(qty, Number(cartItemMatch[1]), session.id)
        .run();
      if (!result.meta.changes) return json({ error: "장바구니 항목을 찾을 수 없습니다." }, 404, headers);
      return json(await readCart(env, session.id), 200, headers);
    }

    if (method === "DELETE" && cartItemMatch) {
      const result = await env.DB.prepare("DELETE FROM cart_items WHERE id = ? AND session_id = ?")
        .bind(Number(cartItemMatch[1]), session.id)
        .run();
      if (!result.meta.changes) return json({ error: "장바구니 항목을 찾을 수 없습니다." }, 404, headers);
      return json(await readCart(env, session.id), 200, headers);
    }

    if (method === "POST" && url.pathname === "/api/orders") {
      const cart = await readCart(env, session.id);
      if (!cart.items.length) return json({ error: "장바구니가 비어 있습니다." }, 400, headers);

      const orderId = crypto.randomUUID();
      const statements = [
        env.DB.prepare("INSERT INTO orders (id, session_id, total, status) VALUES (?, ?, ?, 'pending')")
          .bind(orderId, session.id, cart.total),
        ...cart.items.map((item) =>
          env.DB.prepare("INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)")
            .bind(orderId, item.product_id, item.qty, item.price),
        ),
        env.DB.prepare("DELETE FROM cart_items WHERE session_id = ?").bind(session.id),
      ];
      await env.DB.batch(statements);
      return json({ orderId }, 201, headers);
    }

    if (method === "GET" && orderMatch) {
      const order = await env.DB.prepare(
        "SELECT id, total, status, created_at FROM orders WHERE id = ? AND session_id = ?",
      ).bind(orderMatch[1], session.id).first();
      if (!order) return json({ error: "주문을 찾을 수 없습니다." }, 404, headers);

      const { results: items } = await env.DB.prepare(
        `SELECT oi.product_id, oi.qty, oi.price, p.name, p.image_url
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ? ORDER BY oi.id`,
      ).bind(order.id).all();
      return json({ order: { ...order, items } }, 200, headers);
    }
  }

  return json({ error: "요청한 경로를 찾을 수 없습니다." }, 404);
}

async function ensureSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const candidate = cookies[SESSION_COOKIE];
  const valid = candidate && /^[0-9a-f-]{36}$/i.test(candidate);
  const id = valid ? candidate : crypto.randomUUID();
  const existing = valid
    ? await env.DB.prepare("SELECT id FROM guest_sessions WHERE id = ?").bind(id).first()
    : null;

  if (!existing) {
    await env.DB.prepare("INSERT OR IGNORE INTO guest_sessions (id) VALUES (?)").bind(id).run();
  }
  return { id, created: !existing };
}

async function readCart(env, sessionId) {
  const { results: items } = await env.DB.prepare(
    `SELECT ci.id, ci.product_id, ci.qty, p.name, p.price, p.image_url
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.session_id = ? ORDER BY ci.id`,
  ).bind(sessionId).all();
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { items, total };
}

function parseCookies(header) {
  return Object.fromEntries(
    header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }),
  );
}

function makeSessionCookie(id, url) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function toQuantity(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 99 ? number : null;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

