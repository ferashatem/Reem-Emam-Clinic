import { useState } from 'react'
import toast from 'react-hot-toast'
import { closeSession, createPayment } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { messageFor } from '../../hooks/useLoader'
import Modal from '../ui/Modal'
import { Field, Input, Textarea, Button } from '../ui/Form'
import { formatMoney, formatTime, todayISO, toNumber } from '../../utils/formatters'
import { computeTotal, dueOf, isPriced } from '../../utils/pricing'
import { C } from '../../theme'
import type { PaymentMethod, Reservation, Service } from '../../types'

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش 💵' },
  { value: 'instapay', label: 'إنستا باي 📲' },
  { value: 'wallet', label: 'محفظة 📱' },
  { value: 'card', label: 'فيزا 💳' },
]

const pulseSteps = [10, 50, 100]

interface Props {
  reservation: Reservation | null
  /** Falls back to the rate snapshotted on the booking when the service is gone. */
  service?: Service | null
  onClose: () => void
  onSaved: () => void
}

/**
 * Ending a session takes two people, so this sheet has two faces.
 *
 * The doctor is the only one who knows how many pulses actually ran, so she
 * enters the count and the price it produces. The money is handed over at the
 * desk on the way out, so the assistant is the one who records it. Each person
 * only ever fills in what she personally witnessed.
 */
export default function CloseSessionSheet({ reservation, service, onClose, onSaved }: Props) {
  const { userProfile } = useAuth()
  const collecting = userProfile?.role === 'staff'

  return (
    <Modal
      open={!!reservation}
      onClose={onClose}
      title={reservation ? titleFor(reservation, collecting) : ''}
      width="max-w-lg"
    >
      {reservation && (
        // Keyed so each patient opens on her own numbers rather than the last
        // one's — the state below initializes from the booking and stays local.
        collecting ? (
          <CollectForm
            key={reservation.id}
            reservation={reservation}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <PriceForm
            key={reservation.id}
            reservation={reservation}
            service={service}
            onClose={onClose}
            onSaved={onSaved}
          />
        )
      )}
    </Modal>
  )
}

function titleFor(r: Reservation, collecting: boolean) {
  const who = r.client_name || 'المريضة'
  if (collecting) return `تحصيل — ${who}`
  return isPriced(r) ? `تعديل التسعير — ${who}` : `إنهاء جلسة — ${who}`
}

// ─── The doctor's side: pulses in, price out ────────────────────────────────

function PriceForm({
  reservation: r, service, onClose, onSaved,
}: Props & { reservation: Reservation }) {
  // The rate comes off the booking's own snapshot first: the service's price
  // may have moved since, but this is the deal that was struck.
  const perPulse = toNumber(r.price_per_pulse) || toNumber(service?.price_per_pulse)
  const flatPrice = toNumber(service?.price)
  const isPerPulse = perPulse > 0

  const [pulses, setPulses] = useState(r.pulses != null ? String(r.pulses) : '')
  /** Null until she overrides the computed price for a discount or a package. */
  const [totalOverride, setTotalOverride] = useState<string | null>(
    isPriced(r) ? String(toNumber(r.price_at_booking)) : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computed = computeTotal(toNumber(pulses), perPulse, flatPrice)
  const total = totalOverride ?? (computed > 0 ? String(computed) : '')
  const totalValue = toNumber(total)

  async function submit() {
    if (isPerPulse && !pulses.trim()) {
      return setError('اكتبي عدد النبضات الأول — السعر بيتحسب منه')
    }
    if (toNumber(pulses) < 0) return setError('عدد النبضات مينفعش يكون بالسالب')
    if (!total.trim()) return setError('اكتبي إجمالي الجلسة')
    if (totalValue < 0) return setError('الإجمالي مينفعش يكون بالسالب')

    setError(null)
    setSaving(true)
    try {
      await closeSession({
        reservationId: r.id,
        pulses: pulses.trim() ? toNumber(pulses) : null,
        total: totalValue,
      })
      toast.success(`تم إنهاء الجلسة — المطلوب ${formatMoney(totalValue)} 💰`)
      onSaved()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500 rounded-xl p-3" style={{ backgroundColor: C.bg }}>
        {r.service_name || 'خدمة'} · {formatTime(r.time)}
        {isPerPulse ? ` · ${formatMoney(perPulse)} / نبضة` : ` · سعر ثابت ${formatMoney(flatPrice)}`}
      </p>

      {/* ① Pulses — the one number only the doctor can give us */}
      <Field
        label={isPerPulse ? '① عدد النبضات' : '① عدد النبضات — للتوثيق الطبي'}
        hint={isPerPulse ? undefined : 'مبيأثرش على السعر — الخدمة دي بسعر ثابت'}
      >
        <div className="flex gap-2">
          <Input
            autoFocus
            value={pulses}
            onChange={e => { setPulses(e.target.value); setError(null) }}
            type="number"
            inputMode="numeric"
            min={0}
            dir="ltr"
            placeholder="0"
            className="text-2xl! font-bold py-4! text-center tabular-nums"
          />
          <div className="flex flex-col gap-1 shrink-0">
            {pulseSteps.map(step => (
              <button
                key={step}
                type="button"
                onClick={() => { setPulses(String(toNumber(pulses) + step)); setError(null) }}
                className="px-3 py-1 rounded-lg text-xs font-medium border bg-white"
                style={{ borderColor: C.primarySoft, color: C.primary }}
              >
                +{step}
              </button>
            ))}
          </div>
        </div>
      </Field>

      {/* The running total, big enough to read out loud */}
      {isPerPulse && (
        <div
          className="rounded-2xl px-4 py-3 flex items-baseline justify-between gap-3"
          style={{ backgroundColor: C.bg }}
        >
          <span className="text-xs text-gray-500 tabular-nums">
            {toNumber(pulses).toLocaleString('ar-EG')} × {formatMoney(perPulse)}
          </span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: C.primary }}>
            {formatMoney(computed)}
          </span>
        </div>
      )}

      {/* ② Total — editable for a discount or a package */}
      <Field
        label="② إجمالي الجلسة (جنيه)"
        hint={
          totalOverride !== null && computed > 0 && totalValue !== computed
            ? `اتعدّل يدوي — المحسوب ${formatMoney(computed)}`
            : 'عدّليه لو فيه خصم أو عرض'
        }
      >
        <Input
          value={total}
          onChange={e => { setTotalOverride(e.target.value); setError(null) }}
          type="number"
          inputMode="numeric"
          min={0}
          dir="ltr"
          className="font-semibold tabular-nums"
        />
      </Field>

      <p className="text-xs rounded-xl p-3 leading-relaxed" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
        💡 أول ما تحفظي، المبلغ ده هيظهر للأسيستانت عشان تحصّله من المريضة.
      </p>

      {error && <ErrorLine>{error}</ErrorLine>}

      <div className="flex gap-3">
        <Button onClick={submit} loading={saving} className="flex-1">
          ✅ حفظ وإنهاء الجلسة
        </Button>
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
          رجوع
        </Button>
      </div>
    </div>
  )
}

