// ===== SonDos Textile ERP — Data Layer (Supabase) =====
import { getConfigState, supabaseFetch, uid } from './util.js';

/** Initialise the Supabase client if URL+key are present */
let _supabase = null;
export function getSupabase() {
  if (!_supabase) {
    const cfg = getConfigState();
    if (!cfg.url || !cfg.anonKey) return null;
    // Dynamic import of the CDN-loaded supabase global
    if (typeof window.supabase !== 'undefined') {
      _supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
    }
  }
  return _supabase;
}

/* ── Generic CRUD helpers ─────────────────────────────── */

/** Fetch rows from a table */
export async function fetchTable(table, opts = {}) {
  const sb = getSupabase();
  if (sb) {
    let query = sb.from(table).select(opts.columns ?? '*');
    if (opts.order) query = query.order(opts.order.field, { ascending: opts.order.asc });
    if (opts.filters) {
      Object.entries(opts.filters).forEach(([col, val]) => {
        if (val !== undefined && val !== null) query = query.eq(col, val);
      });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  // Fallback to REST when Supabase client not available
  const q = new URLSearchParams();
  if (opts.filters) Object.entries(opts.filters).forEach(([k,v]) => q.set(k,v));
  if (opts.order) q.set('order', `${opts.order.field},${opts.order.asc ? 'asc' : 'desc'}`);
  const url = `${table}?${q}`;
  const res = await supabaseFetch(url);
  return res.json();
}

/** Insert one row and return it */
export async function insertTable(table, row) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    return data;
  }
  const res = await supabaseFetch(table, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(row) });
  return res.json();
}

/** Update one row by id */
export async function updateTable(table, id, patch) {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(patch),
  });
}

