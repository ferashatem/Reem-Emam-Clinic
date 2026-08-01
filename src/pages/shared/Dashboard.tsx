import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getReservations, getPayments, getExpenses, getClients, monthOf } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { useLoader } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import {
  formatDateAr, formatMoney, formatMonthAr, formatTime, monthKey, todayISO, toNumber,
} from '../../utils/formatters'
import { dueOf, isPriced } from '../../utils/pricing'
import { C } from '../../theme'

export default function Dashboard() {
  const { userProfile } = useAuth()
  const base = useBasePath()

  const { data, loading, error, reload } = useLoader(async () => {
    const [reservations, payments, expenses, clients] = await Promise.all([
      getReservations(), getPayments(), getExpenses(), getClients(),
    ])
    return { reservations, payments, expenses, clients }
  }, [])

  const today = todayISO()
  const month = monthKey()

  const view = useMemo(() => {
    const reservations = data?.reservations ?? []
    const payments = data?.payments ?? []
    const expenses = data?.expenses ?? []

    const todayList = reservations
      .filter(r => r.date === today && r.status !== 'cancelled')
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

    const revenue = payments.filter(p => monthOf(p) === month).reduce((s, p) => s + toNumber(p.amount), 0)
    const spent = expenses.filter(e => monthOf(e) === month).reduce((s, e) => s + toNumber(e.amount), 0)
    const collectedToday = payments.filter(p => p.date === today).reduce((s, p) => s + toNumber(p.amount), 0)

    const requests = reservations.filter(r => r.status === 'pending' && r.booked_by === 'client')
    // Unpriced sessions owe nothing yet — they're chased from "مستنية الدفع".
    const unpaid = reservations.filter(r => {
      if (r.status === 'cancelled' || r.status === 'pending') return false
      return isPriced(r) && dueOf(r) > 0 && r.date <= today
    })

    return {
      todayList, revenue, spent, net: revenue - spent, collectedToday,
      requests, unpaid,
      dueTotal: unpaid.reduce((s, r) => s + dueOf(r), 0),
      clients: data?.clients.length ?? 0,
    }
  }, [data, today, month])

  if (loading) return <LoadingBlock />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const profitable = view.net >= 0

  return (
    <div>
      <PageHeader
        title={`أهلاً ${userProfile?.name ?? ''} 🌸`}
        subtitle={formatDateAr(today)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="حجوزات النهاردة" value={view.todayList.length} icon="📅" />
        <StatCard label="تحصيل النهاردة" value={formatMoney(view.collectedToday)} icon="💵" color={C.green} />
        <StatCard
          label={`تحصيل ${formatMonthAr(month)}`}
          value={formatMoney(view.revenue)}
          icon="💰" color={C.gold}
          hint={`مصاريف ${formatMoney(view.spent)}`}
        />
        <StatCard
          label={profitable ? 'صافي ربح الشهر' : 'صافي خسارة الشهر'}
          value={formatMoney(Math.abs(view.net))}
          icon={profitable ? '📈' : '📉'}
          color={profitable ? C.green : C.red}
        />
      </div>

      {/* Things that need someone to act */}
      <div className="space-y-3 mb-6">
        {view.requests.length > 0 && (
          <Alert
            to={`${base}/reservations`}
            tone="amber"
            text={`🔔 ${view.requests.length} طلب حجز من الموقع مستني تأكيد`}
          />
        )}
        {view.unpaid.length > 0 && (
          <Alert
            to={`${base}/payments`}
            tone="red"
            text={`💳 ${view.unpaid.length} جلسة لسه متحصّلتش — إجمالي ${formatMoney(view.dueTotal)}`}
          />
        )}
      </div>

      <section className="bg-white rounded-2xl border shadow-sm p-4 sm:p-5" style={{ borderColor: C.primarySoft }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold" style={{ color: C.primary }}>مواعيد النهاردة</h2>
          <Link to={`${base}/reservations`} className="text-xs" style={{ color: C.primary }}>كل الحجوزات →</Link>
        </div>

        {view.todayList.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-2">🌙</p>
            <p className="text-sm text-gray-400">مفيش مواعيد النهاردة</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {view.todayList.map(r => {
              const row = (
                <>
                  <div className="text-center min-w-14.5 shrink-0">
                    <p className="text-sm font-bold" style={{ color: C.primary }}>{formatTime(r.time)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.client_name || '—'}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {r.service_name || '—'}{r.pulses ? ` · ${r.pulses} نبضة` : ''}
                    </p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-semibold mb-1" style={{ color: C.gold }}>
                      {isPriced(r) ? formatMoney(r.price_at_booking) : '—'}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                </>
              )
              const className = 'flex items-center gap-3 sm:gap-4 p-3 rounded-xl border transition-colors'
              const style = { borderColor: C.primarySoft }

              // Website requests have no patient file until the assistant confirms them
              return r.client_id ? (
                <Link key={r.id} to={`${base}/patients/${r.client_id}`} className={`${className} hover:bg-[#FDF6F0]/60`} style={style}>
                  {row}
                </Link>
              ) : (
                <div key={r.id} className={className} style={style}>{row}</div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

const tones = {
  amber: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' },
  red: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
}

function Alert({ to, text, tone }: { to: string; text: string; tone: keyof typeof tones }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl px-4 py-3 text-sm font-medium border"
      style={tones[tone]}
    >
      {text}
    </Link>
  )
}
