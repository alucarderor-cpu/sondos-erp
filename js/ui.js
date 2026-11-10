// ===== SonDos Textile ERP — UI Primitives =====
import { esc, fmt, fmtDate } from './util.js';

/* ── Table Builder ───────────────────────────────────── */
export function table(headers, rows, footers = []) {
  const th = headers.map(h => `<th>${esc(h)}</th>`).join('');
  const tr = (rows || []).map(r => {
    const td = headers.map((_, i) => `<td>${esc(r[i])}</td>`).join('');
    return `<tr>${td}</tr>`;
  }).join('');
  const tf = footers.length
    ? footers.map(f => `<tr class="tfoot-row"><td colspan="${headers.length}">${f}</td></tr>`).join('')
    : '';
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tf}</table>`;
}

/* ── KPI Tiles ────────────────────────────────────────── */
export function kpis(items) {
  return `<div class="kpis">${items.map(it => `
    <div class="kpi ${it.variant || ''}">
      <div class="kpi-label">${esc(it.label)}</div>
      <div class="kpi-value">${esc(String(it.value))}<span class="kpi-unit">${esc(it.unit || '')}</span></div>
    </div>`).join('')}</div>`;
}

/* ── Card Shell ───────────────────────────────────────── */
export function card(title, bodyHtml, actions = '') {
  const hdr = title
    ? `<div class="card-header"><div class="card-title">${esc(title)}</div><div class="btn-group">${actions}</div></div>`
    : '';
  return `<div class="card">${hdr}${bodyHtml}</div>`;
}

/* ── Empty State ──────────────────────────────────────── */
export function empty(msg = 'لا توجد بيانات بعد.') {
  return `<div class="text-center text-mute mt-2 mb-2" style="padding:40px;">${esc(msg)}</div>`;
}

/* ── Button Groups ─────────────────────────────────────── */
export function btn(label, onClick, variant = 'primary') {
  return `<button class="btn btn-${variant}" onclick="${onClick}">${label}</button>`;
}

/* ── Modal ─────────────────────────────────────────────── */
export function openModal(title, bodyHtml, actions = '') {
  closeAllModals();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close" onclick="closeAllModals()">✕</button>
      <div class="modal-title">${esc(title)}</div>
      <div>${bodyHtml}</div>
      ${actions ? `<div class="form-actions mt-2">${actions}</div>` : ''}
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAllModals(); });
  document.body.appendChild(overlay);
  return overlay;
}

export function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
}

/* ── Loading Overlay ───────────────────────────────────── */
export function showLoading(parent, msg = 'جاري التحميل...') {
  const el = document.createElement('div');
  el.className = 'loading-screen';
  el.id = 'loading-overlay';
  el.innerHTML = `<div class="spinner"></div><p>${esc(msg)}</p>`;
  (parent || document.getElementById('page-content')).appendChild(el);
}

export function hideLoading() {
  document.querySelectorAll('#loading-overlay').forEach(el => el.remove());
}

/* ── Badge Renderer ─────────────────────────────────────── */
export function badge(text, variant = 'info') {
  return `<span class="badge badge-${variant}">${esc(text)}</span>`;
}

/* ── Status Dot ────────────────────────────────────────── */
export function statusDot(color) {
  return `<span class="status-dot ${color}"></span>`;
}

/* ── Form Field Helper ─────────────────────────────────── */
export function field(label, inputHtml, note = '') {
  const n = note ? `<div class="text-mute" style="font-size:.78rem;margin-top:3px;">${esc(note)}</div>` : '';
  return `<div class="field"><label>${esc(label)}</label>${inputHtml}${n}</div>`;
}

/* ── Tab Panel Controller ──────────────────────────────── */
export function initTabs(containerEl) {
  containerEl.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      containerEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      containerEl.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = containerEl.querySelector(`#${esc(tab.dataset.panel)}`);
      if (target) target.classList.add('active');
    });
  });
}

/* ── Download HTML as file ─────────────────────────────── */
export function downloadAsFile(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
