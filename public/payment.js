const paymentText = { pay: '\uACB0\uC81C\uD558\uAE30', loading: '\uACB0\uC81C \uC218\uB2E8\uC744 \uC900\uBE44\uD558\uB294 \uC911\uC785\uB2C8\uB2E4.', done: '\uACB0\uC81C\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.' };
let paymentSetupStarted = false;

function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function confirmFromRedirect() {
  const params = new URLSearchParams(location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = params.get('amount');
  if (!paymentKey || !orderId || !amount) return;
  try {
    await fetch('/api/payments/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }) });
    history.replaceState({}, '', location.pathname);
    const message = document.createElement('p');
    message.className = 'empty';
    message.textContent = paymentText.done;
    document.querySelector('.summary-card')?.prepend(message);
  } catch (error) {
    console.error(error);
  }
}

async function setupPayment() {
  const summary = document.querySelector('.summary-card');
  if (!summary) { paymentSetupStarted = false; return; }
  if (summary.querySelector('#toss-pay-button') || paymentSetupStarted) return;
  paymentSetupStarted = true;
  const resumeOrderId = new URLSearchParams(location.search).get('resumeOrder');
  const cart = await fetch('/api/cart').then(r => r.json());
  let payableAmount = cart.total;
  if (resumeOrderId) {
    const orderResponse = await fetch('/api/orders/' + encodeURIComponent(resumeOrderId));
    const orderData = await orderResponse.json();
    if (!orderResponse.ok || orderData.order?.status !== 'pending') { paymentSetupStarted = false; return; }
    payableAmount = orderData.order.total;
  } else if (!cart.items?.some(item => !item.unavailable)) { paymentSetupStarted = false; return; }
  const box = document.createElement('div');
  box.className = 'payment-widget';
  box.innerHTML = '<div id="payment-methods"></div><div id="payment-agreement"></div><button id="toss-pay-button" class="primary" type="button">' + paymentText.pay + '</button>';
  summary.appendChild(box);
  const button = box.querySelector('#toss-pay-button');
  button.disabled = true;
  try {
    const config = await fetch('/api/payments/config').then(r => r.json());
    if (!config.clientKey) throw Error(config.error || 'payment unavailable');
    await loadTossSdk();
    const widgets = TossPayments(config.clientKey).widgets({ customerKey: crypto.randomUUID() });
    await widgets.setAmount({ currency: 'KRW', value: payableAmount });
    await widgets.renderPaymentMethods({ selector: '#payment-methods' });
    await widgets.renderAgreement({ selector: '#payment-agreement' });
    button.disabled = false;
    button.onclick = async () => {
      button.disabled = true;
      let orderId = resumeOrderId;
      if (!orderId) {
        const orderResponse = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const order = await orderResponse.json();
        if (!orderResponse.ok) throw Error(order.error || 'order failed');
        orderId = order.orderId;
      }
      await widgets.requestPayment({ orderId, orderName: '\uC1FC\uD551\uBAB0 \uC8FC\uBB38', successUrl: `${location.origin}/cart`, failUrl: `${location.origin}/cart` });
    };
  } catch (error) {
    button.textContent = paymentText.loading;
    button.disabled = true;
    console.error(error);
  }
}

const paymentObserver = new MutationObserver(() => setupPayment());
paymentObserver.observe(document.body, { childList: true, subtree: true });
confirmFromRedirect();
setupPayment();
