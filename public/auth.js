const root = document.querySelector('#app');
const req = (url, options) => fetch(url, {
  headers: options?.body ? { 'Content-Type': 'application/json' } : {},
  ...options,
}).then(async response => {
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '\uC624\uB958');
  return data;
});

const labels = {
  login: '\uB85C\uADF8\uC778',
  signup: '\uD68C\uC6D0\uAC00\uC785',
  mypage: '\uB9C8\uC774\uD398\uC774\uC9C0',
  logout: '\uB85C\uADF8\uC544\uC6C3',
};

function ensureAuthMenu() {
  let menu = document.querySelector('#auth-menu');
  if (menu) return menu;
  const utilityNav = document.querySelector('.utility nav');
  if (!utilityNav) return null;
  menu = document.createElement('span');
  menu.id = 'auth-menu';
  menu.style.display = 'inline-flex';
  menu.style.gap = '16px';
  menu.style.alignItems = 'center';
  utilityNav.appendChild(menu);
  return menu;
}

function renderAuthMenu(user) {
  const menu = ensureAuthMenu();
  if (!menu) return;
  if (user) {
    menu.innerHTML = '<a href="/mypage">' + labels.mypage + '</a><button id="header-logout" type="button">' + labels.logout + '</button>';
    menu.querySelector('#header-logout').onclick = async () => {
      await req('/api/auth/logout', { method: 'POST' });
      await refreshAuthMenu();
      if (location.pathname === '/mypage') location.href = '/';
    };
  } else {
    menu.innerHTML = '<a href="/login">' + labels.login + '</a><a href="/signup">' + labels.signup + '</a>';
  }
}

async function refreshAuthMenu() {
  try {
    const data = await req('/api/auth/me');
    renderAuthMenu(data.user);
  } catch {
    renderAuthMenu(null);
  }
}

function renderAuthPage() {
  if (location.pathname === '/login' || location.pathname === '/signup') {
    const signup = location.pathname === '/signup';
    root.innerHTML = '<section class="auth-card shell"><h1>' + (signup ? labels.signup : labels.login) + '</h1><form id="auth-form"><input name="email" type="email" placeholder="\uC774\uBA54\uC77C" required><input name="password" type="password" placeholder="\uBE44\uBC00\uBC88\uD638(8\uC790 \uC774\uC0C1)" minlength="8" required>' + (signup ? '<input name="name" placeholder="\uC774\uB984" required>' : '') + '<button class="primary">' + (signup ? '\uAC00\uC785\uD558\uAE30' : labels.login) + '</button></form><a data-link href="' + (signup ? '/login' : '/signup') + '">' + (signup ? labels.login : labels.signup) + '</a></section>';
    document.querySelector('#auth-form').onsubmit = async event => {
      event.preventDefault();
      try {
        await req('/api/auth/' + (signup ? 'signup' : 'login'), { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
        await refreshAuthMenu();
        location.href = '/mypage';
      } catch (error) {
        root.insertAdjacentHTML('beforeend', '<p class="empty">' + error.message + '</p>');
      }
    };
  }
  if (location.pathname === '/mypage') {
    req('/api/auth/me').then(data => {
      if (!data.user) { location.href = '/login'; return; }
      root.innerHTML = '<section class="shell auth-card"><h1>' + labels.mypage + '</h1><p>' + data.user.name + '\uB2D8</p><p>' + data.user.email + '</p><button id="logout" class="primary">' + labels.logout + '</button></section>';
      document.querySelector('#logout').onclick = async () => {
        await req('/api/auth/logout', { method: 'POST' });
        await refreshAuthMenu();
        location.href = '/';
      };
    }).catch(() => { location.href = '/login'; });
  }
}

refreshAuthMenu();
renderAuthPage();
