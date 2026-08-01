import AppShell from './AppShell'

/**
 * Three screens, one per moment: the day in front of her (where she closes
 * sessions and takes the money), the diary, and the collections follow-up.
 */
const links = [
  { to: '/staff/clinic-day', label: 'يوم العيادة', icon: '🩺' },
  { to: '/staff/reservations', label: 'الحجوزات', icon: '📅' },
  { to: '/staff/payments', label: 'الدفع', icon: '💰' },
]

export default function StaffLayout() {
  return <AppShell roleLabel="الأسيستانت" links={links} />
}
