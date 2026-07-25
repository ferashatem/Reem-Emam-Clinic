import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConfirmationResult } from 'firebase/auth'
import toast from 'react-hot-toast'
import { initRecaptcha, sendOTP, signInWithUsername } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'

type Tab = 'client' | 'admin'

const RESEND_COOLDOWN = 60

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('client')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recaptchaInitialized = useRef(false)
  const navigate = useNavigate()
  const { role, loading: authLoading, clientProfile } = useAuth()

  useEffect(() => {
    if (!authLoading && role) {
      if (role === 'client') {
        const isNewClient = !clientProfile?.name || clientProfile.name === clientProfile?.phone
        navigate(isNewClient ? '/client/onboarding' : '/client/home', { replace: true })
      }
      else if (role === 'super_admin') navigate('/super-admin/dashboard', { replace: true })
      else if (role === 'staff') navigate('/staff/reservations', { replace: true })
      else navigate('/admin/dashboard', { replace: true })
    }
  }, [role, authLoading, navigate])

  useEffect(() => {
    if (authLoading) return
    if (recaptchaInitialized.current) return
    try {
      initRecaptcha()
      recaptchaInitialized.current = true
    } catch (e) {
      console.error('reCAPTCHA init error', e)
    }
  }, [authLoading])

  function startResendCountdown() {
    setResendCountdown(RESEND_COOLDOWN)
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current) }, [])

  function switchTab(t: Tab) {
    setTab(t)
    setStep('phone')
    setPhone('')
    setOtp('')
    setUsername('')
    setPassword('')
    setConfirmation(null)
    setResendCountdown(0)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return toast.error('أدخلي اسم المستخدم والباسورد')
    setLoading(true)
    try {
      await signInWithUsername(username, password)
      // Redirect handled by the auth-state effect above
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        toast.error('اسم المستخدم أو الباسورد غير صحيح')
      } else if (code === 'auth/too-many-requests') {
        toast.error('محاولات كتير، حاولي بعد شوية')
      } else {
        toast.error('فشل تسجيل الدخول، حاولي تاني')
      }
    } finally {
      setLoading(false)
    }
  }

  async function doSendOTP(normalized: string) {
    setLoading(true)
    try {
      const result = await sendOTP(normalized)
      setConfirmation(result)
      setStep('otp')
      startResendCountdown()
      toast.success('تم إرسال رمز التحقق')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ'
      if (msg.includes('too-many-requests')) {
        toast(
          (t) => (
            <div className="text-right text-sm space-y-2">
              <p className="font-semibold">تم إيقاف الرقم مؤقتاً بسبب كثرة المحاولات</p>
              <p className="text-gray-500">حاولي بعد ساعة أو تواصلي معنا على واتساب</p>
              <a
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => toast.dismiss(t.id)}
                className="inline-block px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ backgroundColor: '#25D366' }}
              >
                واتساب 💬
              </a>
            </div>
          ),
          { duration: 8000 }
        )
      } else {
        toast.error('فشل إرسال الرمز، حاولي مرة أخرى')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return toast.error('أدخلي رقم الهاتف')
    const normalized = normalizePhone(phone)
    if (!validateEgyptianPhone(phone)) return toast.error('رقم الهاتف غير صحيح')

    await doSendOTP(normalized)
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
      await confirmation!.confirm(otp)
    } catch {
      toast.error('رمز التحقق غير صحيح')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDF6F0' }}>
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FDF6F0' }}>
      <div id="recaptcha-container" />

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ backgroundColor: '#F2C4CE' }}>
            <span className="text-3xl">🌸</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#8B3A52' }}>ريم غلو هاوس</h1>
          <p className="text-sm mt-1" style={{ color: '#C9956C' }}>Beauty & Glow Clinic</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl overflow-hidden mb-6 border" style={{ borderColor: '#F2C4CE' }}>
          <button
            onClick={() => switchTab('client')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'client' ? 'text-white' : 'text-gray-500 bg-white'
            }`}
            style={tab === 'client' ? { backgroundColor: '#8B3A52' } : {}}
          >
            أنا عميلة 💆
          </button>
          <button
            onClick={() => switchTab('admin')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'admin' ? 'text-white' : 'text-gray-500 bg-white'
            }`}
            style={tab === 'admin' ? { backgroundColor: '#8B3A52' } : {}}
          >
            الإدارة 👑
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border" style={{ borderColor: '#F2C4CE' }}>
          {tab === 'admin' ? (
            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: '#2C1A1D' }}>تسجيل دخول الإدارة</h2>
                <p className="text-sm text-gray-500">أدخلي اسم المستخدم والباسورد</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>اسم المستخدم</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="username"
                  dir="ltr"
                  autoComplete="username"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-right"
                  style={{ borderColor: '#F2C4CE' }}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>الباسورد</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  dir="ltr"
                  autoComplete="current-password"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-right"
                  style={{ borderColor: '#F2C4CE' }}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#8B3A52' }}
              >
                {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
          ) : step === 'phone' ? (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: '#2C1A1D' }}>
                  {tab === 'client' ? 'ادخلي على بوابتك ✨' : 'تسجيل دخول الإدارة'}
                </h2>
                <p className="text-sm text-gray-500">
                  {tab === 'client'
                    ? 'أدخلي رقم هاتفك المسجل معنا'
                    : 'أدخلي رقم هاتفك لتلقي رمز التحقق'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all text-right"
                  style={{ borderColor: '#F2C4CE' }}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#8B3A52' }}
              >
                {loading ? 'جارٍ التحقق...' : 'إرسال رمز التحقق'}
              </button>

              {tab === 'client' && (
                <p className="text-center text-xs text-gray-400">
                  لو رقمك مش مسجل تواصلي معنا على واتساب 💕
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: '#2C1A1D' }}>رمز التحقق</h2>
                <p className="text-sm text-gray-500">تم إرسال رمز مكون من 6 أرقام إلى {phone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>
                  الرمز السري
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  dir="ltr"
                  maxLength={6}
                  className="w-full border rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none transition-all"
                  style={{ borderColor: '#F2C4CE' }}
                  onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                  onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#8B3A52' }}
              >
                {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول'}
              </button>

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendCountdown > 0 || loading}
                  className="text-sm disabled:opacity-40 transition-colors"
                  style={{ color: resendCountdown > 0 ? '#9ca3af' : '#8B3A52' }}
                >
                  {resendCountdown > 0
                    ? `إعادة الإرسال بعد ${resendCountdown}ث`
                    : 'إعادة إرسال الرمز'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); setResendCountdown(0) }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  تغيير رقم الهاتف
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ريم غلو هاوس — Beauty & Glow Clinic ♡
        </p>
      </div>
    </div>
  )
}
