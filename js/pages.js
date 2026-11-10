// ===== SonDos Textile ERP — Overview & Customers Page =====
import { DB, getDashboardStats } from './db.js';
import { esc, fmt, fmtDate, showToast } from './util.js';
import { card, kpis, table, btn, openModal, closeAllModals, field, initTabs } from './ui.js';

export async function renderOverview() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري تحميل لوحة التحكم...</p></div>';

  try {
    const stats = await getDashboardStats();
    content.innerHTML = `
      <h2 class="page-title">📊 لوحة التحكم</h2>
      ${kpis([
        { label: 'إجمالي الطلبيات', value: stats.totalOrders, variant: '' },
        { label: 'طلبيات قيد التنفيذ', value: stats.pendingOrders, variant: 'warn' },
        { label: 'العملاء', value: stats.totalCustomers, variant: 'success' },
        { label: 'التصاميم المسجلة', value: stats.totalDesigns, variant: '' },
        { label: 'إجمالي البنط المتبقي', value: fmt(stats.totalBuntPending), variant: 'warn' },
        { label: 'البنط المنتج', value: fmt(stats.totalBuntProduced), variant: 'success' },
        { label: 'الطاقة اليومية (بنط)', value: fmt(stats.dailyCapacity), variant: '' },
        { label: 'أيام لتسليم المتبقي', value: stats.estimatedDaysToClear, variant: 'info' },
      ])}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px;margin-top:8px;">
        ${card('أحدث الطلبيات', '<p class="text-mute">سجّل الطلبيات الأخيرة يظهر هنا بعد استيراد البيانات.</p>', '')}
        ${card('ملاحظات الإنتاج', '<p class="text-mute">سجل الماكينات والحالة الحالية.</p>', '')}
      </div>
    `;
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">خطأ في تحميل البيانات: ${esc(err.message)}</div>`;
  }
}

export async function renderCustomers() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري التحميل...</p></div>';

  try {
    const customers = await DB.getCustomers();
    if (!customers.length) {
      content.innerHTML = card('العملاء', empty('لا يوجد عملاء بعد. قم باستيراد طلبياتك من ملف Excel لإضافة العملاء تلقائياً.'), btn('استيراد طلبيات', "location.href='#orders'", 'gold'));
      return;
    }

    const rows = customers.map(c => [
      esc(c.name || c.label || '-'),
      esc(c.phone || '-'),
      fmt(c.orders_count || 0),
      btn('تعديل', `openEditCustomer('${c.id}')`, 'outline-sm'),
      btn('حذف', `deleteCustomer('${c.id}','${esc(c.name)}')`, 'danger-sm'),
    ]);

    content.innerHTML = card(
      'قائمة العملاء',
      `<div id="customers-table">${table(['اسم العميل', 'الهاتف', 'عدد الطلبيات', '', ''], rows)}</div>`,
      btn('+ إضافة عميل', 'openAddCustomer()', 'gold')
    );
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

function empty(msg) {
  return `<div class="text-center text-mute mt-2 mb-2" style="padding:40px;">${msg}</div>`;
}

window.openAddCustomer = async () => {
  const overlay = openModal('إضافة عميل جديد', `
    <form id="customer-form">
      ${field('اسم العميل', '<input id="cust-name" type="text" required placeholder="مثال: أحمد محمد">')}
      ${field('رقم الهاتف', '<input id="cust-phone" type="text" placeholder="01xxxxxxxxx">')}
      ${field('العنوان', '<input id="cust-address" type="text" placeholder="المدينة - الحي">')}
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveCustomer()">حفظ</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveCustomer = async () => {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { showToast('يرجى إدخال اسم العميل', 'error'); return; }
  try {
    await DB.upsertCustomer({ name, phone: document.getElementById('cust-phone').value, address: document.getElementById('cust-address').value });
    closeAllModals();
    showToast('تم حفظ العميل بنجاح', 'success');
    renderCustomers();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};

window.openEditCustomer = async (id) => {
  const customers = await DB.getCustomers();
  const c = customers.find(x => x.id === id);
  if (!c) return;
  const overlay = openModal('تعديل بيانات العميل', `
    <form id="customer-form">
      <input type="hidden" id="cust-id" value="${esc(id)}">
      ${field('اسم العميل', `<input id="cust-name" type="text" value="${esc(c.name || '')}" required>`)}
      ${field('رقم الهاتف', `<input id="cust-phone" type="text" value="${esc(c.phone || '')}">`)}
      ${field('العنوان', `<input id="cust-address" type="text" value="${esc(c.address || '')}">`)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="updateCustomer()">تحديث</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.updateCustomer = async () => {
  const id = document.getElementById('cust-id').value;
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { showToast('يرجى إدخال اسم العميل', 'error'); return; }
  try {
    await DB.upsertCustomer({ id, name, phone: document.getElementById('cust-phone').value, address: document.getElementById('cust-address').value });
    closeAllModals();
    showToast('تم تحديث بيانات العميل', 'success');
    renderCustomers();
  } catch(err) { showToast('فشل التحديث: ' + err.message, 'error'); }
};

window.deleteCustomer = async (id, name) => {
  if (!confirm(`هل تريد حذف العميل "${name}"؟`)) return;
  try {
    await DB.deleteCustomer(id);
    showToast('تم حذف العميل', 'success');
    renderCustomers();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};
