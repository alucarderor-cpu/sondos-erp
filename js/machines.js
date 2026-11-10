// ===== SonDos Textile ERP — Machines Configuration =====
import { DB } from './db.js';
import { esc, fmt, showToast } from './util.js';
import { card, table, btn, openModal, closeAllModals, field } from './ui.js';

export async function renderMachines() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري تحميل إعدادات الماكينات...</p></div>';

  try {
    const [machines, settings] = await Promise.all([DB.getMachines(), DB.getSettings()]);
    renderMachinesView(content, machines, settings);
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

function renderMachinesView(el, machines, settings) {
  const buntPerDay = settings['bunt_per_machine_per_day'] || 90;
  const numMachines = settings['num_machines'] || machines.length;
  const totalDaily = buntPerDay * numMachines;

  const rows = machines.map(m => [
    `الماكينة ${esc(m.number || m.sort_order || '-')}`,
    esc(m.model || '-'),
    esc(m.operator || '-'),
    fmt(m.bunt_per_day || buntPerDay),
    m.status === 'active' ? badge('نشطة', 'success') : m.status === 'maintenance' ? badge('صيانة', 'warn') : badge('متوقفة', 'default'),
    `<div class="btn-group">${btn('تعديل', `openEditMachine('${m.id}')`, 'outline-sm')}${btn('حذف', `deleteMachine('${m.id}')`, 'danger-sm')}</div>`,
  ]);

  el.innerHTML = `
    ${card(
      `إعدادات الماكينات (${numMachines} ماكينة)`,
      `
      <div class="summary-box" style="margin-bottom:16px;padding:12px;background:rgba(184,137,43,.1);border-radius:8px;border:1px solid rgba(184,137,43,.3);">
        <strong>ملخص الطاقة:</strong> ${numMachines} ماكينة × ${buntPerDay} بنط/يوم = <strong>${totalDaily} بنط/يوم</strong>
      </div>
      <div id="machines-table">${table(['الماكينة', 'الموديل', 'المشغل', 'البنط اليومي', 'الحالة', ''], rows)}</div>
      `,
      `<div class="btn-group">
        <button class="btn btn-gold" onclick="openAddMachine()">+ إضافة ماكينة</button>
        <button class="btn btn-outline" onclick="openEditSettings()">⚙️ تعديل الإعدادات</button>
      </div>`
    )}
  `;
}

function badge(text, variant) {
  return `<span class="badge badge-${variant}">${esc(text)}</span>`;
}

window.openAddMachine = () => {
  openModal('إضافة ماكينة جديدة', `
    <form id="machine-form">
      ${field('رقم الماكينة', `<input id="m-num" type="number" min="1" required placeholder="1">`)}
      ${field('الموديل / النوع', `<input id="m-model" type="text" placeholder="مثال: SSS-400">`)}
      ${field('اسم المشغل', `<input id="m-operator" type="text" placeholder="اسم المشغل">`)}
      ${field('البنط اليومي الافتراضي', `<input id="m-bunt" type="number" min="1" value="90" required>`)}
      ${field('الحالة', `
        <select id="m-status">
          <option value="active">نشطة</option>
          <option value="maintenance">صيانة</option>
          <option value="inactive">متوقفة</option>
        </select>
      `)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveMachine()">حفظ</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveMachine = async () => {
  const num = parseInt(document.getElementById('m-num').value) || 0;
  if (!num) { showToast('يرجى إدخال رقم الماكينة', 'error'); return; }
  try {
    await DB.upsertMachine({
      number: num,
      model: document.getElementById('m-model').value.trim(),
      operator: document.getElementById('m-operator').value.trim(),
      bunt_per_day: parseInt(document.getElementById('m-bunt').value) || 90,
      status: document.getElementById('m-status').value,
      sort_order: num,
    });
    closeAllModals();
    showToast('تم إضافة الماكينة', 'success');
    renderMachines();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};

window.openEditMachine = async (id) => {
  const machines = await DB.getMachines();
  const m = machines.find(x => x.id === id);
  if (!m) return;

  openModal('تعديل الماكينة', `
    <form id="machine-edit-form">
      <input type="hidden" id="m-eid" value="${esc(id)}">
      ${field('رقم الماكينة', `<input id="m-enums" type="number" value="${m.number || ''}" disabled>`)}
      ${field('الموديل', `<input id="m-emodel" type="text" value="${esc(m.model || '')}">`)}
      ${field('المشغل', `<input id="m-eoperator" type="text" value="${esc(m.operator || '')}">`)}
      ${field('البنط اليومي', `<input id="m-ebunt" type="number" value="${m.bunt_per_day || 90}">`)}
      ${field('الحالة', `
        <select id="m-estatus">
          <option value="active" ${m.status === 'active' ? 'selected' : ''}>نشطة</option>
          <option value="maintenance" ${m.status === 'maintenance' ? 'selected' : ''}>صيانة</option>
          <option value="inactive" ${m.status === 'inactive' ? 'selected' : ''}>متوقفة</option>
        </select>
      `)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="updateMachine()">تحديث</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.updateMachine = async () => {
  const id = document.getElementById('m-eid').value;
  try {
    await DB.upsertMachine({
      id,
      model: document.getElementById('m-emodel').value.trim(),
      operator: document.getElementById('m-eoperator').value.trim(),
      bunt_per_day: parseInt(document.getElementById('m-ebunt').value) || 90,
      status: document.getElementById('m-estatus').value,
    });
    closeAllModals();
    showToast('تم تحديث الماكينة', 'success');
    renderMachines();
  } catch(err) { showToast('فشل التحديث: ' + err.message, 'error'); }
};

window.deleteMachine = async (id) => {
  if (!confirm('هل تريد حذف هذه الماكينة؟')) return;
  try {
    await DB.deleteMachine(id);
    showToast('تم حذف الماكينة', 'success');
    renderMachines();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};

window.openEditSettings = () => {
  openModal('إعدادات إنتاج الماكينات', `
    <form id="settings-form">
      ${field('عدد الماكينات النشطة', `<input id="s-num-machines" type="number" min="1" max="50" value="4">`)}
      ${field('بنط اليوم الواحد لكل ماكينة', `<input id="s-bunt-per-day" type="number" min="1" value="90">`)}
      <div style="margin-top:8px;color:#aaa;font-size:.85rem;">💡 الطاقة اليومية الإجمالية = عدد الماكينات × بنط اليوم للماكينة</div>
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveMachineSettings()">حفظ الإعدادات</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveMachineSettings = async () => {
  const num = parseInt(document.getElementById('s-num-machines').value) || 4;
  const bunt = parseInt(document.getElementById('s-bunt-per-day').value) || 90;
  try {
    await DB.saveSettings({ num_machines: num, bunt_per_machine_per_day: bunt });
    closeAllModals();
    showToast('تم حفظ الإعدادات', 'success');
    renderMachines();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};
