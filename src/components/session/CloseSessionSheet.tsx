import { useState } from 'react'
import toast from 'react-hot-toast'
import { closeSession } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { messageFor } from '../../hooks/useLoader'
import Modal from '../ui/Modal'
import { Field, Input, Textarea, Button } from '../ui/Form'
import { formatMoney, formatTime, toNumber } from '../../utils/formatters'
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
 * The end of a session in one sheet: how many pulses ran, what that costs, and
 * what the client just paid. Everything is on screen at once — the assistant is
 * standing at the desk with the client in front of her, not filling a wizard.
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
        <CloseSessionForm
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
  return isPriced(r) ? `تعديل إقفال — ${who}` : `إنهاء جلسة — ${who}`
}

function CloseSessionForm({
  reservation: r, service, onClose, onSaved,
}: Props & { reservation: Reservation }) {
  const { userProfile } = useAuth()

  // The rate comes off the booking's own snapshot first: the service's price
  // may have moved since, but this is the deal that was struck.
  const perPulse = toNumber(r.price_per_pulse) || toNumber(service?.price_per_pulse)
  const flatPrice = toNumber(service?.price)
  const isPerPulse = perPulse > 0
  const alreadyPaid = toNumber(r.paid_amount)
  const reopening = isPriced(r)

  const [pulses, setPulses] = useState(r.pulses != null ? String(r.pulses) : '')
  /** Null until she overrides the computed price for a discount or a package. */
  const [totalOverride, setTotalOverride] = useState<string | null>(
    reopening ? String(toNumber(r.price_at_booking)) : null
  )
  /** Null while the payment box just follows what's owed. */
  const [amountOverride, setAmountOverride] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computed = computeTotal(toNumber(pulses), perPulse, flatPrice)
  const total = totalOverride ?? (computed > 0 ? String(computed) : '')
  const totalValue = toNumber(total)

  const remainingBefore = Math.max(0, totalValue - alreadyPaid)
  const amount = amountOverride ?? (remainingBefore > 0 ? String(remainingBefore) : '')
  const paying = toNumber(amount)
  const paidAfter = alreadyPaid + paying
  const dueAfter = Math.max(0, totalValue - paidAfter)

  async function submit() {
    if (isPerPulse && !pulses.trim()) {
      return setError('اكتبي عدد النبضات الأول — السعر بيتحسب منه')
    }
    if (toNumber(pulses) < 0) return setError('عدد النبضات مينفعش يكون بالسالب')
    if (!total.trim()) return setError('اكتبي إجمالي الجلسة')
    if (totalValue < 0) return setError('الإجمالي مينفعش يكون بالسالب')
    if (paying < 0) return setError('المبلغ المدفوع مينفعش يكون بالسالب')
    if (paying > remainingBefore) {
      return setError(`المبلغ أكبر من المطلوب (${formatMoney(remainingBefore)}) — راجعي الرقم`)
    }

    setError(null)
    setSaving(true)
    try {
      await closeSession({
        reservationId: r.id,
        pulses: pulses.trim() ? toNumber(pulses) : null,
        total: totalValue,
        payment: paying > 0 ? { amount: paying, method, note: note.trim() } : null,
        staff: { id: userProfile?.uid ?? '', name: userProfile?.name ?? '' },
        clientId: r.client_id,
        clientName: r.client_name ?? '',
      })
      toast.success(paying > 0 ? 'تم إنهاء الجلسة وتسجيل الدفع ✅' : 'تم إنهاء الجلسة — لسه مدفعتش')
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

      {/* ① Pulses — the one number only this moment can tell us */}
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
            className="text-2xl! font-bold py-4! text-center"
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

      {/* The running total, big enough to read out loud to the client */}
      {isPerPulse && (
        <div
          className="rounded-2xl px-4 py-3 flex items-baseline justify-between gap-3"
          style={{ backgroundColor: C.bg }}
        >
          <span className="text-xs text-gray-500">
            {toNumber(pulses).toLocaleString('ar-EG')} × {formatMoney(perPulse)}
          </span>
          <span className="text-2xl font-bold" style={{ color: C.primary }}>
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
          className="font-semibold"
        />
      </Field>

      {/* ③ Payment */}
      <div className="space-y-3">
        <Field
          label="③ المبلغ المدفوع دلوقتي (جنيه)"
          hint={alreadyPaid > 0 ? `دفعت قبل كده ${formatMoney(alreadyPaid)}` : undefined}
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
              className="font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 whitespace-nowrap"
              onClick={() => { setAmountOverride(null); setError(null) }}
            >
              الكل
            </Button>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 whitespace-nowrap"
              onClick={() => { setAmountOverride(''); setError(null) }}
            >
              هتدفع بعدين
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
      </div>

      {/* The line she reads before committing */}
      <div
        className="rounded-2xl p-4 border grid grid-cols-3 gap-2 text-center"
        style={{ borderColor: C.primarySoft, backgroundColor: C.bg }}
      >
        <Summary label="الإجمالي" value={formatMoney(totalValue)} />
        <Summary label="مدفوع" value={formatMoney(paidAfter)} color={C.green} />
        <Summary
          label="متبقي"
          value={dueAfter > 0 ? formatMoney(dueAfter) : '—'}
          color={dueAfter > 0 ? C.amber : undefined}
        />
      </div>

      {error && (
        <p className="text-sm rounded-xl p-3" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={submit} loading={saving} className="flex-1">
          {paying > 0 ? '✅ تأكيد وإنهاء' : '✅ إنهاء من غير دفع'}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
          رجوع
        </Button>
      </div>
    </div>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold wrap-break-word" style={{ color: color ?? C.primary }}>{value}</p>
    </div>
  )
}
