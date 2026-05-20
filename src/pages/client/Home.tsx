import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import { getReservationsByClient, getSessionReportsByClient } from '../../services/firestore'
import { formatDateAr } from '../../utils/formatters'
import type { DocumentData } from 'firebase/firestore'

export default function ClientHome() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<DocumentData[]>([])
  const [reportsCount, setReportsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client?.id) return
    Promise.all([
      getReservationsByClient(client.id),
      getSessionReportsByClient(client.id),
    ]).then(([res, reports]) => {
      setReservations(res)
      setReportsCount(reports.length)
      setLoading(false)
    })
  }, [client?.id])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = reservations
    .filter(r => r.date >= today && (r.status === 'confirmed' || r.status === 'pending'))
    .sort((a, b) => (a.date > b.date ? 1 : -1))
  const nextSession = upcoming[0]

  const completed = reservations.filter(r => r.status === 'completed')
  const lastVisit = completed[0]?.date

  const statusLabel: Record<string, string> = {
    pending: 'منتظرة تأكيد',
    confirmed: 'مؤكدة ✅',
    completed: 'مكتملة',
    cancelled: 'ملغية',
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Welcome */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #8B3A52, #C9956C)' }}>
        <p className="text-sm opacity-80">أهلاً بك ✨</p>
        <h1 className="text-2xl font-bold mt-1">{client?.name}</h1>
        <p className="text-sm opacity-70 mt-1">يسعدنا وجودك في ريم غلو هاوس 🌸</p>
      </div>

      {/* Next session */}
      <div>
        <h2 className="text-sm font-semibold mb-2" style={{ color: '#8B3A52' }}>الموعد القادم</h2>
        {nextSession ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: '#2C1A1D' }}>
                  {nextSession.service_name || 'جلسة'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{formatDateAr(nextSession.date)} — {nextSession.time}</p>
              </div>
              <span
                className="text-xs px-3 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: nextSession.status === 'confirmed' ? '#d1fae5' : '#FEF3C7',
                  color: nextSession.status === 'confirmed' ? '#065f46' : '#92400e',
                }}
              >
                {statusLabel[nextSession.status]}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 text-center border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
            <p className="text-2xl mb-2">🌸</p>
            <p className="text-sm text-gray-500 mb-3">مفيش موعد قادم</p>
            <button
              onClick={() => navigate('/client/book')}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#8B3A52' }}
            >
              احجزي دلوقتي
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي الجلسات', value: reservations.length },
          { label: 'آخر زيارة', value: lastVisit ? formatDateAr(lastVisit).split('،')[1]?.trim() || '—' : '—' },
          { label: 'التقارير', value: reportsCount },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-3 text-center shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
            <p className="text-xl font-bold" style={{ color: '#8B3A52' }}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/client/book')}
          className="rounded-2xl p-4 text-white text-sm font-semibold flex flex-col items-center gap-2"
          style={{ backgroundColor: '#8B3A52' }}
        >
          <span className="text-2xl">✨</span>
          احجزي موعد
        </button>
        <button
          onClick={() => navigate('/client/reports')}
          className="rounded-2xl p-4 text-sm font-semibold flex flex-col items-center gap-2 border"
          style={{ borderColor: '#F2C4CE', color: '#8B3A52', backgroundColor: '#fff' }}
        >
          <span className="text-2xl">📋</span>
          شوفي تقاريرك
        </button>
      </div>
    </div>
  )
}
