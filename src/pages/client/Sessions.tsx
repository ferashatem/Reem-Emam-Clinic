import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import { getReservationsByClient } from '../../services/firestore'
import { formatDateAr } from '../../utils/formatters'
import type { DocumentData } from 'firebase/firestore'

type Filter = 'all' | 'upcoming' | 'completed'

const statusLabel: Record<string, string> = {
  pending: 'منتظرة تأكيد',
  confirmed: 'مؤكدة',
  completed: 'مكتملة',
  cancelled: 'ملغية',
}

const statusStyle: Record<string, { backgroundColor: string; color: string }> = {
  pending: { backgroundColor: '#FEF3C7', color: '#92400e' },
  confirmed: { backgroundColor: '#d1fae5', color: '#065f46' },
  completed: { backgroundColor: '#EDE9FE', color: '#5b21b6' },
  cancelled: { backgroundColor: '#FEE2E2', color: '#991b1b' },
}

export default function ClientSessions() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<DocumentData[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client?.id) return
    getReservationsByClient(client.id).then(r => {
      setReservations(r)
      setLoading(false)
    })
  }, [client?.id])

  const today = new Date().toISOString().split('T')[0]

  const filtered = reservations.filter(r => {
    if (filter === 'upcoming') return r.date >= today && r.status !== 'cancelled' && r.status !== 'completed'
    if (filter === 'completed') return r.status === 'completed'
    return true
  })

  const completedCount = reservations.filter(r => r.status === 'completed').length

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: '#8B3A52' }}>جلساتي</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          حضرتي <span className="font-bold" style={{ color: '#8B3A52' }}>{completedCount}</span> جلسة 💆
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {([['all', 'الكل'], ['upcoming', 'القادمة'], ['completed', 'المكتملة']] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              backgroundColor: filter === f ? '#8B3A52' : 'white',
              color: filter === f ? 'white' : '#8B3A52',
              border: `1px solid ${filter === f ? '#8B3A52' : '#F2C4CE'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🌸</p>
          <p className="text-gray-500 text-sm">مفيش جلسات هنا لسه</p>
          <button
            onClick={() => navigate('/client/book')}
            className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#8B3A52' }}
          >
            احجزي موعد
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-2xl p-4 border shadow-sm"
              style={{ borderColor: '#F2C4CE' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: '#2C1A1D' }}>
                    {r.service_name || 'جلسة'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDateAr(r.date)} — {r.time}</p>
                  {r.notes && <p className="text-xs text-gray-400 mt-1 truncate">{r.notes}</p>}
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap mr-2"
                  style={statusStyle[r.status] || { backgroundColor: '#F2F2F2', color: '#666' }}
                >
                  {statusLabel[r.status] || r.status}
                </span>
              </div>
              {r.status === 'completed' && (
                <button
                  onClick={() => navigate(`/client/reports`)}
                  className="mt-3 text-xs font-medium"
                  style={{ color: '#8B3A52' }}
                >
                  عرض التقرير ←
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
