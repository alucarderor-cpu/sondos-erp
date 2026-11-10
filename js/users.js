// ===== SonDos Textile ERP — Users Management =====
import { CONFIG } from './config.js';
import { DB } from './db.js';
import { esc, showToast, computeHash } from './util.js';
import { card, table, btn, openModal, closeAllModals, field } from './ui.js';

const ROLE_OPTIONS = Object.entries(CONFIG.ROLE_LABELS).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');

export async function renderUsers() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري تحميل المستخدمين...</p></div>';

  try {
    const customUsers = await DB.getCustomUsers();
    renderUsersView(content, customUsers);
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

function renderUsersView(el, customUsers) {
  // Merge built-in users with custom users
  const allUsers = [...CONFIG.users, ...(customUsers || [])];
  const rows = allUsers.map(u => [
    esc(u.label),
    esc(u.username),
    badgeRole(u.role),
    u.is_builtin ? badge('مدمج', 'info') : btn('تعديل', `openEditUser('${u.id || u.username}')`, 'outline-sm'),
    u.is_builtin ? '-' : btn('حذف', `deleteUser('${u.id || u.username}','${esc(u.label)}')`, 'danger-sm'),
  ]);

  el.innerHTML = card(
    'إدارة المستخدمين',
    `<div id="users-table">${table(['الاسم', 'اسم المستخدم', 'الدور', '', ''], rows)}</div>`,
    `<div class="btn-group">${btn('+ مستخدم جديد', 'openAddUser()', 'gold')}</div>`
  );
}

function badgeRole(role) {
  const colors = { owner: 'danger', admin: 'warn', editor: 'info', viewer: 'default' };
  return `<span class="badge badge-${colors[role] || 'default'}">${esc(CONFIG.ROLE_LABELS[role] || role)}</span>`;
}

window.openAddUser = () => {
  openModal('إضافة مستخدم جديد', `
    <form id="user-form">
      ${field('الاسم الظاهر', `<input id="u-label" type="text" required placeholder="مثال: سندس	user">`)}
      ${field('اسم المستخدم (للولوج)', `<input id="u-username" type="text" required placeholder="sondos_user">`)}
      ${field('كلمة المرور', `<input id="u-password" type="password" required placeholder="أدخل كلمة مرور قوية">`)}
      ${field('الدور', `
        <select id="u-role">
          ${ROLE_OPTIONS}
        </select>
      `)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveUser()">حفظ</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveUser = async () => {
  const label = document.getElementById('u-label').value.trim();
  const username = document.getElementById('u-username').value.trim();
  const password = document.getElementById('u-password').value;
  const role = document.getElementById('u-role').value;

  if (!label || !username || !password) { showToast('يرجى ملء جميع الحقول المطلوبة', 'error'); return; }
  if (password.length < 6) { showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }

  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await computeHash(password, salt);

  try {
    await DB.upsertUser({ label, username, password_hash: hash, salt, role, is_builtin: false });
    closeAllModals();
    showToast('تم إضافة المستخدم بنجاح', 'success');
    renderUsers();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};

window.openEditUser = async (userId) => {
  const customUsers = await DB.getCustomUsers();
  const u = customUsers.find(x => x.id === userId || x.username === userId);
  if (!u) return;

  openModal('تعديل المستخدم', `
    <form id="user-edit-form">
      <input type="hidden" id="u-eid" value="${esc(u.id || u.username)}">
      ${field('الاسم الظاهر', `<input id="u-elabel" type="text" value="${esc(u.label || '')}" required>`)}
      ${field('اسم المستخدم', `<input id="u-eusername" type="text" value="${esc(u.username || '')}" disabled>`)}
      ${field('تغيير كلمة المرور (اتركه فارغاً للإبقاء عليه)', `<input id="u-epassword" type="password" placeholder="كلمة مرور جديدة">`)}
      ${field('الدور', `
        <select id="u-erole">
          ${ROLE_OPTIONS.replace(`value="${esc(u.role)}"`, `value="${esc(u.role)}" selected`)}
        </select>
      `)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="updateUser()">تحديث</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.updateUser = async () => {
  const id = document.getElementById('u-eid').value;
  const password = document.getElementById('u-epassword').value;
  try {
    const update = {
      label: document.getElementById('u-elabel').value.trim(),
      role: document.getElementById('u-erole').value,
    };
    if (password) {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      update.password_hash = await computeHash(password, salt);
      update.salt = salt;
    }
    await DB.upsertUser({ id, ...update });
    closeAllModals();
    showToast('تم تحديث المستخدم', 'success');
    renderUsers();
  } catch(err) { showToast('فشل التحديث: ' + err.message, 'error'); }
};

window.deleteUser = async (id, label) => {
  if (!confirm(`هل تريد حذف المستخدم "${label}"؟`)) return;
  try {
    await DB.deleteUser(id);
    showToast('تم حذف المستخدم', 'success');
    renderUsers();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};
