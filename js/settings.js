// ===== SonDos Textile ERP — Settings (Supabase Connection) =====
import { DB, getSupabase } from './db.js';
import { getConfigState, saveConfigState, showToast } from './util.js';
import { card, field, btn, openModal, closeAllModals } from './ui.js';

export async function renderSettings() {
  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>جاري التحميل...</p></div>';

  const cfg = getConfigState();
  const connected = !!getSupabase();

  content.innerHTML = card(
    'إعدادات الربط وقاعدة البيانات',
    `
    <div style="margin-bottom:16px;">
      ${connected
        ? '<div class="badge badge-success" style="padding:6px 12px;">✓ متصل بقاعدة بيانات Supabase</div>'
        : '<div class="badge badge-warning" style="padding:6px 12px;">⚠ غير متصل — العمل محلي فقط</div>'}
    </div>
    <form id="settings-form">
      ${field('Supabase URL', `<input id="s-url" type="url" value="${esc(cfg.url || '')}" placeholder="https://xxxx.supabase.co">`)}
      ${field('Anon Key', `<input id="s-anon" type="password" value="${esc(cfg.anonKey || '')}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6...">`)}
      <div style="margin-top:12px;padding:12px;background:rgba(184,137,43,.08);border-radius:6px;font-size:.85rem;color:#ccc;">
        💡 احصل على URL و Anon Key من لوحة تحكم Supabase → Project Settings → API
      </div>
    </form>
    `,
    `<div class="btn-group">
      <button class="btn btn-gold" onclick="testConnection()">🔗 اختبار الاتصال</button>
      <button class="btn btn-gold" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>`
  );
}

window.saveSettings = () => {
  const url = document.getElementById('s-url').value.trim();
  const anonKey = document.getElementById('s-anon').value.trim();
  saveConfigState({ url, anonKey });
  showToast('تم حفظ إعدادات الربط', 'success');
};

window.testConnection = async () => {
  const url = document.getElementById('s-url').value.trim();
  const anonKey = document.getElementById('s-anon').value.trim();
  if (!url || !anonKey) { showToast('يرجى إدخال URL و Anon Key أولاً', 'error'); return; }

  showToast('جاري اختبار الاتصال...', 'info');
  try {
    saveConfigState({ url, anonKey });
    // Force re-init supabase client
    window._supabase = null;
    const sb = getSupabase();
    if (!sb) throw new Error('تعذر تهيئة العميل');
    const { data, error } = await sb.from('settings').select('count').limit(1);
    if (error) throw error;
    showToast('✅ اتصل بقاعدة البيانات بنجاح!', 'success');
  } catch(err) {
    showToast('❌ فشل الاتصال: ' + err.message, 'error');
  }
};
