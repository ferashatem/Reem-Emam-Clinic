import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getPayments, softDeletePayment, getReservations, getClients, getActiveServices,
} from '../../services/firestore'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import CloseSessionSheet from '../../components/session/CloseSessionSheet'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Button } from '../../components/ui/Form'
import {
  formatDateShort, formatMoney, formatTime, todayISO, toNumber,
} from '../../utils/formatters'
import { dueOf, isPriced } from '../../utils/pricing'
import { pricedService } from '../../utils/services'
import { C } from '../../theme'
import type { Client, Payment, PaymentMethod, Reservation } from '../../types'

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش 💵' },
  { value: 'instapay', label: 'إنستا باي 📲' },
  { value: 'wallet', label: 'محفظة 📱' },
  { value: 'card', label: 'فيزا 💳' },
]

const methodLabel = (m?: string) => methods.find(x => x.value === m)?.label ?? m ?? '—'

export default function Payments() {
  const { confirm, dialog } = useConfirm()

  const { data, loading, error, reload } = useLoader(async () => {
    const [payments, reservations, clients, services] = await Promise.all([
      getPayments(), getReservations(), getClients(), getActiveServices(),
    ])
    return { payments, reservations, clients, services }
  }, [])

  const payments = useMemo(() => data?.payments ?? [], [data])
  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])
  const services = useMemo(() => data?.services ?? [], [data])

  const [tab, setTab] = useState<'today' | 'all'>('today')
  const [closing, setClosing] = useState<Reservation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c])) as Record<string, Client>,
    [clients]
  )

  const today = todayISO()

  /**
   * Sessions that happened (or are confirmed for today) and aren't settled yet.
   * The pulse count — and so the real price — is only known once the session is
   * over, so a booking often sits here with no total at all. Those stay open
   * instead of being dropped, until someone enters the amount the client owes.
   */
  const awaitingPayment = useMemo(() => {
    return reservations
      .filter(r => {
        if (r.status === 'cancelled') return false
        if (r.status === 'pending') return false
        if (r.date > today) return false
        if (!isPriced(r)) return true // waiting on the pulse count
        return dueOf(r) > 0
      })
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  }, [reservations, today])

  /** Open sessions with no price yet — the due total can't include them. */
  const unpricedCount = useMemo(
    () => awaitingPayment.filter(r => !isPriced(r)).length,
    [awaitingPayment]
  )

  const todayPayments = useMemo(() => payments.filter(p => p.date === today), [payments, today])
  const visible = tab === 'today' ? todayPayments : payments

  const totals = useMemo(() => ({
    today: todayPayments.reduce((s, p) => s + toNumber(p.amount), 0),
    month: payments
      .filter(p => (p.date ?? '').startsWith(today.slice(0, 7)))
      .reduce((s, p) => s + toNumber(p.amount), 0),
    due: awaitingPayment.reduce((s, r) => s + dueOf(r), 0),
  }), [todayPayments, payments, awaitingPayment, today])

  function nameOf(r: Reservation) {
    return r.client_name || clientMap[r.client_id]?.name || 'عميلة محذوفة'
  }

  async function handleDelete(p: Payment) {
    const ok = await confirm({
      title: 'مسح عملية الدفع',
      message: `هتمسحي ${formatMoney(p.amount)} من ${p.client_name || 'العميلة'}؟ المبلغ هيترجع مستحق على الحجز.`,
      confirmLabel: 'مسح',
      danger: true,
    })
    if (!ok) return
    setBusyId(p.id)
    try {
      await softDeletePayment(p.id)
      toast.success('تم المسح')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="الدفع والتحصيلات"
        subtitle="اقفلي الجلسة وسجّلي النبضات — السعر والدفع بيتسجلوا مع بعض"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="تحصيل النهاردة" value={formatMoney(totals.today)} icon="💰" color={C.green} />
        <StatCard label="تحصيل الشهر" value={formatMoney(totals.month)} icon="📆" />
        <StatCard
          label="مستحق على العملاء"
          value={formatMoney(totals.due)}
          icon="⏳"
          color={C.amber}
          hint={
            unpricedCount > 0
              ? `${awaitingPayment.length} جلسة · ${unpricedCount} لسه متسعّرتش`
              : `${awaitingPayment.length} جلسة`
          }
        />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {/* One-tap collection for sessions that still owe money */}
          {awaitingPayment.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold mb-3" style={{ color: C.primary }}>
                مستنية الدفع ({awaitingPayment.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {awaitingPayment.slice(0, 12).map(r => {
                  const unpriced = !isPriced(r)
                  const due = dueOf(r)
                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3"
                      style={{ borderColor: unpriced ? C.primarySoft : '#FDBA74' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{nameOf(r)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.service_name || '—'} · {formatDateShort(r.date)} · {formatTime(r.time)}
                        </p>
                        {unpriced ? (
                          <p className="text-sm font-bold mt-1" style={{ color: C.primary }}>
                            لسه متسعّرتش
                            <span className="text-xs font-normal text-gray-400 mr-2">
                              (اقفلي الجلسة وسجّلي النبضات)
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm font-bold mt-1" style={{ color: C.amber }}>
                            مستحق: {formatMoney(due)}
                            {toNumber(r.paid_amount) > 0 && (
                              <span className="text-xs font-normal text-gray-400 mr-2">
                                (دفعت {formatMoney(r.paid_amount)})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {/* One sheet does both: the pulses set the price, and the
                          money is taken against it in the same step. */}
                      <Button size="sm" onClick={() => setClosing(r)}>
                        {unpriced ? 'إنهاء الجلسة' : 'استلام'}
                      </Button>
                    </div>
                  )
                })}
              </div>
              {awaitingPayment.length > 12 && (
                <p className="text-xs text-gray-400 mt-3">
                  و {awaitingPayment.length - 12} جلسة تانية — هتلاقيها في «يوم العيادة» بتاريخها
                </p>
              )}
            </section>
          )}

          <div className="mb-4">
            <Tabs
              tabs={[
                { value: 'today' as const, label: 'تحصيلات النهاردة', count: todayPayments.length },
                { value: 'all' as const, label: 'كل التحصيلات', count: payments.length },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon="💰"
              title={tab === 'today' ? 'مفيش تحصيلات النهاردة' : 'مفيش تحصيلات مسجلة'}
              description="اقفلي الجلسة من «مستنية الدفع» فوق — المبلغ بيتسجل مع النبضات"
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="space-y-3 lg:hidden">
                {visible.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: C.primarySoft }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {p.client_name || clientMap[p.client_id]?.name || '—'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDateShort(p.date)} · {methodLabel(p.method)}
                        </p>
                        {p.note && <p className="text-xs text-gray-400 mt-1">{p.note}</p>}
                      </div>
                      <p className="font-bold text-base whitespace-nowrap tabular-nums" style={{ color: C.green }}>
                        {formatMoney(p.amount)}
                      </p>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        size="sm" variant="outline" disabled={busyId === p.id}
                        onClick={() => handleDelete(p)}
                        style={{ borderColor: '#FECACA', color: C.red }}
                      >
                        مسح
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: C.primarySoft }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: C.bg }}>
                      <tr>
                        {['العميلة', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'استلمتها', 'ملاحظة', ''].map(h => (
                          <th key={h} className="text-start text-xs font-semibold px-4 py-3 whitespace-nowrap" style={{ color: C.primary }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map(p => (
                        <tr key={p.id} className="border-t hover:bg-[#FDF6F0]/60" style={{ borderColor: '#F2C4CE30' }}>
                          <td className="px-4 py-3 font-medium">{p.client_name || clientMap[p.client_id]?.name || '—'}</td>
                          <td className="px-4 py-3 font-bold whitespace-nowrap tabular-nums" style={{ color: C.green }}>{formatMoney(p.amount)}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{methodLabel(p.method)}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateShort(p.date)}</td>
                          <td className="px-4 py-3 text-gray-500">{p.staff_name || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-50 truncate">{p.note || '—'}</td>
                          <td className="px-4 py-3 text-end">
                            <Button
                              size="sm" variant="outline" disabled={busyId === p.id}
                              onClick={() => handleDelete(p)}
                              style={{ borderColor: '#FECACA', color: C.red }}
                            >
                              مسح
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <CloseSessionSheet
        reservation={closing}
        service={closing
          ? pricedService(services.find(s => s.id === closing.service_id), services) ?? null
          : null}
        onClose={() => setClosing(null)}
        onSaved={() => { setClosing(null); reload() }}
      />

      {dialog}
    </div>
  )
}
