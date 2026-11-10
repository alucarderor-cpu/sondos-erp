// ===== SonDos Textile ERP — Configuration =====

export const CONFIG = {
  companyName: 'شركة السندس كاربت لصناعة و نسج السجاد الفاخر',
  shortName: 'السندس كاربت',

  // Default settings (fallback if not set in Supabase)
  defaultSettings: {
    buntPerMachinePerDay: 90,
    numMachines: 4,
    machines: [1, 2, 3, 4],
    machineIds: ['101','102','103','104'], // visible labels
  },

  // User roles hierarchy
  ROLES: {
    viewer: 0,
    editor: 1,
    admin: 2,
    owner: 3,
  },

  ROLE_LABELS: {
    viewer: 'مشاهد',
    editor: 'محرر',
    admin: 'مدير',
    owner: 'مالك النظام',
  },

  // Hashed passwords (PBKDF2-SHA256). Never change by hand — use /tools/password-hash instead.
  users: [
    {
      id: 'alucard',
      username: 'Alucard',
      label: 'مدير النظام',
      role: 'owner',
      salt: 'a37389f27d7eb1549ca98a95ed5508e9',
      hash: 'a7c65d797e8116ba1c77229f7e8fb844fab1fd077c4581642c29c68e1137fb36',
    },
    {
      id: 'sondos_user',
      username: 'Sondos User',
      label: 'مستخدم العرض',
      role: 'viewer',
      salt: 'ea2b44786a4568ba22eed75019a309f3',
      hash: '1c8bbccec3642711417296ba3d29fab909494afc1984ec0d6b0699d804fd7988',
    },
  ],

  // Supabase (configured at runtime via UI Settings page)
  supabaseUrl: null,
  supabaseKey: null,
};

// Page navigation definitions
export const NAV_PAGES = [
  // Reports section
  { id: 'overview', title: 'الرئيسية', icon: '📊', section: 'تقارير', minRole: 'viewer' },
  { id: 'customers', title: 'العملاء والطلبيات', icon: '👥', section: 'تقارير', minRole: 'viewer' },
  { id: 'weaving', title: 'تسجيل القصات اليومي', icon: '🧵', section: 'الإدارة', minRole: 'editor' },
  { id: 'designs', title: 'قاعدة التصاميم', icon: '🎨', section: 'الإدارة', minRole: 'editor' },
  { id: 'orders', title: 'إدارة الطلبيات', icon: '📋', section: 'الإدارة', minRole: 'editor' },
  { id: 'machines', title: 'كونفجريشن الماكينات', icon: '⚙️', section: 'الإدارة', minRole: 'admin' },
  { id: 'users', title: 'المستخدمين', icon: '🔐', section: 'الإدارة', minRole: 'owner' },
  { id: 'settings', title: 'إعدادات الربط', icon: '🔗', section: 'الإدارة', minRole: 'admin' },
];
