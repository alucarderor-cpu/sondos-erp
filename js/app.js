// ===== SonDos Textile ERP — Main App Router =====
import { renderLogin, renderShell } from './entry.js';
import { getCurrentUser, hasRole } from './util.js';
import { NAV_PAGES } from './config.js';

let currentRender = null;

/** Lazily load a page module and return its render function */
const PAGE_MODULES = {
  overview: () => import('./pages.js').then(m => m.renderOverview),
  customers: () => import('./pages.js').then(m => m.renderCustomers),
  orders: () => import('./orders.js').then(m => m.renderOrders),
  weaving: () => import('./weaving.js').then(m => m.renderWeaving),
  designs: () => import('./designs.js').then(m => m.renderDesigns),
  machines: () => import('./machines.js').then(m => m.renderMachines),
  users: () => import('./users.js').then(m => m.renderUsers),
  settings: () => import('./settings.js').then(m => m.renderSettings),
};

function resolveRoute(pageId) {
  if (!PAGE_MODULES[pageId]) return 'overview';
  const page = NAV_PAGES.find(p => p.id === pageId);
  if (page && !hasRole(page.minRole)) return 'overview'; // downgrade unknown/unauthorised
  return pageId;
}

async function navigateTo(pageId) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري التحميل...</p></div>';

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageId);
  });

  const renderFn = await PAGE_MODULES[resolveRoute(pageId)]();
  if (typeof renderFn === 'function') {
    currentRender = renderFn;
    renderFn();
  } else {
    content.innerHTML = '<div class="empty-state">الصفحة غير متاحة بعد.</div>';
  }
}

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#', '') || 'overview';
  navigateTo(page);
});

export async function bootApp() {
  const user = getCurrentUser();
  if (!user) { renderLogin(); return; }

  renderShell(async (pageId) => {
    window.location.hash = `#${pageId}`;
  });

  const initialPage = window.location.hash.replace('#', '') || 'overview';
  await navigateTo(initialPage);
}
