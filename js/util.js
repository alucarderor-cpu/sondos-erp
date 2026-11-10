// ===== SonDos Textile ERP — Utilities =====
import { CONFIG } from './config.js';

const ENC = new TextEncoder();

/** Compute PBKDF2 hash for a given password against stored salt. Returns hex string. */
export async function computeHash(password, saltHex) {
  const buf = await crypto.subtle.importKey('raw', ENC.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = hexToArray(saltHex);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    buf, 256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToArray(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

/** Verify password against stored user record */
export async function verifyPassword(userObj, password) {
  const computed = await computeHash(password, userObj.salt);
  return computed === userObj.hash;
}

export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format number as integer or compact form */
export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '-';
  return Number(n).toLocaleString('ar-EG', { maximumFractionDigits: decimals });
}

/** Format date from Date object to Arabic locale */
export function fmtDate(d) {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Format datetime to Arabic locale */
export function fmtDateTime(d) {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) +
         ' ' + dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

/** Get current user session data from localStorage */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('sondos_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Save session */
export function setCurrentUser(user) {
  localStorage.setItem('sondos_session', JSON.stringify(user));
}

/** Clear session (logout) */
export function clearSession() {
  localStorage.removeItem('sondos_session');
}

/** Check if current user has at least the required role level */
export function hasRole(requiredRole) {
  const user = getCurrentUser();
  if (!user) return false;
  return (CONFIG.ROLES[user.role] ?? 0) >= (CONFIG.ROLES[requiredRole] ?? 0);
}

/** Generate unique ID */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Delay helper */
export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Show toast notification */
export function showToast(msg, type = 'info') {
  let toast = document.getElementById('sondos-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sondos-toast';
    toast.style.cssText = `
      position:fixed;top:70px;left:50%;transform:translateX(-50%);
      padding:10px 24px;border-radius:8px;font-size:.88rem;z-index:9999;
      font-family:var(--font-body);box-shadow:0 4px 16px rgba(0,0,0,.4);
      transition:opacity .3s;opacity:0;pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  const colors = { success: '#1a4a3a', error: '#4a1a1a', info: '#1a3a4a', warn: '#4a3a1a' };
  const texts = { success: '✓', error: '✗', info: 'ℹ', warn: '⚠' };
  toast.style.background = colors[type] || colors.info;
  toast.style.color = '#fff';
  toast.textContent = `${texts[type] || ''} ${msg}`;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

/** Fetch wrapper with auth header for Supabase REST calls */
export async function supabaseFetch(url, options = {}) {
  const cfg = getConfigState();
  if (!cfg.url || !cfg.anonKey) throw new Error('Supabase is not configured. Go to الإعدادات أولاً.');
  const headers = {
    'apikey': cfg.anonKey,
    'Authorization': `Bearer ${cfg.anonKey}`,
    'Prefer': 'return=representation',
    ...options.headers,
  };
  const res = await fetch(`${cfg.url}/rest/v1/${url}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}: ${res.statusText}`);
  }
  return res;
}

/** Load global config state from localStorage */
export function getConfigState() {
  try {
    const raw = localStorage.getItem('sondos_config');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Save global config state to localStorage */
export function saveConfigState(cfg) {
  localStorage.setItem('sondos_config', JSON.stringify(cfg));
}
