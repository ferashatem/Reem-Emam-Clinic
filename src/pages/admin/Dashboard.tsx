import { useEffect, useState } from 'react'
import { getDocs, query, collection, where } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/ui/StatCard'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDateAr, formatPrice, todayISO } from '../../utils/formatters'

export default function AdminDashboard() {
  const { userProfile } = useAuth()
  const [stats, setStats] = useState({ todayRes: 0, totalClients: 0, pending: 0, completed: 0 })
  const [todayReservations, setTodayReservations] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, any>>({})
  const [services, setServices] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userProfile) return
    async function load() {
      const today = todayISO()
      const [resSnap, clientsSnap, svcsSnap] = await Promise.all([
        getDocs(query(collection(db, 'reservations'), where('admin_id', '==', userProfile!.uid), where('deleted_at', '==', null))),
        getDocs(query(collection(db, 'clients'), where('deleted_at', '==', null))),
        getDocs(query(collection(db, 'services'), where('deleted_at', '==', null))),
      ])

      const reservations = resSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      const todayRes = reservations.filter(r => r.date === today)

      setStats({
        todayRes: todayRes.length,
        totalClients: clientsSnap.size,
        pending: reservations.filter(r => r.status === 'pending').length,
        completed: reservations.filter(r => r.status === 'completed').length,
      })
      setTodayReservations(todayRes.sort((a, b) => a.time.localeCompare(b.time)))
      setClients(Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()])))
      setServices(Object.fromEntries(svcsSnap.docs.map(d => [d.id, d.data()])))
      setLoading(false)
    }
    load()
  }, [userProfile])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>

  return (
    <div>
      <PageHeader title={`Welcome, ${userProfile?.name} 🌸`} subtitle={`Today: ${formatDateAr(todayISO())}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Today's Bookings" value={stats.todayRes} icon="📅" />
        <StatCard label="Total Clients" value={stats.totalClients} icon="👤" color="#C9956C" />
        <StatCard label="Pending" value={stats.pending} icon="⏳" color="#F59E0B" />
        <StatCard label="Completed" value={stats.completed} icon="✅" color="#059669" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: '#F2C4CE' }}>
        <h2 className="text-lg font-semibold mb-5" style={{ color: '#8B3A52' }}>Today's Appointments</h2>
        {todayReservations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🌙</p>
            <p className="text-gray-400">No appointments today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReservations.map(r => (
              <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl border hover:border-[#8B3A52]/30 transition-colors" style={{ borderColor: '#F2C4CE' }}>
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-bold" style={{ color: '#8B3A52' }}>{r.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{clients[r.client_id]?.name ?? '-'}</p>
                  <p className="text-xs text-gray-400">{services[r.service_id]?.name ?? '-'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: '#C9956C' }}>{formatPrice(r.price_at_booking)}</span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
