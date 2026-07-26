import AppShell from './AppShell'

/** The assistant only ever needs two screens: book, and take the money. */
const links = [
  { to: '/staff/reservations', label: 'الحجوزات', icon: '📅' },
  { to: '/staff/payments', label: 'الدفع', icon: '💰' },
]

export default function StaffLayout() {
  return <AppShell roleLabel="الأسيستانت" links={links} />
}
