const app = document.querySelector("#app");
const cartCount = document.querySelector("#cart-count");

document.addEventListener("click", async (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute("href"));
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  const type = action.dataset.action;
  if (type === "add-card") await addToCart(Number(action.dataset.productId), 1);
  if (type === "detail-minus" || type === "detail-plus") changeDetailQuantity(type === "detail-plus" ? 1 : -1);
  if (type === "add-detail") {
    const input = document.querySelector("#detail-quantity");
    await addToCart(Number(action.dataset.productId), Number(input.value));
  }
  if (type === "cart-minus" || type === "cart-plus") {
    const next = Number(action.dataset.qty) + (type === "cart-plus" ? 1 : -1);
    if (next >= 1 && next <= 99) await updateCart(Number(action.dataset.itemId), next);
  }
  if (type === "remove") await removeCartItem(Number(action.dataset.itemId));
  if (type === "order") await createOrder();
});

window.addEventListener("popstate", renderRoute);
renderRoute();
refreshCartCount();

function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
  window.scrollTo(0, 0);
}

async function renderRoute() {
  setCurrentNavigation();
  const path = location.pathname;
  if (path === "/") return renderHome();
  if (path === "/cart") return renderCart();

  const productMatch = path.match(/^\/products\/(\d+)$/);
  if (productMatch) return renderDetail(Number(productMatch[1]));

  const orderMatch = path.match(/^\/orders\/([0-9a-f-]+)$/i);
  if (orderMatch) return renderOrder(orderMatch[1]);
  renderMessage("페이지를 찾을 수 없습니다.");
}

async function renderHome() {
  const category = new URLSearchParams(location.search).get("category") || "";
  try {
    const data = await api(`/api/products${category ? `?category=${encodeURIComponent(category)}` : ""}`);
    document.title = category || "상품";
    app.className = "home-page";
    app.innerHTML = `
      <h1 class="section-title">${escapeHtml(category || "전체 상품")}</h1>
      <div class="product-grid">
        ${data.products.map(productCard).join("")}
      </div>`;
  } catch (error) {
    renderMessage(error.message);
  }
}

function productCard(product) {
  return `
    <article class="product-card">
      <a class="product-image-link" href="/products/${product.id}" data-link>
        <img src="${product.image_url}" alt="${escapeHtml(product.name)}">
      </a>
      <button class="add-button" type="button" data-action="add-card" data-product-id="${product.id}">담기</button>
      <a class="product-card-name" href="/products/${product.id}" data-link>${escapeHtml(product.name)}</a>
      <p class="product-card-price">${formatWon(product.price)}</p>
    </article>`;
}

async function renderDetail(id) {
  try {
    const { product } = await api(`/api/products/${id}`);
    document.title = product.name;
    app.className = "detail-page";
    app.innerHTML = `
      <div class="detail-image"><img src="${product.image_url}" alt="${escapeHtml(product.name)}"></div>
      <section class="detail-info">
        <p class="detail-category">${escapeHtml(product.category)}</p>
        <h1 class="detail-name">${escapeHtml(product.name)}</h1>
        <p class="detail-description">${escapeHtml(product.description)}</p>
        <p class="detail-price">${formatWon(product.price)}</p>
        <div class="detail-actions">
          ${quantityControl("detail", 1)}
          <button class="primary-button" type="button" data-action="add-detail" data-product-id="${product.id}">장바구니 담기</button>
        </div>
      </section>`;
  } catch (error) {
    renderMessage(error.message);
  }
}

function changeDetailQuantity(delta) {
  const input = document.querySelector("#detail-quantity");
  const next = Math.min(99, Math.max(1, Number(input.value) + delta));
  input.value = String(next);
}

