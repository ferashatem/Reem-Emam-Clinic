import { useState } from 'react'
import toast from 'react-hot-toast'
import { closeSession, createPayment } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { messageFor } from '../../hooks/useLoader'
import Modal from '../ui/Modal'
import { Field, Input, Textarea, Button } from '../ui/Form'
import { formatMoney, formatTime, todayISO, toNumber } from '../../utils/formatters'
import { computeTotal, isPriced } from '../../utils/pricing'
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
 * Closing a session, start to finish, on one screen: the pulse count goes in,
 * the price falls out of it, and the money is taken on the spot. Whoever is at
 * the desk when the patient stands up does the whole thing — splitting it in
 * two only meant a session sat half-finished until the other person showed up.
 */
export default function CloseSessionSheet({ reservation, service, onClose, onSaved }: Props) {
  return (
    <Modal
      open={!!reservation}
      onClose={onClose}
      title={reservation ? titleFor(reservation) : ''}
      width="max-w-lg"
    >
      {reservation && (
        // Keyed so each patient opens on her own numbers rather than the last
        // one's — the state below initializes from the booking and stays local.
        <SessionForm
          key={reservation.id}
          reservation={reservation}
          service={service}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  )
}

function titleFor(r: Reservation) {
  const who = r.client_name || 'المريضة'
  return isPriced(r) ? `تعديل الجلسة — ${who}` : `إنهاء جلسة — ${who}`
}

function SessionForm({
  reservation: r, service, onClose, onSaved,
}: Props & { reservation: Reservation }) {
  const { userProfile } = useAuth()

  // The rate comes off the booking's own snapshot first: the service's price
  // may have moved since, but this is the deal that was struck.
  const perPulse = toNumber(r.price_per_pulse) || toNumber(service?.price_per_pulse)
  const flatPrice = toNumber(service?.price)
  const isPerPulse = perPulse > 0
  const alreadyPaid = toNumber(r.paid_amount)

  const [pulses, setPulses] = useState(r.pulses != null ? String(r.pulses) : '')
  /** Null until the total is overridden by hand for a discount or a package. */
  const [totalOverride, setTotalOverride] = useState<string | null>(
    isPriced(r) ? String(toNumber(r.price_at_booking)) : null
  )
  const [amountOverride, setAmountOverride] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computed = computeTotal(toNumber(pulses), perPulse, flatPrice)
  const total = totalOverride ?? (computed > 0 ? String(computed) : '')
  const totalValue = toNumber(total)

  // What's left to collect against the total on screen right now — so editing
  // the pulses updates the amount due before anything is even saved.
  const remaining = Math.max(0, totalValue - alreadyPaid)
  const amount = amountOverride ?? (remaining > 0 ? String(remaining) : '')
  const paying = toNumber(amount)

  async function submit() {
    if (isPerPulse && !pulses.trim()) {
      return setError('اكتبي عدد النبضات الأول — السعر بيتحسب منه')
    }
    if (toNumber(pulses) < 0) return setError('عدد النبضات مينفعش يكون بالسالب')
    if (!total.trim()) return setError('اكتبي إجمالي الجلسة')
    if (totalValue < 0) return setError('الإجمالي مينفعش يكون بالسالب')
    if (paying < 0) return setError('المبلغ المدفوع مينفعش يكون بالسالب')
    if (paying > remaining) {
      return setError(`المبلغ أكبر من المطلوب (${formatMoney(remaining)}) — راجعي الرقم`)
    }

    setError(null)
    setSaving(true)
    try {
      // Price first: the payment is recorded against this total, so it has to
      // be on the booking before the money lands on it.
      await closeSession({
        reservationId: r.id,
        pulses: pulses.trim() ? toNumber(pulses) : null,
        total: totalValue,
      })

      if (paying > 0) {
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
      }

      const left = remaining - paying
      toast.success(
        paying > 0
          ? left > 0
            ? `اتسجل ${formatMoney(paying)} — فاضل ${formatMoney(left)} 💰`
            : 'الجلسة اتقفلت والمبلغ اتحصّل بالكامل ✅'
          : `تم إنهاء الجلسة — المطلوب ${formatMoney(remaining)} 💰`
      )
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

      {/* ① Pulses — the number the whole price hangs on */}
      <Field
        label={isPerPulse ? '① عدد النبضات' : '① عدد النبضات — للتوثيق الطبي'}
        hint={isPerPulse ? 'السعر بيتحسب لوحده' : 'مبيأثرش على السعر — الخدمة دي بسعر ثابت'}
      >
        <div className="flex gap-2">
          <Input
            autoFocus
            value={pulses}
            onChange={e => { setPulses(e.target.value); setAmountOverride(null); setTotalOverride(null); setError(null) }}
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
                onClick={() => {
                  setPulses(String(toNumber(pulses) + step))
                  setAmountOverride(null)
                  setTotalOverride(null)
                  setError(null)
                }}
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
          onChange={e => { setTotalOverride(e.target.value); setAmountOverride(null); setError(null) }}
          type="number"
          inputMode="numeric"
          min={0}
          dir="ltr"
          className="font-semibold tabular-nums"
        />
      </Field>

      {/* ③ The money, pre-filled with everything still owed */}
      <Field
        label="③ المبلغ المدفوع دلوقتي (جنيه)"
        hint={
          alreadyPaid > 0
            ? `دفعت قبل كده ${formatMoney(alreadyPaid)} — المطلوب ${formatMoney(remaining)}`
            : 'سيبيه فاضي لو هتدفع بعدين'
        }
      >
        <div className="flex gap-2">
          <Input
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

      {paying > 0 && (
        <>
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
        </>
      )}

      {paying > 0 && paying < remaining && (
        <p className="text-xs rounded-xl p-3" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          هيفضل عليها {formatMoney(remaining - paying)} — هتظهر في «مطلوب تحصيل».
        </p>
      )}
      {paying === 0 && totalValue > 0 && (
        <p className="text-xs rounded-xl p-3 leading-relaxed" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>
          💡 مش هيتسجل دفع دلوقتي — {formatMoney(remaining)} هتفضل مطلوبة منها في «مطلوب تحصيل».
        </p>
      )}

      {error && <ErrorLine>{error}</ErrorLine>}

      <div className="flex gap-3">
        <Button onClick={submit} loading={saving} className="flex-1">
          {paying > 0 ? '✅ حفظ وتسجيل الدفع' : '✅ حفظ وإنهاء الجلسة'}
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
