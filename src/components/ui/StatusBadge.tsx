const configs: Record<string, { label: string; bg: string; color: string }> = {
  // Reservation status
  pending:   { label: 'في الانتظار', bg: '#FEF3C7', color: '#92400E' },
  confirmed: { label: 'مؤكد', bg: '#D1FAE5', color: '#065F46' },
  completed: { label: 'تمت', bg: '#DBEAFE', color: '#1E40AF' },
  cancelled: { label: 'ملغي', bg: '#FEE2E2', color: '#991B1B' },
  // Payment status
  unpaid:    { label: 'لسه مدفعش', bg: '#FEE2E2', color: '#991B1B' },
  partial:   { label: 'دفع جزء', bg: '#FEF3C7', color: '#92400E' },
  paid:      { label: 'مدفوع', bg: '#D1FAE5', color: '#065F46' },
  // Account status
  active:    { label: 'نشط', bg: '#D1FAE5', color: '#065F46' },
  inactive:  { label: 'غير نشط', bg: '#F3F4F6', color: '#6B7280' },
  sent:      { label: 'تم الإرسال', bg: '#D1FAE5', color: '#065F46' },
  failed:    { label: 'فشل', bg: '#FEE2E2', color: '#991B1B' },
}

export default function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const cfg = configs[status] ?? { label: status || '—', bg: '#F3F4F6', color: '#6B7280' }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
