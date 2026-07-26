import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConfirmationResult } from 'firebase/auth'
import toast from 'react-hot-toast'
import { initRecaptcha, destroyRecaptcha, sendOTP } from '../services/auth'
import { getClientByPhone, getClientByUid, createClient, linkUidToClient, createReservation } from '../services/firestore'
import { normalizePhone, validateEgyptianPhone } from '../utils/validators'
import { Timestamp } from 'firebase/firestore'

const RESEND_COOLDOWN = 60

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

type Step = 'form' | 'otp' | 'creating'

const TIME_SLOTS: string[] = []
for (let h = 9; h < 20; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

const todayISO = () => new Date().toISOString().split('T')[0]

export default function PublicBookingModal({ service, onClose }: Props) {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recaptchaRef = useRef(false)

  function startResendCountdown() {
    setResendCountdown(RESEND_COOLDOWN)
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current) }, [])

  useEffect(() => {
    // `cancelled` prevents StrictMode's first (thrown-away) effect from
    // marking the verifier ready after the cleanup has already run.
    let cancelled = false

    initRecaptcha()
      .then(() => { if (!cancelled) recaptchaRef.current = true })
      .catch(e => console.error('reCAPTCHA init error', e))

    return () => {
      cancelled = true
      destroyRecaptcha()
    }
  }, [])

  async function doSendOTP(normalized: string) {
    setLoading(true)
    try {
      const result = await sendOTP(normalized)
      setConfirmation(result)
      setStep('otp')
      startResendCountdown()
      toast.success('تم إرسال رمز التحقق 📱')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast.error(msg.includes('too-many-requests') ? 'طلبات كثيرة، حاولي لاحقاً' : 'فشل إرسال الرمز، حاولي مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('من فضلك أدخلي اسمك')
    if (!phone.trim()) return toast.error('من فضلك أدخلي رقم هاتفك')
    if (!validateEgyptianPhone(phone)) return toast.error('رقم الهاتف غير صحيح')
    if (!date) return toast.error('من فضلك اختاري التاريخ')
    if (!time) return toast.error('من فضلك اختاري الوقت')
    await doSendOTP(normalizePhone(phone))
  }

  async function handleResendOTP() {
    if (resendCountdown > 0) return
    await doSendOTP(normalizePhone(phone))
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!otp.trim() || otp.length < 6) return toast.error('أدخلي الرمز المكون من 6 أرقام')
    setLoading(true)
    try {
      const credential = await confirmation!.confirm(otp)
      const uid = credential.user.uid
      const normalized = normalizePhone(phone)

      setStep('creating')

      // Find or create client
      let clientId: string

      const existingByUid = await getClientByUid(uid) as { id: string } | null
      if (existingByUid) {
        clientId = existingByUid.id
      } else {
        const existingByPhone = await getClientByPhone(normalized) as { id: string; uid?: string } | null
        if (existingByPhone) {
          if (!existingByPhone.uid) {
            await linkUidToClient(existingByPhone.id, uid)
          }
          clientId = existingByPhone.id
        } else {
          const docRef = await createClient({
            name: name.trim(),
            phone: normalized,
            uid,
            source: 'website',
          })
          clientId = docRef.id
        }
      }

      // Create reservation
      await createReservation({
        client_id: clientId,
        // Denormalised so the assistant's list reads without extra lookups
        client_name: name.trim(),
        client_phone: normalized,
        service_id: service?.id ?? null,
        service_name: service?.name ?? null,
        pulses: null,
        price_per_pulse: null,
        price_at_booking: service?.price ?? 0,
        paid_amount: 0,
        payment_status: 'unpaid',
        date,
        time,
        notes: notes.trim() || null,
        status: 'pending',
        booked_by: 'client',
        admin_id: null,
        created_at: Timestamp.now(),
      })

      toast.success('تم إرسال طلب الحجزك! هنتواصل معاكي للتأكيد 🌸', { duration: 5000 })
      navigate('/client/home')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('invalid-verification-code') || msg.includes('invalid-code')) {
        toast.error('رمز التحقق غير صحيح')
        setStep('otp')
      } else {
        toast.error('حدث خطأ، حاولي مرة أخرى')
        setStep('form')
      }
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
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.2s',
    marginTop: '0.5rem',
  }

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
          padding: '2rem',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #F2C4CE',
          boxShadow: '0 24px 80px rgba(139,58,82,0.18)',
          direction: 'rtl',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8B3A52', margin: 0 }}>
              {step === 'form' ? 'احجزي موعدك 🌸' : step === 'otp' ? 'رمز التحقق 📱' : 'جاري تأكيد الحجز...'}
            </h2>
            {service && step === 'form' && (
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

        {/* Step: Form */}
        {step === 'form' && (
          <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>الاسم الكامل</label>
              <input
                style={inputStyle}
                placeholder="اسمك الكامل"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
              />
            </div>

            <div>
              <label style={labelStyle}>رقم التليفون</label>
              <input
                style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
                placeholder="01xxxxxxxxx"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>التاريخ</label>
                <input
                  style={inputStyle}
                  type="date"
                  min={todayISO()}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                />
              </div>
              <div>
                <label style={labelStyle}>الوقت</label>
                <select
                  style={inputStyle}
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                >
                  <option value="">اختاري الوقت</option>
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>ملاحظات (اختياري)</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="أي ملاحظات أو استفسارات..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
              />
            </div>

            <button type="submit" style={btnStyle} disabled={loading}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              {loading ? 'جارٍ الإرسال...' : 'تأكيد الحجز 🌸'}
            </button>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <p style={{ fontSize: '0.9rem', color: '#785060', textAlign: 'center' }}>
              تم إرسال رمز مكون من 6 أرقام إلى<br />
              <strong style={{ direction: 'ltr', display: 'inline-block' }}>{phone}</strong>
            </p>

            <div>
              <label style={labelStyle}>الرمز السري</label>
              <input
                style={{ ...inputStyle, textAlign: 'center', fontSize: '1.6rem', letterSpacing: '0.4em', fontFamily: 'monospace', direction: 'ltr' }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                autoFocus
              />
            </div>

            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'جارٍ التحقق...' : 'تحقق وأكد الحجز'}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendCountdown > 0 || loading}
                style={{
                  background: 'none', border: 'none', cursor: resendCountdown > 0 ? 'default' : 'pointer',
                  fontSize: '0.88rem', fontFamily: 'Tajawal, sans-serif',
                  color: resendCountdown > 0 ? '#9ca3af' : '#8B3A52',
                  opacity: resendCountdown > 0 ? 0.7 : 1,
                }}
              >
                {resendCountdown > 0 ? `إعادة الإرسال بعد ${resendCountdown}ث` : 'إعادة إرسال الرمز'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('form'); setOtp(''); setResendCountdown(0) }}
                style={{ background: 'none', border: 'none', color: '#C9956C', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'Tajawal, sans-serif' }}
              >
                ← تغيير البيانات
              </button>
            </div>
          </form>
        )}

        {/* Step: Creating */}
        {step === 'creating' && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '4px solid #F2C4CE', borderTopColor: '#8B3A52',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
            }} />
            <p style={{ color: '#8B3A52', fontWeight: 600 }}>جارٍ تأكيد حجزك...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  )
}
