// ===== SonDos Textile ERP — Entry Point & Login =====
import { CONFIG, NAV_PAGES } from './config.js';
import { verifyPassword, setCurrentUser, clearSession, hasRole, getCurrentUser, showToast, getConfigState } from './util.js';
import { getSupabase } from './db.js';

const LOGIN_HTML = `
  <div class="login-screen">
    <div class="login-card">
      <img src="SONDOS LOGO.svg" alt="logo" class="login-logo" onerror="this.style.display='none'">
      <div class="login-title">${CONFIG.companyName}</div>
      <div class="login-sub">نظام إدارة المصنع — تسجيل الدخول</div>
      <form id="login-form">
        <div class="login-error" id="login-error"></div>
        <div class="field">
          <label>اسم المستخدم</label>
          <input id="login-user" type="text" placeholder="أدخل اسم المستخدم" autocomplete="username" required>
        </div>
        <div class="field">
          <label>كلمة المرور</label>
          <input id="login-pass" type="password" placeholder="أدخل كلمة المرور" autocomplete="current-password" required>
        </div>
        <button type="submit" class="btn btn-gold" style="width:100%;justify-content:center;padding:12px;">تسجيل الدخول</button>
      </form>
    </div>
  </div>
`;

/** Render login screen and handle authentication */
export async function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = LOGIN_HTML;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';

    // Check local users first
    const user = CONFIG.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) { errEl.textContent = 'اسم المستخدم غير صحيح'; return; }

    const ok = await verifyPassword(user, password);
    if (!ok) { errEl.textContent = 'كلمة المرور غير صحيحة'; return; }

    // Check Supabase custom users if any
    const cfg = getConfigState();
    if (cfg.url && user.role === 'viewer') {
      // Viewer can also be authenticated via Supabase
    }

    setCurrentUser({ ...user, login_time: new Date().toISOString() });
    showToast(`مرحباً ${user.label}`, 'success');
    // Redirect to app (app.js handles navigation)
    window.location.hash = '#overview';
    location.reload();
  });
}

/** Render the main layout shell after login */
export function renderShell(onNavClick) {
  const user = getCurrentUser();
  if (!user) { renderLogin(); return; }

  const supabase = getSupabase();
  const dbConnected = !!supabase;

  document.getElementById('app').innerHTML = `
    <header class="topbar">
      <div class="topbar-brand">
        <img src="SONDOS LOGO.svg" alt="logo" class="topbar-logo" onerror="this.style.display='none'">
        <div class="topbar-title">${CONFIG.shortName} — ERP</div>
      </div>
      <div class="topbar-user">
        ${dbConnected
          ? '<span class="badge badge-success">متصل بالسوبابيس</span>'
          : '<span class="badge badge-warning">بدون اتصال</span>'}
        <span>${esc(user.label)}</span>
        <span class="role-badge">${CONFIG.ROLE_LABELS[user.role]}</span>
        <button class="btn btn-sm btn-outline" onclick="handleLogout()">خروج</button>
      </div>
    </header>
    <div class="main-shell">
      <nav class="side-nav" id="side-nav"></nav>
      <main class="content" id="page-content"></main>
    </div>
  `;

  renderNav(onNavClick);
}

function renderNav(onNavClick) {
  const nav = document.getElementById('side-nav');
  if (!nav) return;
  const currentHash = window.location.hash.replace('#', '') || 'overview';
  const rolesAllowed = CONFIG.ROLES[getCurrentUser()?.role] ?? 0;

  let html = '';
  let lastSection = '';
  for (const page of NAV_PAGES) {
    if (rolesAllowed < CONFIG.ROLES[page.minRole]) continue;
    if (page.section !== lastSection) {
      html += `<div class="nav-section"><div class="nav-section-title">${esc(page.section)}</div>`;
      lastSection = page.section;
    }
    const active = page.id === currentHash ? ' active' : '';
    html += `<div class="nav-link${active}" data-page="${page.id}">
      <span class="nav-link-icon">${page.icon}</span>
      ${esc(page.title)}
    </div>`;
  }
  // Close all open sections
  html += '</div>';
  nav.innerHTML = html;

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const page = link.dataset.page;
      if (page) onNavClick(page);
    });
  });
}

export function handleLogout() {
  clearSession();
  window.location.hash = '';
  location.reload();
}

window.handleLogout = handleLogout;
