import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  getPayments, softDeletePayment, getReservations, getActiveServices,
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
import DataTable, { type Column } from '../../components/ui/DataTable'
import RowMenu, { type RowAction } from '../../components/ui/RowMenu'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import {
  daysAgo, formatDateShort, formatMoney, formatTime, todayISO, toNumber,
} from '../../utils/formatters'
import { dueOf, isPriced } from '../../utils/pricing'
import { pricedService } from '../../utils/services'
import { C } from '../../theme'
import type { Payment, PaymentMethod, Reservation } from '../../types'

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش 💵' },
  { value: 'instapay', label: 'إنستا باي 📲' },
  { value: 'wallet', label: 'محفظة 📱' },
  { value: 'card', label: 'فيزا 💳' },
]

const methodLabel = (m?: string) => methods.find(x => x.value === m)?.label ?? m ?? '—'

/** How far back this screen looks — see the loader for why it isn't "forever". */
const COLLECTION_WINDOW_DAYS = 90

export default function Payments() {
  const { confirm, dialog } = useConfirm()

  const { data, loading, error, reload } = useLoader(async () => {
    // Two different questions, so two different queries: the collections list
    // is "what came in lately", while the debt list is "what is still owed" —
    // and that one is asked by payment status, so an old debt can never fall
    // off the end of a date window. The older ledger lives in «الحسابات».
    // No client list: a payment and a booking each carry the name they were
    // made out to, so pulling every patient file to print a name was paying
    // for the whole clinic's history on every visit to this screen.
    const [payments, reservations, services] = await Promise.all([
      getPayments({ from: daysAgo(COLLECTION_WINDOW_DAYS) }),
      getReservations({ unsettled: true }),
      getActiveServices(),
    ])
    return { payments, reservations, services }
  }, [])

  const payments = useMemo(() => data?.payments ?? [], [data])
  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const services = useMemo(() => data?.services ?? [], [data])

  const [tab, setTab] = useState<'today' | 'all'>('today')
  const [closing, setClosing] = useState<Reservation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const today = todayISO()

  /**
   * Sessions that happened (or are confirmed for today) and aren't settled yet.
   * The real price is only agreed once the session is over, so a booking often
   * sits here with no total at all. Those stay open instead of being dropped,
   * until someone enters the amount the client owes.
   */
  const awaitingPayment = useMemo(() => {
    return reservations
      .filter(r => {
        if (r.status === 'cancelled') return false
        if (r.status === 'pending') return false
        if (r.date > today) return false
        if (!isPriced(r)) return true // waiting on a total
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
    return r.client_name || 'عميلة محذوفة'
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

  const paymentColumns = useMemo<Column<Payment>[]>(() => [
    {
      id: 'client',
      label: 'العميلة',
      sortValue: p => p.client_name ?? '',
      render: p => (
        <span className="font-semibold" style={{ color: C.text }}>
          {p.client_name || '—'}
        </span>
      ),
    },
    {
      id: 'amount',
      label: 'المبلغ',
      sortValue: p => toNumber(p.amount),
      width: 130,
      render: p => (
        <span className="font-bold whitespace-nowrap" style={{ color: C.green }}>
          {formatMoney(p.amount)}
        </span>
      ),
    },
    {
      id: 'method',
      label: 'طريقة الدفع',
      sortValue: p => methodLabel(p.method),
      width: 140,
      render: p => <span className="text-gray-600 whitespace-nowrap">{methodLabel(p.method)}</span>,
    },
    {
      id: 'date',
      label: 'التاريخ',
      sortValue: p => p.date ?? '',
      width: 130,
      render: p => <span className="text-gray-600 whitespace-nowrap">{formatDateShort(p.date)}</span>,
    },
    {
      id: 'staff',
      label: 'استلمتها',
      sortValue: p => p.staff_name ?? '',
      hideBelow: 'md',
      width: 140,
      render: p => <span className="text-gray-500">{p.staff_name || '—'}</span>,
    },
    {
      id: 'note',
      label: 'ملاحظة',
      hideBelow: 'lg',
      render: p => (
        <span className="text-gray-500 text-xs line-clamp-2">{p.note || '—'}</span>
      ),
    },
    {
      id: 'actions',
      label: '',
      align: 'left',
      width: 60,
      render: p => {
        const actions: RowAction[] = [{
          label: 'مسح العملية',
          icon: <DeleteOutlineRounded fontSize="small" />,
          onClick: () => handleDelete(p),
          danger: true,
        }]
        return <RowMenu actions={actions} disabled={busyId === p.id} />
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId])

  return (
    <div>
      <PageHeader
        title="الدفع والتحصيلات"
        subtitle="اقفلي الجلسة وسجّلي السعر — السعر والدفع بيتسجلوا مع بعض"
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
                              (اقفلي الجلسة وسجّلي السعر)
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
                      {/* One sheet does both: the total is agreed, and the
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

          <DataTable
            columns={paymentColumns}
            rows={visible}
            getRowId={p => p.id}
            empty={
              <EmptyState
                icon="💰"
                title={tab === 'today' ? 'مفيش تحصيلات النهاردة' : 'مفيش تحصيلات مسجلة'}
                description="اقفلي الجلسة من «مستنية الدفع» فوق — المبلغ بيتسجل مع السعر"
              />
            }
          />
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
