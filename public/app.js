const appRoot = document.querySelector('#app');
const cartCount = document.querySelector('#cart-count');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}

function go(path) { history.pushState({}, '', path); render(); window.scrollTo(0, 0); }

document.addEventListener('click', event => {
  const link = event.target.closest('[data-link]');
  if (link) { event.preventDefault(); go(link.getAttribute('href')); }
  const addButton = event.target.closest('[data-add-cart]');
  if (addButton) { event.preventDefault(); addToCart(addButton); }
});
window.addEventListener('popstate', render);

const categoryButton = document.querySelector('#category-toggle');
const categoryMenu = document.querySelector('#category-menu');
function closeCategoryMenu() { if (!categoryMenu) return; categoryMenu.hidden = true; categoryButton?.setAttribute('aria-expanded', 'false'); }
categoryButton?.addEventListener('click', event => { event.stopPropagation(); categoryMenu.hidden = !categoryMenu.hidden; categoryButton.setAttribute('aria-expanded', String(!categoryMenu.hidden)); });
document.addEventListener('click', event => { if (categoryMenu && !categoryMenu.hidden && !categoryMenu.contains(event.target) && event.target !== categoryButton) closeCategoryMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCategoryMenu(); });

document.querySelector('#search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#search-input').value.trim();
  if (query) go(`/search?query=${encodeURIComponent(query)}`);
});