// ─── The assistant's side: taking the money ─────────────────────────────────

function CollectForm({
  reservation: r, onClose, onSaved,
}: Omit<Props, 'service'> & { reservation: Reservation }) {
  const { userProfile } = useAuth()

  const total = toNumber(r.price_at_booking)
  const alreadyPaid = toNumber(r.paid_amount)
  const remaining = dueOf(r)

  const [amountOverride, setAmountOverride] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = amountOverride ?? (remaining > 0 ? String(remaining) : '')
  const paying = toNumber(amount)

  // Nothing to collect until the doctor has said how many pulses ran.
  if (!isPriced(r)) {
    return (
      <div className="space-y-4 text-center py-4">
        <p className="text-4xl">⏳</p>
        <p className="font-semibold" style={{ color: C.primary }}>
          الجلسة لسه متسعّرتش
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          الدكتورة لسه مسجّلتش عدد النبضات. أول ما تخلّص وتحفظ، المبلغ هيظهر هنا
          وتقدري تحصّليه.
        </p>
        <Button variant="outline" className="w-full" onClick={onClose}>تمام</Button>
      </div>
    )
  }

  async function submit() {
    if (paying <= 0) return setError('اكتبي المبلغ اللي المريضة دفعته')
    if (paying > remaining) {
      return setError(`المبلغ أكبر من المطلوب (${formatMoney(remaining)}) — راجعي الرقم`)
    }

    setError(null)
    setSaving(true)
    try {
      await createPayment({
        client_id: r.client_id,
        client_name: r.client_name ?? '',
        reservation_id: r.id,
        amount: paying,
        method,
        note: note.trim(),
        date: todayISO(),
        staff_id: userProfile?.uid ?? '',
        staff_name: userProfile?.name ?? '',
      })
      toast.success('تم تسجيل الدفع 💰')
      onSaved()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* What the doctor decided — read-only here */}
      <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: C.bg }}>
        <p className="text-xs text-gray-500 mb-1">
          المطلوب من {r.client_name || 'المريضة'}
        </p>
        <p className="text-3xl font-bold tabular-nums" style={{ color: C.primary }}>
          {formatMoney(remaining)}
        </p>
        <p className="text-xs text-gray-400 mt-1.5 tabular-nums">
          {r.pulses ? `${r.pulses} نبضة · ` : ''}إجمالي {formatMoney(total)}
          {alreadyPaid > 0 ? ` · دفعت قبل كده ${formatMoney(alreadyPaid)}` : ''}
        </p>
      </div>

      <Field label="المبلغ المدفوع دلوقتي (جنيه)">
        <div className="flex gap-2">
          <Input
            autoFocus
            value={amount}
            onChange={e => { setAmountOverride(e.target.value); setError(null) }}
            type="number"
            inputMode="numeric"
            min={0}
            dir="ltr"
            placeholder="0"
            className="font-semibold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            onClick={() => { setAmountOverride(null); setError(null) }}
          >
            دفعت الكل
          </Button>
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        {methods.map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMethod(m.value)}
            className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
            style={method === m.value
              ? { backgroundColor: C.primary, color: '#fff', borderColor: C.primary }
              : { backgroundColor: '#fff', color: C.text, borderColor: C.primarySoft }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="ملاحظة على الدفعة (اختياري)"
      />

      {paying > 0 && paying < remaining && (
        <p className="text-xs rounded-xl p-3" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          هيفضل عليها {formatMoney(remaining - paying)} — هتظهر في «مستنية الدفع».
        </p>
      )}

      {error && <ErrorLine>{error}</ErrorLine>}

      <div className="flex gap-3">
        <Button onClick={submit} loading={saving} className="flex-1">
          💰 تسجيل الدفع
        </Button>
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
          رجوع
        </Button>
      </div>
    </div>
  )
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm rounded-xl p-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
      {children}
    </p>
  )
}
