import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { saveClientByUid } from '../../services/firestore'
import toast from 'react-hot-toast'

const skinTypes = ['جافة', 'دهنية', 'مختلطة', 'عادية', 'حساسة']
const sources = ['واتساب', 'إنستجرام', 'فيسبوك', 'صديقة', 'بحث جوجل', 'أخرى']

export default function Onboarding() {
  const { clientProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    age: '',
    skin_type: '',
    source: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('أدخلي اسمك')
    if (!clientProfile?.uid) return

    setLoading(true)
    try {
      await saveClientByUid(clientProfile.uid, {
        phone: clientProfile.phone,
        name: form.name.trim(),
        ...(form.age ? { age: Number(form.age) } : {}),
        ...(form.skin_type ? { skin_type: form.skin_type } : {}),
        ...(form.source ? { source: form.source } : {}),
      })
      toast.success('أهلاً بك! 🌸')
      navigate('/client/home', { replace: true })
    } catch {
      toast.error('حدث خطأ، حاولي مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FDF6F0' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
            style={{ backgroundColor: '#F2C4CE' }}>
            <span className="text-3xl">🌸</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#8B3A52' }}>أهلاً بك في ريم غلو هاوس</h1>
          <p className="text-sm mt-1 text-gray-500">أكملي بياناتك لنقدم لك أفضل تجربة</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border" style={{ borderColor: '#F2C4CE' }}>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>
                الاسم <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="اسمك الكريم"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                style={{ borderColor: '#F2C4CE' }}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>العمر</label>
              <input
                type="number"
                value={form.age}
                onChange={e => set('age', e.target.value)}
                placeholder="عمرك"
                min={10}
                max={100}
                dir="ltr"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                style={{ borderColor: '#F2C4CE' }}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')}
              />
            </div>

            {/* Skin type */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>نوع البشرة</label>
              <div className="flex flex-wrap gap-2">
                {skinTypes.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('skin_type', form.skin_type === t ? '' : t)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-all"
                    style={form.skin_type === t
                      ? { backgroundColor: '#8B3A52', color: '#fff', borderColor: '#8B3A52' }
                      : { borderColor: '#F2C4CE', color: '#8B3A52' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>إزاي عرفتي عننا؟</label>
              <div className="flex flex-wrap gap-2">
                {sources.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('source', form.source === s ? '' : s)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-all"
                    style={form.source === s
                      ? { backgroundColor: '#C9956C', color: '#fff', borderColor: '#C9956C' }
                      : { borderColor: '#F2C4CE', color: '#C9956C' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#8B3A52' }}
            >
              {loading ? 'جارٍ الحفظ...' : 'ابدأي رحلتك معنا ✨'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/client/home', { replace: true })}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              تخطي الآن
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
