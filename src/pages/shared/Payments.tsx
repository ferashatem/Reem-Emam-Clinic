import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getPayments, createPayment, softDeletePayment, getReservations, getClients,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateShort, formatMoney, formatTime, todayISO, toNumber,
} from '../../utils/formatters'
import { C } from '../../theme'
import type { Client, Payment, PaymentMethod, Reservation } from '../../types'

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش 💵' },
  { value: 'instapay', label: 'إنستا باي 📲' },
  { value: 'wallet', label: 'محفظة 📱' },
  { value: 'card', label: 'فيزا 💳' },
]

const methodLabel = (m?: string) => methods.find(x => x.value === m)?.label ?? m ?? '—'

interface PaymentForm {
  reservation_id: string
  client_id: string
  amount: string
  method: PaymentMethod
  date: string
  note: string
}

export default function Payments() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()

  const { data, loading, error, reload } = useLoader(async () => {
    const [payments, reservations, clients] = await Promise.all([
      getPayments(), getReservations(), getClients(),
    ])
    return { payments, reservations, clients }
  }, [])

  const payments = useMemo(() => data?.payments ?? [], [data])
  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])

  const [tab, setTab] = useState<'today' | 'all'>('today')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c])) as Record<string, Client>,
    [clients]
  )

  const today = todayISO()

  /** Sessions that happened (or are confirmed for today) but aren't fully paid. */
  const awaitingPayment = useMemo(() => {
    return reservations
      .filter(r => {
        if (r.status === 'cancelled') return false
        if (r.status === 'pending') return false
        const total = toNumber(r.price_at_booking)
        if (total <= 0) return false
        return toNumber(r.paid_amount) < total && r.date <= today
      })
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
  }, [reservations, today])

  const todayPayments = useMemo(() => payments.filter(p => p.date === today), [payments, today])
  const visible = tab === 'today' ? todayPayments : payments

  const totals = useMemo(() => ({
    today: todayPayments.reduce((s, p) => s + toNumber(p.amount), 0),
    month: payments
      .filter(p => (p.date ?? '').startsWith(today.slice(0, 7)))
      .reduce((s, p) => s + toNumber(p.amount), 0),
    due: awaitingPayment.reduce(
      (s, r) => s + Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount)),
      0
    ),
  }), [todayPayments, payments, awaitingPayment, today])

  // ─── Form ─────────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<PaymentForm>()

  const watchedResId = watch('reservation_id')
  const linkedReservation = reservations.find(r => r.id === watchedResId)
  const remaining = linkedReservation
    ? Math.max(0, toNumber(linkedReservation.price_at_booking) - toNumber(linkedReservation.paid_amount))
    : 0

  function nameOf(r: Reservation) {
    return r.client_name || clientMap[r.client_id]?.name || 'عميلة محذوفة'
  }

  function openFor(r?: Reservation) {
    reset({
      reservation_id: r?.id ?? '',
      client_id: r?.client_id ?? '',
      amount: r
        ? String(Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount)))
        : '',
      method: 'cash',
      date: todayISO(),
      note: '',
    })
    setModalOpen(true)
  }

  /** Picking a session fills in who's paying and how much is left. */
  function onReservationChange(id: string) {
    const r = reservations.find(x => x.id === id)
    if (!r) return
    setValue('client_id', r.client_id)
    setValue('amount', String(Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount))))
  }

  async function onSubmit(values: PaymentForm) {
    setSaving(true)
    try {
      const client = clientMap[values.client_id]
      await createPayment({
        client_id: values.client_id,
        client_name: client?.name ?? '',
        reservation_id: values.reservation_id || null,
        amount: toNumber(values.amount),
        method: values.method,
        note: values.note?.trim() ?? '',
        date: values.date || todayISO(),
        staff_id: userProfile?.uid ?? '',
        staff_name: userProfile?.name ?? '',
      })
      toast.success('تم تسجيل الدفع 💰')
      setModalOpen(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
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
        subtitle="سجّلي كل مبلغ بيتدفع بعد الجلسة"
        action={<Button className="w-full sm:w-auto" onClick={() => openFor()}>+ تسجيل دفعة</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="تحصيل النهاردة" value={formatMoney(totals.today)} icon="💰" color={C.green} />
        <StatCard label="تحصيل الشهر" value={formatMoney(totals.month)} icon="📆" />
        <StatCard label="مستحق على العملاء" value={formatMoney(totals.due)} icon="⏳" color={C.amber} hint={`${awaitingPayment.length} جلسة`} />
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
                  const due = Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount))
                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3"
                      style={{ borderColor: '#FDBA74' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{nameOf(r)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.service_name || '—'} · {formatDateShort(r.date)} · {formatTime(r.time)}
                        </p>
                        <p className="text-sm font-bold mt-1" style={{ color: C.amber }}>
                          مستحق: {formatMoney(due)}
                          {toNumber(r.paid_amount) > 0 && (
                            <span className="text-xs font-normal text-gray-400 mr-2">
                              (دفعت {formatMoney(r.paid_amount)})
                            </span>
                          )}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => openFor(r)}>استلام</Button>
                    </div>
                  )
                })}
              </div>
              {awaitingPayment.length > 12 && (
                <p className="text-xs text-gray-400 mt-3">
                  و {awaitingPayment.length - 12} جلسة تانية — سجّليها من زرار "تسجيل دفعة"
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
              description="سجّلي المبلغ اللي العميلة دفعته بعد ما تخلص جلستها"
              action={<Button onClick={() => openFor()}>+ تسجيل دفعة</Button>}
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
                      <p className="font-bold text-base whitespace-nowrap" style={{ color: C.green }}>
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
                          <td className="px-4 py-3 font-bold whitespace-nowrap" style={{ color: C.green }}>{formatMoney(p.amount)}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تسجيل دفعة" width="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Field label="الجلسة" hint="اختاري الجلسة عشان المبلغ يتربط بيها في الحسابات">
            <Select
              {...register('reservation_id', {
                onChange: e => onReservationChange(e.target.value),
              })}
            >
              <option value="">— دفعة مش مرتبطة بجلسة —</option>
              {reservations
                .filter(r => r.status !== 'cancelled')
                .slice(0, 200)
                .map(r => (
                  <option key={r.id} value={r.id}>
                    {nameOf(r)} — {formatDateShort(r.date)} {formatTime(r.time)} — {formatMoney(r.price_at_booking)}
                  </option>
                ))}
            </Select>
          </Field>

          {linkedReservation && (
            <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: C.bg }}>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">إجمالي الجلسة</span>
                <span className="font-medium">{formatMoney(linkedReservation.price_at_booking)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">مدفوع قبل كده</span>
                <span className="font-medium">{formatMoney(linkedReservation.paid_amount)}</span>
              </div>
              <div className="flex justify-between font-bold" style={{ color: C.primary }}>
                <span>المتبقي</span>
                <span>{formatMoney(remaining)}</span>
              </div>
            </div>
          )}

          <Field label="العميلة" required error={errors.client_id?.message}>
            <Select {...register('client_id', { required: 'اختاري العميلة' })} invalid={!!errors.client_id}>
              <option value="">اختاري العميلة...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="المبلغ (جنيه)" required error={errors.amount?.message}>
              <Input
                {...register('amount', {
                  required: 'اكتبي المبلغ',
                  validate: v => toNumber(v) > 0 || 'المبلغ لازم يكون أكبر من صفر',
                })}
                invalid={!!errors.amount}
                type="number" inputMode="numeric" min={1} dir="ltr"
                className="font-semibold"
              />
            </Field>
            <Field label="طريقة الدفع" required>
              <Select {...register('method', { required: true })}>
                {methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="التاريخ" required error={errors.date?.message}>
            <Input {...register('date', { required: 'اختاري التاريخ' })} invalid={!!errors.date} type="date" />
          </Field>

          <Field label="ملاحظة">
            <Textarea {...register('note')} rows={2} placeholder="اختياري" />
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">تسجيل الدفعة</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>رجوع</Button>
          </div>
        </form>
      </Modal>

      {dialog}
    </div>
  )
}
