// ===== SonDos Textile ERP — Orders Page (Excel Import + Management) =====
import { DB, parseExcelFile } from './db.js';
import { esc, fmt, showToast } from './util.js';
import { card, table, btn, openModal, closeAllModals, field, showLoading, hideLoading } from './ui.js';

export async function renderOrders() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري التحميل...</p></div>';

  try {
    const [orders, items] = await Promise.all([DB.getOrders(), getOrderItemsFlat()]);
    renderOrdersView(content, orders, items);
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

async function getOrderItemsFlat() {
  const orders = await DB.getOrders();
  const allItems = [];
  for (const o of orders) {
    const its = await DB.getOrderItems(o.id);
    for (const it of (its || [])) allItems.push({ ...it, order_id: o.id, order_customer: o.customer });
  }
  return allItems;
}

function renderOrdersView(el, orders, items) {
  if (!orders.length) {
    el.innerHTML = card(
      'إدارة الطلبيات',
      emptyState('لا توجد طلبيات مسجلة بعد. يمكنك استيراد طلبياتك من ملفات Excel.'),
      `<div class="btn-group"><button class="btn btn-gold" onclick="document.getElementById('order-import-input').click()">📂 استيراد من Excel</button>
      <input id="order-import-input" type="file" accept=".xlsm,.xlsx" multiple style="display:none" onchange="handleOrderImport(event)">
      <button class="btn btn-outline" onclick="renderOrders()">🔄 تحديث</button></div>`
    );
    return;
  }

  const rows = orders.map(o => [
    esc(o.customer || '-'),
    esc(o.order_number || '-'),
    esc(o.pattern_code || '-'),
    fmt(o.total_bunt || 0),
    fmt(m2FromPattern(o.pattern_code)),
    badgeStatus(o.status),
    `<div class="btn-group">${btn('عرض', `viewOrder('${o.id}')`, 'outline-sm')}${btn('حذف', `deleteOrder('${o.id}')`, 'danger-sm')}</div>`,
  ]);

  el.innerHTML = card(
    `إدارة الطلبيات (${orders.length})`,
    `<div id="orders-table">${table(['العميل', 'رقم الطلب', 'كود التصميم', 'إجمالي البنط', 'المتر المربع (تقديري)', 'الحالة', ''], rows)}</div>`,
    `<div class="btn-group"><button class="btn btn-gold" onclick="document.getElementById('order-import-input').click()">📂 استيراد من Excel</button>
    <input id="order-import-input" type="file" accept=".xlsm,.xlsx" multiple style="display:none" onchange="handleOrderImport(event)">
    <button class="btn btn-outline" onclick="renderOrders()">🔄 تحديث</button></div>`
  );
}

function emptyState(msg) {
  return `<div class="text-center text-mute mt-2 mb-2" style="padding:40px;">${esc(msg)}</div>`;
}

function m2FromPattern(patternCode) {
  // Formula: m² = 800 ÷ (patternCode + 3.5)
  const n = parseFloat(patternCode);
  if (isNaN(n) || n <= 0) return '-';
  return (800 / (n + 3.5)).toFixed(2);
}

function badgeStatus(s) {
  const map = { pending: ['badge-warning', 'قيد الانتظار'], in_progress: ['badge-info', 'قيد التنفيذ'], completed: ['badge-success', 'مكتمل'] };
  const [cls, label] = map[s] || ['badge-default', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

window.handleOrderImport = async (event) => {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  showLoading();
  let imported = 0, errors = 0;
  for (const file of files) {
    if (!file.name.endsWith('.xlsm') && !file.name.endsWith('.xlsx')) continue;
    try {
      const sheets = await parseExcelFile(file);
      const sheetName = Object.keys(sheets).find(k => k.includes('أمر') || k.includes('طلبية') || k === 'Sheet1') || Object.keys(sheets)[0];
      const rows = sheets[sheetName];
      if (!rows.length) { errors++; continue; }

      // Extract header info from row 5 (0-indexed: row 5 = Excel row 6)
      const hdr = rows[0] || {};
      const customerName = String(hdr['اسم_العميل'] || hdr['العميل'] || hdr[' اسم العميل'] || '').trim();
      const patternCode = String(hdr['الفكرة'] || hdr['نمط_الرسم'] || hdr['كود_التصميم'] || hdr['F'] || '').trim();
      const orderNumber = String(hdr['رقم_الطلب'] || hdr['الطلبية'] || '').trim();
      const rollLength = parseFloat(hdr['طول_الرول'] || hdr['T2'] || 25);

      // Find size headers (row 7 = index 7, C8:L8)
      const sizeRow = rows[7] || {};
      const sizes = [];
      for (let col = 2; col <= 11; col++) {
        const key = String.fromCharCode(65 + col); // C..L
        const val = sizeRow[key];
        if (val) sizes.push(String(val).trim());
      }

      // Process data rows (from row 13 onwards, index 13)
      for (let i = 13; i < rows.length; i++) {
        const r = rows[i];
        const colorName = String(r['B'] || '').trim();
        if (!colorName) continue;

        for (let j = 2; j <= 11; j++) {
          const szKey = String.fromCharCode(65 + j); // C..L
          const pieceCount = parseInt(r[szKey]) || 0;
          if (!pieceCount) continue;

          const sizeLabel = sizes[j - 2] || '';
          const totalBunt = pieceCount * rollLength;
          const itemId = `${file.name}_${i}_${j}`;

          // Upsert design reference
          if (patternCode) {
            await DB.upsertDesign({ code: patternCode, customer: customerName });
          }

          await DB.upsertOrder({
            customer: customerName || 'غير محدد',
            order_number: orderNumber || itemId.slice(0, 8),
            pattern_code: patternCode,
            total_bunt: totalBunt,
            roll_length: rollLength,
            status: 'pending',
          });
          imported++;
        }
      }
    } catch(err) {
      console.error(`Failed to parse ${file.name}:`, err);
      errors++;
    }
  }
  hideLoading();
  showToast(`تم استيراد ${imported} صف بنجاح، ${errors} فشل`, errors ? 'warn' : 'success');
  event.target.value = '';
  renderOrders();
};

window.viewOrder = async (orderId) => {
  const [items] = await Promise.all([DB.getOrderItems(orderId)]);
  const displayItems = items.filter(i => i.order_id === orderId) || [];

  const rows = displayItems.map(it => [
    esc(it.design_code || '-'),
    esc(it.size || '-'),
    fmt(it.total_bunt || 0),
    esc(it.status || 'pending'),
  ]);

  openModal('تفاصيل الطلبية', rows.length
    ? table(['التصميم', 'المقاس', 'البنط', 'الحالة'], rows)
    : emptyState('لا توجد بنود تفصيلية لهذا الطلب.'));
};

window.deleteOrder = async (id) => {
  if (!confirm('هل تريد حذف هذه الطلبية وجميع بنودها؟')) return;
  try {
    const items = await DB.getOrderItems(id);
    for (const it of items || []) await DB.deleteOrderItem(it.id);
    await DB.deleteOrder(id);
    showToast('تم حذف الطلبية', 'success');
    renderOrders();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};
