// Daftar role (satu sumber). Dipakai Pengaturan → Pengguna, label di sidebar, dan tes.
// Role hanya bisa diubah admin (dijaga trigger users_guard di database).
export const ROLES = [
  { value: 'operational', label: 'Operational Assistant', divisi: 'OPR' },
  { value: 'procurement', label: 'Procurement', divisi: 'PRC' },
  { value: 'corporate_secretary', label: 'Corporate Secretary', divisi: 'ADM' },
  { value: 'finance', label: 'Finance & Accounting', divisi: 'FIN' },
  { value: 'coo', label: 'COO', divisi: null },
  { value: 'cao', label: 'CAO', divisi: null },
  { value: 'cfo', label: 'CFO', divisi: null },
  { value: 'ceo', label: 'CEO', divisi: null },
]
export const ROLE_VALUES = ROLES.map((r) => r.value)
export const BELUM_ADA_ROLE = 'Belum ada role'

export function labelRole(value) {
  if (!value) return BELUM_ADA_ROLE
  return ROLES.find((r) => r.value === value)?.label || value
}

// Admin boleh: ubah role siapa pun; cabut admin selama masih ada admin lain.
export function bolehCabutAdmin(target, users) {
  if (!target?.is_admin) return false
  return users.filter((u) => u.is_admin).length > 1
}