function updateActiveNav() {
  const current = new URLSearchParams(location.search).get('collection');
  document.querySelectorAll('.main-nav a').forEach(link => {
    const active = current && link.getAttribute('href')?.includes(`collection=${current}`);
    link.classList.toggle('active', Boolean(active));
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}

const shippingLabels = { Frozen: '냉동', Chilled: '냉장', Ambient: '상온' };
const badgeLabels = { Popular: '인기', New: '신상품', Recommended: '추천' };
const displayShipping = value => shippingLabels[value] || value;
const displayBadge = value => badgeLabels[value] || value;
const displayCoupon = value => String(value || '').replace(/coupon/gi, '쿠폰');

function card(product) {
  const badge = product.badge ? `<span class="badge">${esc(displayBadge(product.badge))}</span>` : '';
  const coupon = product.coupon_label ? `<span class="coupon">${esc(displayCoupon(product.coupon_label))}</span>` : '';
  const discount = Number(product.discount_rate) > 0 ? `<span class="discount">${product.discount_rate}%</span>` : '';
  const original = Number(product.original_price) > Number(product.sale_price) ? `<del>${won(product.original_price)}</del>` : '';
  const reviews = Number(product.review_count) ? `<p class="reviews">후기 ${Number(product.review_count).toLocaleString('ko-KR')}</p>` : '';
  return `<article class="product-card"><a class="product-image" data-link href="/products/${product.id}"><img src="${esc(product.image_url)}" alt="${esc(product.name)}"></a><div class="card-meta">${badge}${product.shipping_type ? `<span>${esc(displayShipping(product.shipping_type))}</span>` : ''}</div><a class="product-name" data-link href="/products/${product.id}">${esc(product.name)}</a><p class="short">${esc(product.short_description)}</p><div class="price-line">${discount}<strong>${won(product.sale_price)}</strong>${original}</div><div class="card-foot">${coupon}${reviews}</div><button class="add-button" type="button" data-add-cart data-product-id="${product.id}">장바구니 담기</button></article>`;
}

async function addToCart(button) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const me = await api('/api/auth/me');
    if (!me.user) { alert('장바구니를 사용하려면 로그인이 필요합니다.'); go('/login'); return; }
    const cart = await api('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: Number(button.dataset.productId), qty: 1 }) });
    if (cartCount) cartCount.textContent = cart.itemCount ? `(${cart.itemCount})` : '';
    const original = button.textContent; button.textContent = '담았습니다'; setTimeout(() => { button.textContent = original; }, 1200);
  } catch (error) { alert(error.message); } finally { button.disabled = false; }
}

function section(title, subtitle, products, key, link) {
  return `<section class="merch ${key ? `merch-${key}` : ''}"><div class="section-heading"><div><p class="eyebrow">${products.length}개 상품</p><h2>${title}</h2><p>${subtitle}</p></div>${link ? `<a class="more-link" data-link href="${link}">더보기 <span>›</span></a>` : ''}</div><div class="product-grid">${products.map(card).join('')}</div></section>`;
}

async function home() {
  const products = (await api('/api/products')).products;
  const collection = new URLSearchParams(location.search).get('collection');
  if (collection) return collectionPage(products, collection);
  appRoot.className = 'home-page';
  const recommended = products.slice(0, 5);
  const popular = [...products].sort((a, b) => a.sales_rank - b.sales_rank).slice(0, 5);
  const sale = products.filter(item => Number(item.discount_rate) > 0).slice(0, 5);
  const best = products.filter(item => item.is_best).slice(0, 5);
  const fresh = products.filter(item => item.is_new).slice(0, 5);
  const special = products.filter(item => item.is_special || item.coupon_label).slice(0, 5);
  appRoot.innerHTML = `<section class="hero shell"><div><p class="eyebrow">NOURI WEEKLY TABLE</p><h1>오늘의 식탁을<br><em>가볍게, 알차게</em></h1><p>매일 필요한 식재료와 간편한 한 끼를 한곳에서 만나보세요.</p><a class="hero-link" data-link href="/category/간편식">지금 둘러보기 <span>›</span></a></div><div class="hero-mark">N</div></section><div class="shell sections">${section('오늘의 추천', 'Nouri가 고른 이번 주 식탁의 기본', recommended, 'recommend', '/?collection=new')}${section('지금 많이 담는 상품', '다른 고객이 함께 살펴본 인기 상품', popular, 'popular', '/?collection=best')}${section('알뜰하게 준비하는 식탁', '가격 부담을 덜어주는 할인 상품', sale, 'sale', '/?collection=value')}${section('베스트 상품', '꾸준히 사랑받는 상품을 모았어요', best, 'best', '/?collection=best')}${section('새로 들어온 상품', '이번 주 새롭게 만나는 상품', fresh, 'new', '/?collection=new')}${section('특가와 쿠폰 혜택', '놓치기 아쉬운 오늘의 혜택', special, 'special', '/?collection=special')}</div>`;
}

const collectionInfo = { new: ['신상품', '새롭게 준비한 상품을 가장 먼저 만나보세요.'], best: ['베스트', '꾸준히 선택받는 상품을 판매 순위로 확인하세요.'], value: ['알뜰쇼핑', '할인 혜택이 있는 상품만 모았습니다.'], special: ['특가혜택', '특가와 쿠폰 혜택을 한눈에 살펴보세요.'] };
async function collectionPage(products, key) {
  if (!collectionInfo[key]) return home();
  let list = products.filter(item => key === 'new' ? item.is_new : key === 'best' ? item.is_best : key === 'value' ? Number(item.discount_rate) > 0 : item.is_special || item.coupon_label);
  if (key === 'best') list = list.sort((a, b) => a.sales_rank - b.sales_rank);
  if (key === 'value') list = list.sort((a, b) => b.discount_rate - a.discount_rate);
  renderListing(collectionInfo[key][0], collectionInfo[key][1], list, false);
}

async function listing(category) {
  const params = new URLSearchParams(location.search); const sort = params.get('sort') || 'recommended';
  const data = await api(`/api/products?category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`);
  let products = data.products;
  if (params.get('discount') === '1') products = products.filter(item => Number(item.discount_rate) > 0);
  if (params.get('new') === '1') products = products.filter(item => item.is_new);
  if (params.get('best') === '1') products = products.filter(item => item.is_best);
  renderListing(category, `${category}에서 지금 필요한 상품을 골라보세요.`, products, true);
}

async function searchListing() {
  const query = new URLSearchParams(location.search).get('query') || '';
  const data = await api(`/api/products?query=${encodeURIComponent(query)}`);
  renderListing(`'${query}' 검색 결과`, '상품명과 설명에서 검색한 결과입니다.', data.products, false);
}

function renderListing(title, subtitle, products, showFilters) {
  appRoot.className = 'listing-page shell';
  const params = new URLSearchParams(location.search); const sort = params.get('sort') || 'recommended';
  const filters = showFilters ? `<aside class="filter-panel"><h2>필터</h2><fieldset><legend>상품 조건</legend><label><input type="checkbox" data-filter="discount" ${params.get('discount') === '1' ? 'checked' : ''}> 할인 상품</label><label><input type="checkbox" data-filter="new" ${params.get('new') === '1' ? 'checked' : ''}> 신상품</label><label><input type="checkbox" data-filter="best" ${params.get('best') === '1' ? 'checked' : ''}> 베스트</label></fieldset><a class="reset-filter" data-reset-filter href="/category/${encodeURIComponent(title)}">필터 초기화</a></aside>` : '';
  appRoot.innerHTML = `<div class="listing-head"><div><p class="eyebrow">NOURI COLLECTION</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="listing-count">총 <strong>${products.length}</strong>개</div></div><div class="listing-toolbar"><div class="category-chips">${['간편식', '베이커리', '신선식품', '반찬'].map(name => `<a data-link class="${name === title ? 'selected' : ''}" href="/category/${name}">${name}</a>`).join('')}</div><label class="sort-label">정렬 <select id="sort-select"><option value="recommended" ${sort === 'recommended' ? 'selected' : ''}>추천순</option><option value="new" ${sort === 'new' ? 'selected' : ''}>신상품순</option><option value="sales" ${sort === 'sales' ? 'selected' : ''}>판매량순</option><option value="price" ${sort === 'price' ? 'selected' : ''}>낮은 가격순</option></select></label></div><div class="listing-body">${filters}<div class="listing-results">${products.length ? `<div class="product-grid">${products.map(card).join('')}</div>` : `<div class="empty-state"><h2>조건에 맞는 상품이 없습니다.</h2><p>다른 조건을 선택하거나 홈에서 상품을 둘러보세요.</p><a class="primary-link" data-link href="/">홈으로 돌아가기</a></div>`}</div></div>`;
  document.querySelector('#sort-select')?.addEventListener('change', event => { const next = new URLSearchParams(location.search); next.set('sort', event.target.value); go(`${location.pathname}?${next}`); });
  document.querySelectorAll('[data-filter]').forEach(input => input.addEventListener('change', event => { const next = new URLSearchParams(location.search); if (event.target.checked) next.set(event.target.dataset.filter, '1'); else next.delete(event.target.dataset.filter); go(`${location.pathname}?${next}`); }));
}

async function detail(id) {
  const product = (await api(`/api/products/${id}`)).product;
  appRoot.className = 'detail-page shell';
  const discount = Number(product.discount_rate) > 0 ? `<span>${product.discount_rate}%</span>` : '';
  const original = Number(product.original_price) > Number(product.sale_price) ? `<del>${won(product.original_price)}</del>` : '';
  appRoot.innerHTML = `<div class="detail-breadcrumb"><a data-link href="/">홈</a><span>›</span><a data-link href="/category/${encodeURIComponent(product.category_name || product.category || '')}">${esc(product.category_name || product.category || '상품')}</a><span>›</span><span>${esc(product.name)}</span></div><div class="detail-top"><div class="detail-image"><img src="${esc(product.image_url)}" alt="${esc(product.name)}"></div><section class="detail-info"><div class="detail-badges">${product.badge ? `<span class="badge">${esc(displayBadge(product.badge))}</span>` : ''}${product.coupon_label ? `<span class="coupon">${esc(displayCoupon(product.coupon_label))}</span>` : ''}</div><h1>${esc(product.name)}</h1><p class="detail-description">${esc(product.short_description)}</p><div class="detail-prices">${discount}<strong>${won(product.sale_price)}</strong>${original}</div><dl class="info-list"><dt>배송</dt><dd>${esc(displayShipping(product.shipping_type || ''))}</dd><dt>판매 단위</dt><dd>${esc(product.selling_unit || '')}</dd><dt>중량·용량</dt><dd>${esc(product.weight || '')}</dd></dl></section></div><section class="detail-tabs"><nav class="tab-nav" aria-label="상품 정보"><button class="active" data-tab="description">상품설명</button><button data-tab="detail-info-panel">상세정보</button><button data-tab="reviews">후기 (${Number(product.review_count || 0).toLocaleString('ko-KR')})</button><button data-tab="inquiries">문의</button></nav><div id="description" class="tab-panel active"><h2>상품설명</h2><p>${esc(product.description)}</p></div><div id="detail-info-panel" class="tab-panel"><h2>상세정보</h2><p>판매 단위 ${esc(product.selling_unit || '')} · ${esc(product.weight || '')}</p><p>배송 유형 ${esc(displayShipping(product.shipping_type || ''))}</p></div><div id="reviews" class="tab-panel"><h2>후기</h2><p class="empty-inline">아직 등록된 후기가 없습니다.</p></div><div id="inquiries" class="tab-panel"><h2>문의</h2><p class="empty-inline">상품 문의가 준비 중입니다.</p></div></section>`;
  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tab.dataset.tab)); }));
}

