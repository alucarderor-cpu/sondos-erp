// ===== SonDos Textile ERP — Designs Database =====
import { DB } from './db.js';
import { esc, fmt, showToast } from './util.js';
import { card, table, btn, openModal, closeAllModals, field, showLoading, hideLoading } from './ui.js';

export async function renderDesigns() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري تحميل قاعدة التصاميم...</p></div>';

  try {
    const designs = await DB.getDesigns();
    renderDesignsView(content, designs);
  } catch(err) {
    content.innerHTML = `<div class="empty-state" style="color:#f66;">${esc(err.message)}</div>`;
  }
}

function renderDesignsView(el, designs) {
  if (!designs.length) {
    el.innerHTML = card('قاعدة التصاميم',
      emptyState('لا توجد تصاميم بعد. أضف تصميماً جديداً أو استورد من ملفات الطلبات.'),
      btn('+ إضافة تصميم', 'openAddDesign()', 'gold')
    );
    return;
  }

  const rows = designs.map(d => [
    `<div class="design-code">${esc(d.code || '-')}</div>`,
    esc(d.description || '-'),
    fmt(d.gsm || 0),
    fmt(d.width_cm || 0),
    `<div class="color-swatches">${(d.colors || []).map(c => `<span class="color-swatch" style="background:${esc(c.color_hex || '#888')};" title="${esc(c.name)}"></span>`).join('')}</div>` || '-',
    esc(d.customer || '-'),
    btn('تعديل', `openEditDesign('${d.id}')`, 'outline-sm'),
    btn('حذف', `deleteDesign('${d.id}','${esc(d.code)}')`, 'danger-sm'),
  ]);

  el.innerHTML = card(
    `قاعدة التصاميم (${designs.length})`,
    `<div id="designs-table">${table(['كود التصميم', 'الوصف', 'الوزن (غ/م²)', 'العرض (سم)', 'الألوان', 'العميل', '', ''], rows)}</div>`,
    `<div class="btn-group">${btn('+ إضافة تصميم', 'openAddDesign()', 'gold')}${btn('🔄 تحديث', 'renderDesigns()', 'outline')}</div>`
  );
}

function emptyState(msg) {
  return `<div class="text-center text-mute mt-2 mb-2" style="padding:40px;">${esc(msg)}</div>`;
}

window.openAddDesign = () => {
  openModal('إضافة تصميم جديد', `
    <form id="design-form">
      ${field('كود التصميم (مسنن الرسم)', `<input id="des-code" type="text" required placeholder="مثال: 1250">`)}
      ${field('وصف التصميم', `<input id="des-desc" type="text" placeholder="وصف مختصر">`)}
      ${field('الوزن (غرام/م²)', `<input id="des-gsm" type="number" placeholder="مثال: 280">`)}
      ${field('العرض (سم)', `<input id="des-width" type="number" placeholder="مثال: 300">`)}
      ${field('لون التصميم الأساسي', `
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="des-color-hex" type="color" value="#8B4513" style="width:40px;height:32px;border:none;cursor:pointer;">
          <input id="des-color-name" type="text" placeholder="اسم اللون بالعربي" style="flex:1;">
        </div>
      `)}
      ${field('اسم العميل المرتبط', `<input id="des-customer" type="text" placeholder="اختياري">`)}
      ${field('صورة التصميم', `<input id="des-image" type="file" accept="image/*" style="font-size:.85rem;">`)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="saveDesign()">حفظ</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.saveDesign = async () => {
  const code = document.getElementById('des-code').value.trim();
  if (!code) { showToast('يرجى إدخال كود التصميم', 'error'); return; }

  const colorHex = document.getElementById('des-color-hex').value;
  const colorName = document.getElementById('des-color-name').value.trim();
  const imageFile = document.getElementById('des-image').files[0];

  const design = {
    code,
    description: document.getElementById('des-desc').value.trim(),
    gsm: parseFloat(document.getElementById('des-gsm').value) || null,
    width_cm: parseFloat(document.getElementById('des-width').value) || null,
    colors: colorHex ? [{ name: colorName || colorHex, color_hex: colorHex }] : [],
    customer: document.getElementById('des-customer').value.trim() || null,
  };

  try {
    if (imageFile) {
      design.image_data = await readFileAsDataURL(imageFile);
    }
    await DB.upsertDesign(design);
    closeAllModals();
    showToast('تم حفظ التصميم بنجاح', 'success');
    renderDesigns();
  } catch(err) { showToast('فشل الحفظ: ' + err.message, 'error'); }
};

window.openEditDesign = async (id) => {
  const designs = await DB.getDesigns();
  const d = designs.find(x => x.id === id);
  if (!d) return;

  openModal('تعديل التصميم', `
    <form id="design-edit-form">
      <input type="hidden" id="des-eid" value="${esc(id)}">
      ${field('كود التصميم', `<input id="des-ecode" type="text" value="${esc(d.code || '')}" required>`)}
      ${field('الوصف', `<input id="des-edesc" type="text" value="${esc(d.description || '')}">`)}
      ${field('الوزن (غ/م²)', `<input id="des-egsm" type="number" value="${d.gsm || ''}">`)}
      ${field('العرض (سم)', `<input id="des-ewidth" type="number" value="${d.width_cm || ''}">`)}
      ${field('صورة جديدة (اختياري)', `<input id="des-eimage" type="file" accept="image/*">`)}
    </form>
  `, `
    <button class="btn btn-gold" onclick="updateDesign()">تحديث</button>
    <button class="btn btn-outline" onclick="closeAllModals()">إلغاء</button>
  `);
};

window.updateDesign = async () => {
  const id = document.getElementById('des-eid').value;
  const imageFile = document.getElementById('des-eimage').files[0];
  try {
    const existing = await DB.getDesigns();
    const d = existing.find(x => x.id === id);
    const patch = {
      code: document.getElementById('des-ecode').value.trim(),
      description: document.getElementById('des-edesc').value.trim(),
      gsm: parseFloat(document.getElementById('des-egsm').value) || null,
      width_cm: parseFloat(document.getElementById('des-ewidth').value) || null,
    };
    if (imageFile) patch.image_data = await readFileAsDataURL(imageFile);
    await DB.upsertDesign({ id, ...patch });
    closeAllModals();
    showToast('تم تحديث التصميم', 'success');
    renderDesigns();
  } catch(err) { showToast('فشل التحديث: ' + err.message, 'error'); }
};

window.deleteDesign = async (id, code) => {
  if (!confirm(`هل تريد حذف التصميم "${code}"؟`)) return;
  try {
    await DB.deleteDesign(id);
    showToast('تم حذف التصميم', 'success');
    renderDesigns();
  } catch(err) { showToast('فشل الحذف: ' + err.message, 'error'); }
};

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
