import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createReservation } from '../services/firestore'
import { getSlotUsage } from '../services/availability'
import { normalizePhone, validateEgyptianPhone } from '../utils/validators'
import { formatTime, todayISO } from '../utils/formatters'
import { CLINIC_SLOTS, fitsInSlot, isSlotPast, slotOf } from '../utils/slots'
import { messageFor } from '../hooks/useLoader'
import { sessionMinutes } from '../utils/services'
import type { Service } from '../types'

interface Props {
  service: Service | null
  /** The types inside this service — she must pick one before booking. */
  options?: Service[]
  onClose: () => void
}

interface FormState {
  name: string
  phone: string
  option: string
  date: string
  time: string
  notes: string
}

const empty: FormState = { name: '', phone: '', option: '', date: '', time: '', notes: '' }

/**
 * Public booking request — no account, no OTP, no login.
 * Writes a `pending` reservation with the visitor's name and phone but no
 * `client_id`; the assistant links (or creates) the patient file when she
 * confirms the request from the dashboard.
 */
export default function PublicBookingModal({ service, options = [], onClose }: Props) {
  const [form, setForm] = useState<FormState>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  /** Minutes already committed in each hour of the chosen day. */
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [checking, setChecking] = useState(false)

  // How full each hour of the chosen day is. Read from the name-free mirror —
  // the visitor learns how much of an hour is spoken for, never by whom.
  useEffect(() => {
    if (!form.date) return
    let live = true
    getSlotUsage(form.date)
      .then(next => { if (live) setUsage(next) })
      .catch(() => { if (live) setUsage({}) })
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [form.date])

  /** How much of the hour this booking will take — the type's length wins. */
  const chosenService = options.find(o => o.id === form.option) ?? service
  const minutes = sessionMinutes(chosenService, service ? [service, ...options] : options)

  // An hour holds 60 minutes. A half-hour session sitting in it leaves room for
  // a shorter one, so what counts as "taken" depends on what she picked.
  const slots = useMemo(
    () => CLINIC_SLOTS.map(slot => {
      const used = usage[slot] ?? 0
      return {
        slot,
        used,
        taken: !fitsInSlot(used, minutes),
        past: isSlotPast(form.date, slot),
      }
    }),
    [usage, minutes, form.date]
  )

  const freeCount = slots.filter(s => !s.taken && !s.past).length
  const dayFull = !!form.date && !checking && freeCount === 0

  // The day can fill up while she is filling the form, and a longer type can
  // shut an hour that was open when she picked it. Rather than quietly keeping
  // a slot that no longer works, the field falls back to its placeholder — the
  // option is disabled below, so there is nothing to select.
  const time = slots.some(s => s.slot === form.time && !s.taken && !s.past) ? form.time : ''

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (form.name.trim().length < 2) next.name = 'من فضلك اكتبي اسمك'
    if (!form.phone.trim()) next.phone = 'من فضلك اكتبي رقم تليفونك'
    else if (!validateEgyptianPhone(form.phone)) next.phone = 'رقم التليفون مش صحيح'
    if (options.length > 0 && !form.option) next.option = 'اختاري النوع'
    if (!form.date) next.date = 'اختاري التاريخ'
    else if (form.date < todayISO()) next.date = 'التاريخ لازم يكون النهاردة أو بعده'
    if (!time) next.time = 'اختاري الوقت'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!validate()) return

    // Someone may have claimed the rest of this hour while she filled the form.
    const fresh = await getSlotUsage(form.date).catch(() => usage)
    if (!fitsInSlot(fresh[slotOf(time)] ?? 0, minutes)) {
      setUsage(fresh)
      setForm(f => ({ ...f, time: '' }))
      setErrors(e => ({ ...e, time: 'المعاد ده اتحجز للتو — اختاري معاد تاني' }))
      return
    }

    // The booking lands on the type she picked; without types, on the service.
    const chosen = options.find(o => o.id === form.option) ?? service

    setLoading(true)
    try {
      await createReservation({
        // No account yet — the assistant links this to a patient file on confirm
        client_id: null,
        client_name: form.name.trim(),
        client_phone: normalizePhone(form.phone),
        service_id: chosen?.id ?? null,
        // What the hour has to keep free for her.
        duration_minutes: minutes,
        // «ليزر — كانديلا»: every screen reads this one field, so both levels
        // have to arrive already joined.
        service_name: chosen
          ? (chosen.id === service?.id ? chosen.name : `${service?.name} — ${chosen.name}`)
          : null,
        // Priced after the session
        price_at_booking: 0,
        priced_at: null,
        paid_amount: 0,
        payment_status: 'unpaid',
        date: form.date,
        time,
        notes: form.notes.trim(),
        status: 'pending',
        booked_by: 'client',
        admin_id: null,
      })
      setDone(true)
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid #F2C4CE',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    fontFamily: 'Tajawal, sans-serif',
    outline: 'none',
    backgroundColor: 'white',
    color: '#2C1A1D',
    transition: 'border-color 0.2s',
  }

  const errorStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#DC2626',
    marginTop: '0.35rem',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#8B3A52',
    marginBottom: '0.4rem',
  }

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.9rem',
    background: 'linear-gradient(135deg, #C9956C, #8B3A52)',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: 'Tajawal, sans-serif',
    cursor: loading ? 'default' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'opacity 0.2s',
    marginTop: '0.5rem',
  }

  // Turns wine-red once the day has nothing left to give
  const noteStyle: React.CSSProperties = {
    margin: 0,
    padding: '0.7rem 0.9rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
    lineHeight: 1.7,
    border: `1px solid ${dayFull ? 'rgba(160,42,62,0.4)' : '#F2C4CE'}`,
    background: dayFull ? 'rgba(160,42,62,0.08)' : 'rgba(242,196,206,0.18)',
    color: dayFull ? '#8B3A52' : '#785060',
    fontWeight: dayFull ? 600 : 400,
  }

  const fieldBorder = (key: keyof FormState) => ({
    ...inputStyle,
    borderColor: errors[key] ? '#DC2626' : '#F2C4CE',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(44, 26, 29, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#FDF6F0',
          borderRadius: '24px',
          padding: '1.75rem',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #F2C4CE',
          boxShadow: '0 24px 80px rgba(139,58,82,0.18)',
          direction: 'rtl',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8B3A52', margin: 0 }}>
              {done ? 'تم إرسال طلبك 🌸' : 'احجزي موعدك 🌸'}
            </h2>
            {service && !done && (
              <p style={{ fontSize: '0.85rem', color: '#C9956C', marginTop: '0.25rem' }}>{service.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#C9956C', lineHeight: 1 }}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
            <p style={{ color: '#2C1A1D', fontWeight: 600, marginBottom: '0.5rem' }}>
              وصلنا طلب حجزك يا {form.name.trim()}
            </p>
            <p style={{ color: '#785060', fontSize: '0.9rem', lineHeight: 1.7 }}>
              هنتواصل معاكي على <strong style={{ direction: 'ltr', display: 'inline-block' }}>{form.phone}</strong>
              {' '}عشان نأكد الميعاد.
            </p>
            <button onClick={onClose} style={{ ...btnStyle, marginTop: '1.5rem', cursor: 'pointer', opacity: 1 }}>
              تمام
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>
            <div>
              <label style={labelStyle} htmlFor="pb-name">الاسم</label>
              <input
                id="pb-name"
                style={fieldBorder('name')}
                placeholder="اسمك الكامل"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>

            <div>
              <label style={labelStyle} htmlFor="pb-phone">رقم التليفون</label>
              <input
                id="pb-phone"
                style={{ ...fieldBorder('phone'), direction: 'ltr', textAlign: 'right' }}
                placeholder="01xxxxxxxxx"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />
              {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
            </div>

            {/* Only services that actually branch ask a second question —
                «كشف» stays one click, «ليزر» asks which device. */}
            {options.length > 0 && (
              <div>
                <label style={labelStyle} htmlFor="pb-option">النوع</label>
                <select
                  id="pb-option"
                  style={fieldBorder('option')}
                  value={form.option}
                  onChange={e => set('option', e.target.value)}
                >
                  <option value="">اختاري النوع</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {errors.option && <p style={errorStyle}>{errors.option}</p>}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle} htmlFor="pb-date">التاريخ</label>
                <input
                  id="pb-date"
                  style={fieldBorder('date')}
                  type="date"
                  min={todayISO()}
                  value={form.date}
                  // A new day means a fresh set of hours — drop the old pick
                  onChange={e => {
                    setUsage({})
                    // The lookup starts in the effect above; flag it here so the
                    // field doesn't flash "all free" before the answer lands.
                    setChecking(!!e.target.value)
                    setForm(f => ({ ...f, date: e.target.value, time: '' }))
                    setErrors(err => ({ ...err, date: undefined, time: undefined }))
                  }}
                />
                {errors.date && <p style={errorStyle}>{errors.date}</p>}
              </div>
              <div>
                <label style={labelStyle} htmlFor="pb-time">الوقت</label>
                {/* Fixed hourly slots — she can only ask for an hour the
                    clinic can actually give her. */}
                <select
                  id="pb-time"
                  style={{ ...fieldBorder('time'), opacity: !form.date || checking ? 0.55 : 1 }}
                  value={time}
                  onChange={e => set('time', e.target.value)}
                  disabled={!form.date || checking}
                >
                  <option value="">اختاري الوقت</option>
                  {/* An hour is either open for this session or it isn't —
                      how much of it is left is the clinic's business. */}
                  {slots.map(({ slot, taken, past }) => (
                    <option
                      key={slot}
                      value={slot}
                      disabled={taken || past}
                      style={taken ? { color: '#C0392B' } : undefined}
                    >
                      {formatTime(slot)}
                      {taken ? ' — مليان' : past ? ' — فات' : ''}
                    </option>
                  ))}
                </select>
                {errors.time && <p style={errorStyle}>{errors.time}</p>}
              </div>
            </div>

            <p style={noteStyle} role="status">
              {!form.date
                ? 'اختاري اليوم الأول عشان نوريكِ المواعيد الفاضية.'
                : checking
                  ? 'بنشوف المواعيد المتاحة…'
                  : dayFull
                    ? 'اليوم ده محجوز بالكامل — من فضلك اختاري يوم تاني.'
                    : `الجلسة دي ${minutes} دقيقة — ${freeCount} معاد ينفعوا ليها. الساعة اللي فيها وقت فاضي بتقول قد إيه فاضل فيها.`}
            </p>

            <div>
              <label style={labelStyle} htmlFor="pb-notes">ملاحظات (اختياري)</label>
              <textarea
                id="pb-notes"
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="أي ملاحظات أو استفسارات..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

            <button type="submit" style={{ ...btnStyle, opacity: dayFull ? 0.5 : btnStyle.opacity }} disabled={loading || dayFull}>
              {loading ? 'جارٍ الإرسال...' : 'اطلبي الحجز 🌸'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#A8788A', margin: 0 }}>
              الحجز مبدئي — هنكلمك نأكد الميعاد 💕
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