async function cart() {
  let data;
  try { data = await api('/api/cart'); } catch (error) { if (/login/i.test(error.message) || error.message) { appRoot.className = 'cart-page'; appRoot.innerHTML = `<div class="shell"><div class="login-required"><p class="eyebrow">NOURI CART</p><h1>로그인이 필요한 서비스입니다.</h1><p>로그인하면 담아둔 상품을 확인하고 주문할 수 있어요.</p><a class="primary-link" data-link href="/login">로그인하기</a></div></div>`; return; } throw error; }
  appRoot.className = 'cart-page';
  const available = data.items.filter(item => !item.unavailable);
  const rows = data.items.map(item => `<li class="cart-row ${item.unavailable ? 'unavailable' : ''}" data-cart-id="${item.id}"><label class="check-wrap"><input type="checkbox" class="cart-check" ${item.unavailable ? 'disabled' : 'checked'}><span></span></label><img src="${esc(item.image_url)}" alt="${esc(item.name || '상품')}"><div class="cart-product"><a data-link href="/products/${item.product_id}">${esc(item.name || '판매 종료 상품')}</a>${item.unavailable ? '<p class="unavailable-text">현재 구매할 수 없는 상품입니다.</p>' : `<p>${won(item.sale_price)}</p>`}</div>${item.unavailable ? '<span class="unavailable-label">구매 불가</span>' : `<div class="qty-control"><button type="button" data-qty="-">−</button><span>${item.qty}</span><button type="button" data-qty="+">+</button></div><strong class="row-total">${won(item.sale_price * item.qty)}</strong>`}<button class="remove-item" type="button" data-remove>×</button></li>`).join('');
  appRoot.innerHTML = `<div class="shell"><div class="cart-head"><div><p class="eyebrow">NOURI CART</p><h1>장바구니</h1></div><span>${available.length}개 상품</span></div><div class="cart-layout"><section class="cart-card"><div class="cart-tools"><label><input id="select-all" type="checkbox" checked> 전체선택</label><button id="remove-selected" type="button">선택삭제</button></div>${rows ? `<ul class="cart-list">${rows}</ul>` : '<div class="empty-state"><h2>장바구니가 비어 있습니다.</h2><p>마음에 드는 상품을 담아보세요.</p><a class="primary-link" data-link href="/">쇼핑 계속하기</a></div>'}</section><aside class="summary-card"><h2>결제금액</h2><p><span>상품금액</span><strong>${won(data.originalSubtotal)}</strong></p><p><span>할인금액</span><strong class="discount-text">-${won(data.discountTotal)}</strong></p><p><span>배송비</span><strong>${data.shippingFee ? won(data.shippingFee) : '무료'}</strong></p><div class="summary-total"><span>결제예정금액</span><strong>${won(data.total)}</strong></div>${available.length ? '<p class="summary-note">판매가 30,000원 이상 구매 시 배송비 무료</p>' : ''}</aside></div></div>`;
  bindCartEvents();
}

