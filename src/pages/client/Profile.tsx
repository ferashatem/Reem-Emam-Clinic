import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import { getReservationsByClient, updateClient, getClientByUid } from '../../services/firestore'
import { formatDateAr } from '../../utils/formatters'
import type { DocumentData } from 'firebase/firestore'
import toast from 'react-hot-toast'

const skinTypes = ['جافة', 'دهنية', 'مختلطة', 'عادية', 'حساسة']
const sources = ['واتساب', 'إنستجرام', 'فيسبوك', 'صديقة', 'بحث جوجل', 'أخرى']

const skinTypeLabel: Record<string, string> = {
  normal: 'عادية',
  dry: 'جافة',
  oily: 'دهنية',
  combination: 'مختلطة',
  sensitive: 'حساسة',
}

export default function ClientProfile() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', age: '', skin_type: '', source: '' })

  useEffect(() => {
    if (!client?.id) return
    getReservationsByClient(client.id).then(r => {
      setReservations(r)
      setLoading(false)
    })
  }, [client?.id])

  function openEdit() {
    setForm({
      name: client?.name || '',
      age: client?.age ? String(client.age) : '',
      skin_type: client?.skin_type || '',
      source: (client as any)?.source || '',
    })
    setEditing(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('أدخلي اسمك')
    if (!client?.uid) return
    setSaving(true)
    try {
      const existing = await getClientByUid(client.uid)
      if (existing) {
        await updateClient(existing.id as string, {
          name: form.name.trim(),
          ...(form.age ? { age: Number(form.age) } : {}),
          ...(form.skin_type ? { skin_type: form.skin_type } : {}),
          ...(form.source ? { source: form.source } : {}),
        })
        toast.success('تم حفظ البيانات')
        setEditing(false)
      }
    } catch {
      toast.error('حدث خطأ، حاولي مرة أخرى')
    } finally {
      setSaving(false)
    }
  }

  const completed = reservations.filter(r => r.status === 'completed')
  const sortedDates = reservations.map(r => r.date).sort()
  const firstVisit = sortedDates[0]

  // Most used service
  const serviceCounts: Record<string, number> = {}
  completed.forEach(r => {
    if (r.service_name) serviceCounts[r.service_name] = (serviceCounts[r.service_name] || 0) + 1
  })
  const mostUsed = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // Sessions needing review
  const needsReview = completed.find(r => !r.reviewed)

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header card */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: 'linear-gradient(135deg, #8B3A52, #C9956C)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <h1 className="text-xl font-bold">{client?.name}</h1>
            <p className="text-sm opacity-80">{client?.phone}</p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: '#8B3A52' }}>بياناتي</h2>
          {!editing && (
            <button onClick={openEdit} className="text-xs px-3 py-1 rounded-full border font-medium transition-colors"
              style={{ borderColor: '#8B3A52', color: '#8B3A52' }}>
              تعديل
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">الاسم *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#F2C4CE' }}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">السن</label>
              <input type="number" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                min={10} max={100} dir="ltr"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#F2C4CE' }}
                onFocus={e => (e.target.style.borderColor = '#8B3A52')}
                onBlur={e => (e.target.style.borderColor = '#F2C4CE')} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">نوع البشرة</label>
              <div className="flex flex-wrap gap-2">
                {skinTypes.map(t => (
                  <button key={t} type="button" onClick={() => setForm(p => ({ ...p, skin_type: p.skin_type === t ? '' : t }))}
                    className="px-3 py-1 rounded-full text-xs border transition-all"
                    style={form.skin_type === t
                      ? { backgroundColor: '#8B3A52', color: '#fff', borderColor: '#8B3A52' }
                      : { borderColor: '#F2C4CE', color: '#8B3A52' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">إزاي عرفتي عننا؟</label>
              <div className="flex flex-wrap gap-2">
                {sources.map(s => (
                  <button key={s} type="button" onClick={() => setForm(p => ({ ...p, source: p.source === s ? '' : s }))}
                    className="px-3 py-1 rounded-full text-xs border transition-all"
                    style={form.source === s
                      ? { backgroundColor: '#C9956C', color: '#fff', borderColor: '#C9956C' }
                      : { borderColor: '#F2C4CE', color: '#C9956C' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#8B3A52' }}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2.5">
            {[
              { label: 'الاسم', value: client?.name },
              { label: 'التليفون', value: client?.phone },
              { label: 'السن', value: client?.age ? `${client.age} سنة` : '—' },
              { label: 'نوع البشرة', value: client?.skin_type ? (skinTypeLabel[client.skin_type] || client.skin_type) : '—' },
            ].map(field => (
              <div key={field.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{field.label}</span>
                <span className="font-medium" style={{ color: '#2C1A1D' }}>{field.value || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {!loading && (
        <div className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: '#8B3A52' }}>إحصائياتي</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'إجمالي الجلسات', value: reservations.length },
              { label: 'الجلسات المكتملة', value: completed.length },
              { label: 'أول زيارة', value: firstVisit ? formatDateAr(firstVisit).split('،')[1]?.trim() || '—' : '—' },
              { label: 'الخدمة الأكتر', value: mostUsed || '—' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-3" style={{ backgroundColor: '#FDF6F0' }}>
                <p className="text-lg font-bold" style={{ color: '#8B3A52' }}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review prompt */}
      {needsReview && (
        <div className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#8B3A52' }}>قيّمي جلستك ⭐</h2>
          <p className="text-xs text-gray-500 mb-3">
            رأيك يهمنا! قيّمي آخر جلسة ومساعدينا نتحسن أكتر 💕
          </p>
          <button
            onClick={() => navigate(`/client/review/${needsReview.id}`)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#8B3A52' }}
          >
            قيّمي الجلسة
          </button>
        </div>
      )}
    </div>
  )
}
