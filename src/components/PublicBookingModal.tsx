import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createReservation } from '../services/firestore'
import { normalizePhone, validateEgyptianPhone } from '../utils/validators'
import { todayISO } from '../utils/formatters'
import { messageFor } from '../hooks/useLoader'

interface Service {
  id: string
  name: string
  description?: string
  duration_minutes?: number
  price?: number
}

interface Props {
  service: Service | null
  onClose: () => void
}

const TIME_SLOTS: string[] = []
for (let h = 11; h <= 21; h++) {
  for (const m of ['00', '30']) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${m}`)
  }
}

interface FormState {
  name: string
  phone: string
  date: string
  time: string
  notes: string
}

const empty: FormState = { name: '', phone: '', date: '', time: '', notes: '' }

/**
 * Public booking request — no account, no OTP, no login.
 * Writes a `pending` reservation with the visitor's name and phone but no
 * `client_id`; the assistant links (or creates) the patient file when she
 * confirms the request from the dashboard.
 */
export default function PublicBookingModal({ service, onClose }: Props) {
  const [form, setForm] = useState<FormState>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

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
    if (!form.date) next.date = 'اختاري التاريخ'
    else if (form.date < todayISO()) next.date = 'التاريخ لازم يكون النهاردة أو بعده'
    if (!form.time) next.time = 'اختاري الوقت'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!validate()) return

    setLoading(true)
    try {
      await createReservation({
        // No account yet — the assistant links this to a patient file on confirm
        client_id: null,
        client_name: form.name.trim(),
        client_phone: normalizePhone(form.phone),
        service_id: service?.id ?? null,
        service_name: service?.name ?? null,
        pulses: null,
        price_per_pulse: null,
        // Priced after the session, once the pulse count is known
        price_at_booking: 0,
        priced_at: null,
        paid_amount: 0,
        payment_status: 'unpaid',
        date: form.date,
        time: form.time,
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle} htmlFor="pb-date">التاريخ</label>
                <input
                  id="pb-date"
                  style={fieldBorder('date')}
                  type="date"
                  min={todayISO()}
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                />
                {errors.date && <p style={errorStyle}>{errors.date}</p>}
              </div>
              <div>
                <label style={labelStyle} htmlFor="pb-time">الوقت</label>
                <select
                  id="pb-time"
                  style={fieldBorder('time')}
                  value={form.time}
                  onChange={e => set('time', e.target.value)}
                >
                  <option value="">اختاري الوقت</option>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.time && <p style={errorStyle}>{errors.time}</p>}
              </div>
            </div>

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

            <button type="submit" style={btnStyle} disabled={loading}>
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