/** Delete one row by id */
export async function deleteTable(table, id) {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
  await supabaseFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

/* ── App-specific tables ─────────────────────────────── */

export const DB = {
  // Settings (singleton stored as config table)
  async getSettings() {
    const rows = await fetchTable('settings');
    const obj = {};
    (rows || []).forEach(r => obj[r.key] = r.value);
    return obj;
  },
  async saveSettings(partial) {
    for (const [k, v] of Object.entries(partial)) {
      await insertTable('settings', { key: k, value: v, updated_at: new Date().toISOString() });
    }
  },

  // Designs
  async getDesigns()     { return fetchTable('designs', { order: { field: 'code', asc: true } }); },
  async upsertDesign(d)  { return d.id ? updateTable('designs', d.id, d) : insertTable('designs', {...d, id: uid(), created_at: new Date().toISOString()}); },
  async deleteDesign(id) { return deleteTable('designs', id); },

  // Customers
  async getCustomers()   { return fetchTable('customers', { order: { field: 'name', asc: true } }); },
  async upsertCustomer(c){ return c.id ? updateTable('customers', c.id, c) : insertTable('customers', {...c, id: uid()}); },
  async deleteCustomer(id){ return deleteTable('customers', id); },

  // Orders (summary-level record per order file)
  async getOrders()      { return fetchTable('orders', { order: { field: 'created_at', asc: false } }); },
  async upsertOrder(o)   { return o.id ? updateTable('orders', o.id, o) : insertTable('orders', {...o, id: uid()}); },
  async deleteOrder(id)  { return deleteTable('orders', id); },

  // Order line items (one per design×size combo within an order)
  async getOrderItems(orderId) {
    return fetchTable('order_items', { filters: { order_id: orderId } });
  },
  async upsertOrderItem(i) {
    return i.id
      ? updateTable('order_items', i.id, i)
      : insertTable('order_items', {...i, id: uid()});
  },
  async deleteOrderItem(id) { return deleteTable('order_items', id); },

  // Weaving queue entries
  async getWeavingEntries(dateFilter) {
    const filter = dateFilter ? { date: dateFilter } : undefined;
    return fetchTable('weaving_entries', {
      filters: filter,
      order: { field: 'created_at', asc: false },
    });
  },
  async upsertWeavingEntry(e) {
    return e.id
      ? updateTable('weaving_entries', e.id, e)
      : insertTable('weaving_entries', {...e, id: uid(), created_at: new Date().toISOString()});
  },
  async deleteWeavingEntry(id) { return deleteTable('weaving_entries', id); },

  // Machines
  async getMachines()    { return fetchTable('machines', { order: { field: 'sort_order', asc: true } }); },
  async upsertMachine(m) { return m.id ? updateTable('machines', m.id, m) : insertTable('machines', {...m, id: uid()}); },
  async deleteMachine(id){ return deleteTable('machines', id); },

  // Users (custom + fixed)
  async getCustomUsers() { return fetchTable('users'); },
  async upsertUser(u)    { return u.id ? updateTable('users', u.id, u) : insertTable('users', {...u, id: uid()}); },
  async deleteUser(id)   { return deleteTable('users', id); },
};

/* ── Excel Import helpers ─────────────────────────────── */

/** Parse a .xlsm / .xlsx file using SheetJS (loaded via CDN) and return sheets as map */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheets = {};
        wb.SheetNames.forEach(name => { sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' }); });
        resolve(sheets);
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Bulk-import order files from the local order directory structure */
export async function bulkImportOrders(folderPath) {
  // folderPath is a File object or list of File objects from <input type="file" webkitdirectory>
  // We use the Files API directly since this runs client-side
  const files = Array.isArray(folderPath) ? folderPath : [folderPath];
  const results = { imported: 0, skipped: 0, errors: [] };
  for (const f of files) {
    if (!f.name.endsWith('.xlsm') && !f.name.endsWith('.xlsx')) continue;
    try {
      const sheets = await parseExcelFile(f);
      // Try common sheet names used in Sondos orders
      const sheetName = Object.keys(sheets).find(k => k.includes('طلبية') || k.includes('order') || k === 'Sheet1') || Object.keys(sheets)[0];
      const rows = sheets[sheetName];
      if (!rows.length) continue;
      const customer = f.webkitRelativePath?.split('\\')[0] || f.webkitRelativePath?.split('/')[0] || 'غير محدد';
      // First row often contains header metadata
      const header = rows[0];
      const isHeaderRow = typeof header['الرمز'] === 'string' || typeof header['كود'] === 'string' || header['اسم_التصميم'];
      const dataRows = isHeaderRow ? rows.slice(1) : rows;
      for (const row of dataRows) {
        const code = String(row['كود_التصميم'] || row['التصميم'] || row['كود'] || '').trim();
        if (!code) continue;
        // Upsert design
        await DB.upsertDesign({ code, customer });
        // Upsert order line item
        const size = row['المقاس'] || row['الحجم'] || '';
        const buntCount = parseFloat(row['إجمالي_البنط'] || row['عدد_البنط'] || row['البنط'] || 0) || 0;
        await DB.upsertOrderItem({
          order_id: uid(), // simplified: one row = one order-line
          customer,
          design_code: code,
          size,
          total_bunt: buntCount,
          status: 'pending',
        });
        results.imported++;
      }
    } catch(err) {
      results.errors.push({ file: f.name, error: err.message });
      results.skipped++;
    }
  }
  return results;
}

/* ── Weaving Queue Calculations ───────────────────────── */

/**
 * Compute weaving queue stats from entries + settings.
 * Returns enriched array ready for display.
 */
export function computeQueueStats(entries, settings) {
  const dailyBuntPerMachine = settings['bunt_per_machine_per_day'] || 90;
  const numMachines = settings['num_machines'] || 4;
  const totalDaily = dailyBuntPerMachine * numMachines;

  return (entries || []).map(e => {
    const pending = Math.max(0, (e.total_bunt || 0) - (e.produced_bunt || 0));
    const completed = !!(e.status === 'completed' || pending === 0);
    const remainingDays = completed ? 0 : Math.ceil(pending / totalDaily);
    return {
      ...e,
      pending_bunt: pending,
      completed,
      remaining_days: remainingDays,
      progress_pct: e.total_bunt ? Math.round(((e.produced_bunt || 0) / e.total_bunt) * 100) : 0,
    };
  });
}

/* ── Dashboard Aggregations ──────────────────────────── */

export async function getDashboardStats() {
  const [orders, designs, customers, weaving] = await Promise.all([
    DB.getOrders(),
    DB.getDesigns(),
    DB.getCustomers(),
    DB.getWeavingEntries(),
  ]);
  const settings = await DB.getSettings();

  const totalOrders = orders?.length || 0;
  const pendingOrders = orders?.filter(o => o.status !== 'completed').length || 0;
  const totalCustomers = customers?.length || 0;
  const totalDesigns = designs?.length || 0;
  const totalBuntPending = (weaving || []).reduce((s, e) => s + Math.max(0, (e.total_bunt||0) - (e.produced_bunt||0)), 0);
  const totalBuntProduced = (weaving || []).reduce((s, e) => s + (e.produced_bunt || 0), 0);

  const dailyCapacity = (settings['bunt_per_machine_per_day'] || 90) * (settings['num_machines'] || 4);

  return {
    totalOrders,
    pendingOrders,
    totalCustomers,
    totalDesigns,
    totalBuntPending,
    totalBuntProduced,
    dailyCapacity,
    estimatedDaysToClear: dailyCapacity ? Math.ceil(totalBuntPending / dailyCapacity) : '-',
  };
}
