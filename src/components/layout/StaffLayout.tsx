import AppShell from './AppShell'

/**
 * Two screens, one per moment: the day in front of her, and the diary.
 *
 * Money has no page of its own here. Pricing a session and taking the payment
 * are the same act at the desk, so both happen in the close-session sheet on
 * «يوم العيادة» — which also lists everything still owed from earlier days
 * under «مطلوب تحصيل». A separate «الدفع» screen only split one job in two.
 */
const links = [
  { to: '/staff/clinic-day', label: 'يوم العيادة', icon: '🩺' },
  { to: '/staff/reservations', label: 'الحجوزات', icon: '📅' },
]

export default function StaffLayout() {
  return <AppShell roleLabel="الأسيستانت" links={links} />
}
