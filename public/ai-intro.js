let aiIntroBuilding = null;
const aiIntroLabel = 'English Introduction';

async function attachAiIntro() {
  const path = location.pathname;
  if (!path.startsWith('/products/')) { aiIntroBuilding = null; return; }
  const info = document.querySelector('.detail-info');
  if (!info || info.querySelector('#ai-intro-action')) return;
  if (aiIntroBuilding === path) return;
  aiIntroBuilding = path;
  const id = Number(path.split('/')[2]);
  if (!Number.isInteger(id)) { aiIntroBuilding = null; return; }
  if (location.pathname !== path || document.querySelector('.detail-info') !== info) { aiIntroBuilding = null; return; }
  const box = document.createElement('div');
  box.id = 'ai-intro-action';
  box.innerHTML = '<button type="button" class="primary" id="ai-intro-button">' + aiIntroLabel + '</button><section class="detail-tabs" style="margin-top:24px;padding-top:16px" aria-live="polite"><p class="short">English Introduction</p><p id="ai-intro-result" class="short" hidden></p></section>';
  info.appendChild(box);
  aiIntroBuilding = null;
  const button = box.querySelector('#ai-intro-button');
  const result = box.querySelector('#ai-intro-result');
  button.onclick = async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Creating...';
    try {
      const response = await fetch('/api/ai/product-intro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id }) });
      const data = await response.json();
      if (!response.ok || !data.intro) throw Error('AI unavailable');
      result.textContent = data.intro;
      result.hidden = false;
      button.textContent = aiIntroLabel;
    } catch {
      button.textContent = aiIntroLabel;
    } finally {
      button.disabled = false;
    }
  };
}

new MutationObserver(attachAiIntro).observe(document.body, { childList: true, subtree: true });
attachAiIntro();
