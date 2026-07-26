import AppShell from './AppShell'

/** Reem & Rania — the partners. Full view of the clinic + the books. */
const links = [
  { to: '/admin/dashboard', label: 'الرئيسية', icon: '🏠' },
  { to: '/admin/reservations', label: 'الحجوزات', icon: '📅' },
  { to: '/admin/payments', label: 'الدفع', icon: '💵' },
  { to: '/admin/patients', label: 'المرضى', icon: '👤' },
  { to: '/admin/accounting', label: 'الحسابات', icon: '💰' },
  { to: '/admin/session-reports', label: 'تقارير الجلسات', icon: '📋' },
  { to: '/admin/timetable', label: 'المواعيد', icon: '🗓️' },
  { to: '/admin/whatsapp', label: 'واتساب', icon: '💬' },
]

export default function AdminLayout() {
  return <AppShell roleLabel="دكتورة / شريكة" links={links} />
}