function bindCartEvents() {
  document.querySelector('#select-all')?.addEventListener('change', event => document.querySelectorAll('.cart-check:not(:disabled)').forEach(input => { input.checked = event.target.checked; }));
  document.querySelectorAll('[data-qty]').forEach(button => button.addEventListener('click', async () => { const row = button.closest('[data-cart-id]'); const qty = Number(row.querySelector('.qty-control span').textContent) + (button.dataset.qty === '+' ? 1 : -1); if (qty < 1) return; try { await api(`/api/cart/${row.dataset.cartId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qty }) }); await cart(); } catch (error) { alert(error.message); } }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', async () => { try { await api(`/api/cart/${button.closest('[data-cart-id]').dataset.cartId}`, { method: 'DELETE' }); await cart(); } catch (error) { alert(error.message); } }));
  document.querySelector('#remove-selected')?.addEventListener('click', async () => { const rows = [...document.querySelectorAll('.cart-row')].filter(row => row.querySelector('.cart-check')?.checked); for (const row of rows) await api(`/api/cart/${row.dataset.cartId}`, { method: 'DELETE' }); await cart(); });
}

async function render() {
  closeCategoryMenu(); updateActiveNav();
  try { const path = location.pathname; if (path === '/') return home(); if (path.startsWith('/category/')) return listing(decodeURIComponent(path.slice(10))); if (path.startsWith('/products/')) return detail(Number(path.split('/')[2])); if (path === '/cart') return cart(); if (path === '/search') return searchListing(); } catch (error) { appRoot.innerHTML = `<div class="empty-state shell"><h2>잠시 후 다시 시도해주세요.</h2><p>${esc(error.message)}</p></div>`; }
}
render();
