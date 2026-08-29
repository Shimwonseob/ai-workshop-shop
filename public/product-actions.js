const productActionText = {
  quantity: '\uC218\uB7C9',
  add: '\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30',
  added: '\uC7A5\uBC14\uAD6C\uB2C8\uC5D0 \uB2F4\uC558\uC2B5\uB2C8\uB2E4.',
  login: '\uC7A5\uBC14\uAD6C\uB2C8\uB97C \uC0AC\uC6A9\uD558\uB824\uBA74 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
};
let productActionPath = '';

async function enhanceProductDetail() {
  if (!location.pathname.startsWith('/products/')) { productActionPath = ''; return; }
  const info = document.querySelector('.detail-info');
  if (!info || info.querySelector('#product-actions')) return;
  const id = Number(location.pathname.split('/')[2]);
  if (!Number.isInteger(id)) return;
  const response = await fetch('/api/products/' + id);
  if (!response.ok) return;
  const data = await response.json();
  const product = data.product;
  if (!product) return;
  productActionPath = location.pathname;
  const box = document.createElement('div');
  box.id = 'product-actions';
  box.innerHTML = '<label>' + productActionText.quantity + '</label><div><button type="button" id="qty-minus" aria-label="\uC218\uB7C9 \uC904\uC774\uAE30">−</button><input id="product-qty" type="number" min="1" max="99" value="1" aria-label="\uC218\uB7C9"><button type="button" id="qty-plus" aria-label="\uC218\uB7C9 \uB298\uB9AC\uAE30">+</button></div><p id="product-total"></p><button type="button" id="add-to-cart" class="primary">' + productActionText.add + '</button><p id="product-action-message" class="empty" role="status"></p>';
  info.appendChild(box);
  const qty = box.querySelector('#product-qty');
  const total = box.querySelector('#product-total');
  const message = box.querySelector('#product-action-message');
  const updateTotal = () => { const value = Math.max(1, Math.min(99, Number(qty.value) || 1)); qty.value = value; total.textContent = (value * Number(product.sale_price)).toLocaleString('ko-KR') + '\uC6D0'; };
  box.querySelector('#qty-minus').onclick = () => { qty.value = Number(qty.value) - 1; updateTotal(); };
  box.querySelector('#qty-plus').onclick = () => { qty.value = Number(qty.value) + 1; updateTotal(); };
  qty.oninput = updateTotal;
  updateTotal();
  box.querySelector('#add-to-cart').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    message.textContent = '';
    try {
      const me = await fetch('/api/auth/me').then(r => r.json());
      if (!me.user) { message.textContent = productActionText.login; window.location.href = '/login'; return; }
      const result = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, qty: Number(qty.value) }) });
      const cart = await result.json();
      if (!result.ok) throw Error(cart.error || '\uC7A5\uBC14\uAD6C\uB2C8 \uB2F4\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
      const count = document.querySelector('#cart-count');
      if (count) count.textContent = cart.itemCount ? '(' + cart.itemCount + ')' : '';
      message.textContent = productActionText.added;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}

new MutationObserver(enhanceProductDetail).observe(document.body, { childList: true, subtree: true });
enhanceProductDetail();