async function renderCart() {
  try {
    const cart = await api("/api/cart");
    document.title = "장바구니";
    app.className = "cart-page";
    app.innerHTML = `
      <h1 class="page-title">장바구니</h1>
      <div class="cart-layout">
        <section class="cart-card">
          ${cart.items.length ? `<ul class="cart-list">${cart.items.map(cartItem).join("")}</ul>` : '<p class="empty-cart">장바구니가 비어 있습니다.</p>'}
          <div class="cart-total-strip">${formatWon(cart.total)}</div>
        </section>
        <aside class="summary-column">
          <div class="summary-card">
            <h2 class="summary-title">결제금액</h2>
            <div class="summary-row"><span>상품 금액</span><strong>${formatWon(cart.total)}</strong></div>
            <div class="summary-row summary-total"><span>결제예정금액</span><strong>${formatWon(cart.total)}</strong></div>
          </div>
          <button class="primary-button" type="button" data-action="order" ${cart.items.length ? "" : "disabled"}>주문하기</button>
        </aside>
      </div>`;
    updateCartCount(cart);
  } catch (error) {
    renderMessage(error.message);
  }
}

function cartItem(item) {
  return `
    <li class="cart-item">
      <img class="cart-item-image" src="${item.image_url}" alt="${escapeHtml(item.name)}">
      <div>
        <p class="cart-item-name">${escapeHtml(item.name)}</p>
        <p class="cart-item-price">${formatWon(item.price * item.qty)}</p>
        ${quantityControl("cart", item.qty, item.id)}
      </div>
      <button class="remove-button" type="button" data-action="remove" data-item-id="${item.id}">삭제</button>
    </li>`;
}

function quantityControl(context, qty, itemId = "") {
  const itemData = itemId ? ` data-item-id="${itemId}" data-qty="${qty}"` : "";
  if (context === "detail") {
    return `<div class="quantity-control" aria-label="수량">
      <button type="button" data-action="detail-minus" aria-label="수량 줄이기">−</button>
      <input id="detail-quantity" type="number" min="1" max="99" value="${qty}" aria-label="수량">
      <button type="button" data-action="detail-plus" aria-label="수량 늘리기">＋</button>
    </div>`;
  }
  return `<div class="quantity-control" aria-label="수량">
    <button type="button" data-action="cart-minus"${itemData} aria-label="수량 줄이기">−</button>
    <span class="quantity-value">${qty}</span>
    <button type="button" data-action="cart-plus"${itemData} aria-label="수량 늘리기">＋</button>
  </div>`;
}

async function renderOrder(id) {
  try {
    const { order } = await api(`/api/orders/${id}`);
    document.title = "주문 완료";
    app.className = "order-page";
    app.innerHTML = `
      <h1 class="page-title">주문 완료</h1>
      <section class="order-card">
        <p class="order-number">주문 번호 ${escapeHtml(order.id)}</p>
        <ul class="order-items">
          ${order.items.map((item) => `<li><span>${escapeHtml(item.name)} · ${item.qty}개</span><strong>${formatWon(item.price * item.qty)}</strong></li>`).join("")}
        </ul>
        <p class="order-total">${formatWon(order.total)}</p>
      </section>`;
    refreshCartCount();
  } catch (error) {
    renderMessage(error.message);
  }
}

async function addToCart(productId, qty) {
  try {
    const cart = await api("/api/cart", { method: "POST", body: { productId, qty } });
    updateCartCount(cart);
  } catch (error) {
    console.error(error);
  }
}

async function updateCart(itemId, qty) {
  try {
    await api(`/api/cart/${itemId}`, { method: "PATCH", body: { qty } });
    await renderCart();
  } catch (error) {
    console.error(error);
  }
}

async function removeCartItem(itemId) {
  try {
    await api(`/api/cart/${itemId}`, { method: "DELETE" });
    await renderCart();
  } catch (error) {
    console.error(error);
  }
}

async function createOrder() {
  try {
    const { orderId } = await api("/api/orders", { method: "POST" });
    navigate(`/orders/${orderId}`);
  } catch (error) {
    console.error(error);
  }
}

async function refreshCartCount() {
  try {
    updateCartCount(await api("/api/cart"));
  } catch {
    cartCount.textContent = "";
  }
}

function updateCartCount(cart) {
  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = count ? String(count) : "";
}

function setCurrentNavigation() {
  const category = new URLSearchParams(location.search).get("category") || "";
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const isCart = link.getAttribute("href") === "/cart";
    const current = isCart ? location.pathname === "/cart" : location.pathname === "/" && (link.dataset.category || "") === category;
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function renderMessage(message) {
  app.className = "home-page";
  app.innerHTML = `<p class="empty-cart">${escapeHtml(message)}</p>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function formatWon(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}
