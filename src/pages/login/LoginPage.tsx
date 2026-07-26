import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { signInWithUsername, usernameToEmail } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui/Feedback'
import { C } from '../../theme'

/** Team-only sign in. Clients never log in — they book straight from the site. */
export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { role, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading || !role) return
    if (role === 'super_admin') navigate('/super-admin/dashboard', { replace: true })
    else if (role === 'staff') navigate('/staff/reservations', { replace: true })
    else navigate('/admin/dashboard', { replace: true })
  }, [role, authLoading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('اكتبي الإيميل والباسورد')
      return
    }
    setLoading(true)
    try {
      await signInWithUsername(username, password)
      // Redirect handled by the auth-state effect above
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      // The generic message hides which of the two sides failed — log the real
      // reason so a failing account can be diagnosed instead of guessed at.
      console.error('Login failed', { email: usernameToEmail(username), code, err })
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        toast.error('الإيميل أو الباسورد غلط')
      } else if (code === 'auth/too-many-requests') {
        toast.error('محاولات كتير — حاولي بعد شوية')
      } else if (code === 'auth/network-request-failed') {
        toast.error('مفيش اتصال بالإنترنت')
      } else {
        toast.error('فشل تسجيل الدخول، حاولي تاني')
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Spinner />
      </div>
    )
  }

  const inputClass =
    'w-full border rounded-xl px-4 py-3 text-sm bg-white outline-none transition-colors ' +
    'focus:border-[#8B3A52] focus:ring-2 focus:ring-[#8B3A52]/20'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ backgroundColor: C.primarySoft }}
          >
            <span className="text-3xl">🌸</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: C.primary }}>ريم غلو هاوس</h1>
          <p className="text-sm mt-1" style={{ color: C.gold }}>دخول الفريق</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 border" style={{ borderColor: C.primarySoft }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold mb-1" style={{ color: C.text }}>تسجيل الدخول</h2>
              <p className="text-sm text-gray-500">للدكاترة والأسيستانت بس</p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: C.text }}>
                الإيميل
              </label>
              <input
                id="username"
                // Not type="email" — legacy accounts sign in with a bare username
                type="text"
                inputMode="email"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                autoComplete="username"
                className={inputClass}
                style={{ borderColor: C.primarySoft }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: C.text }}>
                الباسورد
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                dir="ltr"
                autoComplete="current-password"
                className={inputClass}
                style={{ borderColor: C.primarySoft }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: C.primary }}
            >
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6">
          <Link to="/" style={{ color: C.primary }}>← رجوع للموقع</Link>
        </p>
      </div>
    </div>
  )
}
