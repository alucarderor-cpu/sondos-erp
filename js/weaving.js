// ===== SonDos Textile ERP — Weaving Queue (Daily Recording) =====
import { DB, computeQueueStats } from './db.js';
import { esc, fmt, fmtDateTime, fmtDate, showToast } from './util.js';
import { card, table, btn, openModal, closeAllModals, field, showLoading, hideLoading, initTabs } from './ui.js';

export async function renderWeaving() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري تحميل سجل القصات...</p></div>';

  try {
    const [entriesRaw, settings] = await Promise.all([DB.getWeavingEntries(), DB.getSettings()]);
    const entries = computeQueueStats(entriesRaw, settings);
    renderWeavingView(content, entries, settings);
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

function renderWeavingView(el, entries, settings) {
  const dailyCap = (settings['bunt_per_machine_per_day'] || 90) * (settings['num_machines'] || 4);

  // Filter tabs
  const today = new Date().toISOString().slice(0, 10);
  const pending = entries.filter(e => !e.completed);
  const completed = entries.filter(e => e.completed);

  el.innerHTML = `
    ${card(
      `سجل القصات اليومي — ${fmtDate(new Date())}`,
      `
      <div class="tabs-container" id="weaving-tabs">
        <button class="tab active" data-panel="panel-pending">قيد التنفيذ (${pending.length})</button>
        <button class="tab" data-panel="panel-completed">مكتملة (${completed.length})</button>
      </div>
      <div class="tab-panel active" id="panel-pending">
        ${pending.length ? renderingTable(pending, settings) : emptyState('لا يوجد.entries قيد التنفيذ')}
      </div>
      <div class="tab-panel" id="panel-completed">
        ${completed.length ? renderingTable(completed, settings) : emptyState('لا يوجد.entries مكتملة بعد')}
      </div>
      `,
      `<div class="btn-group">
        <button class="btn btn-gold" onclick="openAddWeaving()">+ إضافة قاصة جديدة</button>
        <button class="btn btn-outline" onclick="renderWeaving()">🔄 تحديث</button>
        <button class="btn btn-outline" onclick="loadWeavingFromExcel()">📂 استيراد من Excel</button>
      </div>`
    )}
  `;
  initTabs(document.getElementById('weaving-tabs'));
}

function renderingTable(entries, settings) {
  const dailyPerMachine = settings['bunt_per_machine_per_day'] || 90;
  const numMachines = settings['num_machines'] || 4;

  const rows = entries.map(e => [
    esc(e.date || '-'),
    esc(e.customer || '-'),
    esc(e.order_number || '-'),
    esc(e.cut_id || e.design_code || '-'),
    `${fmt(e.total_bunt || 0)} / ${fmt(e.produced_bunt || 0)}`,
    esc(e.machine_no || '-'),
    esc(e.position || '-'),
    `${e.progress_pct || 0}%`,
    e.completed ? badge('مكتمل', 'success') : badge(`${e.remaining_days ?? '-'} يوم`, 'warn'),
    `<div class="btn-group">${btn('تعديل', `openEditWeaving('${e.id}')`, 'outline-sm')}${btn('حذف', `deleteWeaving('${e.id}')`, 'danger-sm')}</div>`,
  ]);

  return table([
    'التاريخ', 'العميل', 'رقم الطلب', 'التصميم', 'البنط (منتج/إجمالي)', 'الماكينة', 'المركز', 'النسبة %', 'الموعد المتوقع', ''
  ], rows);
}

function emptyState(msg) {
  return `<div class="text-center text-mute mt-2 mb-2" style="padding:40px;">${esc(msg)}</div>`;
}

function badge(text, variant) {
  return `<span class="badge badge-${variant}">${esc(text)}</span>`;
}

window.openAddWeaving = () => {
  openModal('إضافة قاصة جديدة', `
    <form id="weaving-form">
      ${field('تاريخ الإدخال', `<input id="w-date" type="date" value="${new Date().toISOString().slice(0,10)}" required>`)}
      ${field('اسم العميل', `<input id="w-customer" type="text" required placeholder="اسم العميل">`)}
      ${field('رقم الطلب', `<input id="w-order" type="text" placeholder="رقم الطلبية">`)}
      ${field('رقم القصة / التصميم', `<input id="w-cut-id" type="text" placeholder="كود التصميم أو رقم القصة">`)}
      ${field('مسنن الرسم', `<input id="w-density" type="number" step="0.1" placeholder="مثال: 1250">`)}
      ${field('مسنن البنط', `<input id="w-yarn-density" type="number" step="0.1" placeholder="مثال: 1246.5">`)}
      ${field('الماكينة رقم', `<input id="w-machine" type="number" min="1" max="20" value="1">`)}
      ${field('المركز على الماكينة', `<input id="w-position" type="number" min="1" placeholder="ترتيب البنت على الرول">`)}
      ${field('إجمالي البنط المطلوب', `<input id="w-total-bunt" type="number" min="1" required placeholder="إجمالي عدد البنط">`)}
      ${field('البنط المنتج حتى الآن', `<input id="w-produced-bunt" type="number" min="0" value="0" placeholder="0">`)}
      ${field('ملاحظات', `<textarea id="w-notes" rows="2" placeholder="أي ملاحظات إضافية..."></textarea>`)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveWeavingEntry()">حفظ</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveWeavingEntry = async () => {
  const density = parseFloat(document.getElementById('w-density').value) || 0;
  const yarnDensity = parseFloat(document.getElementById('w-yarn-density').value) || 0;
  const totalBunt = parseInt(document.getElementById('w-total-bunt').value) || 0;
  const producedBunt = parseInt(document.getElementById('w-produced-bunt').value) || 0;

  if (!density || density <= 0) { showToast('يرجى إدخال مسنن الرسم', 'error'); return; }
  if (!totalBunt || totalBunt <= 0) { showToast('يرجى إدخال إجمالي البنط', 'error'); return; }

  const m2 = Math.round((800 / (yarnDensity + 3.5)) * 100) / 100;

  const entry = {
    date: document.getElementById('w-date').value,
    customer: document.getElementById('w-customer').value.trim(),
    order_number: document.getElementById('w-order').value.trim(),
    cut_id: document.getElementById('w-cut-id').value.trim(),
    density_draw: density,
    density_yarn: yarnDensity,
    meter_squared: m2,
    machine_no: document.getElementById('w-machine').value,
    position: document.getElementById('w-position').value,
    total_bunt: totalBunt,
    produced_bunt: producedBunt,
    notes: document.getElementById('w-notes').value.trim(),
  };

  try {
    await DB.upsertWeavingEntry(entry);
    closeAllModals();
    showToast('تم حفظ القاصة بنجاح', 'success');
    renderWeaving();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};

window.openEditWeaving = async (id) => {
  const entries = await DB.getWeavingEntries();
  const e = entries.find(x => x.id === id);
  if (!e) return;

  openModal('تعديل القاصة', `
    <form id="weaving-edit-form">
      <input type="hidden" id="w-eid" value="${esc(id)}">
      ${field('البنط المنتج', `<input id="w-edited-produced" type="number" value="${e.produced_bunt || 0}" min="0">`)}
      ${field('ملاحظات', `<textarea id="w-edited-notes" rows="2">${esc(e.notes || '')}</textarea>`)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="updateWeavingEntry()">تحديث</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.updateWeavingEntry = async () => {
  const id = document.getElementById('w-eid').value;
  try {
    await DB.upsertWeavingEntry({
      id,
      produced_bunt: parseInt(document.getElementById('w-edited-produced').value) || 0,
      notes: document.getElementById('w-edited-notes').value.trim(),
    });
    closeAllModals();
    showToast('تم تحديث القاصة', 'success');
    renderWeaving();
  } catch(err) { showToast('فشل التحديث: ' + err.message, 'error'); }
};

window.deleteWeaving = async (id) => {
  if (!confirm('هل تريد حذف هذه القاصة؟')) return;
  try {
    await DB.deleteWeavingEntry(id);
    showToast('تم الحذف', 'success');
    renderWeaving();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};

window.loadWeavingFromExcel = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsm,.xlsx';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showLoading();
    try {
      const wb = XLSX.readFile(file);
      const ws = wb.Sheets['القصات'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      let imported = 0;
      for (const r of rows) {
        const totalBunt = parseInt(r['إجمالي_البنط'] || r['البنط']) || 0;
        if (!totalBunt) continue;
        const yarnD = parseFloat(r['مسنن_البنط']) || parseFloat(r['بنط']) || 0;
        const drawD = parseFloat(r['مسنن_الرسم']) || parseFloat(r['رسم']) || 0;
        const m2 = yarnD > 0 ? Math.round((800 / (yarnD + 3.5)) * 100) / 100 : 0;

        await DB.upsertWeavingEntry({
          date: r['تاريخ_الإدخال'] || new Date().toISOString().slice(0,10),
          customer: String(r['العميل'] || ''),
          order_number: String(r['رقم_الطلب'] || ''),
          cut_id: String(r['رقم_القصة'] || r['التصميم'] || ''),
          density_draw: drawD,
          density_yarn: yarnD,
          meter_squared: m2,
          machine_no: String(r['الماكينة'] || ''),
          position: String(r['ترتيب_على_الماكينة'] || ''),
          total_bunt: totalBunt,
          produced_bunt: parseInt(r['بنط_منتج']) || 0,
          notes: String(r['ملاحظات'] || ''),
        });
        imported++;
      }
      hideLoading();
      showToast(`تم استيراد ${imported} قاصة بنجاح`, 'success');
      renderWeaving();
    } catch(err) {
      hideLoading();
      showToast('فشل الاستيراد: ' + err.message, 'error');
    }
  };
  input.click();
};
