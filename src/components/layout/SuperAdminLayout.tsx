import AppShell from './AppShell'

const links = [
  { to: '/super-admin/dashboard', label: 'الرئيسية', icon: '🏠' },
  { to: '/super-admin/clinic-day', label: 'يوم العيادة', icon: '🩺' },
  { to: '/super-admin/reservations', label: 'الحجوزات', icon: '📅' },
  { to: '/super-admin/payments', label: 'الدفع', icon: '💵' },
  { to: '/super-admin/patients', label: 'المرضى', icon: '👤' },
  { to: '/super-admin/accounting', label: 'الحسابات', icon: '💰' },
  { to: '/super-admin/services', label: 'الخدمات', icon: '✨' },
  { to: '/super-admin/admins', label: 'الفريق', icon: '👩‍💼' },
  // { to: '/super-admin/reports', label: 'تقارير الجلسات', icon: '📋' },
  // { to: '/super-admin/reviews', label: 'التقييمات', icon: '⭐' },
  // { to: '/super-admin/contact-requests', label: 'طلبات التواصل', icon: '📬' },
]

export default function SuperAdminLayout() {
  return <AppShell roleLabel="المدير العام" links={links} />
}
