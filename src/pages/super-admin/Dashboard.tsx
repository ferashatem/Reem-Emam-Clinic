import { useEffect, useState } from 'react'
import { getDocs, query, collection, where } from 'firebase/firestore'
import { db } from '../../services/firebase'
import StatCard from '../../components/ui/StatCard'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatDateAr, formatPrice } from '../../utils/formatters'
import { todayISO } from '../../utils/formatters'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, todayRes: 0, monthRevenue: 0, pending: 0 })
  const [todayReservations, setTodayReservations] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [serviceMap, setServiceMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = todayISO()
      const thisMonth = today.slice(0, 7)

      const [clientsSnap, reservationsSnap, servicesSnap] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('deleted_at', '==', null))),
        getDocs(query(collection(db, 'reservations'), where('deleted_at', '==', null))),
        getDocs(collection(db, 'services')),
      ])

      const reservations = reservationsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      const todayRes = reservations.filter(r => r.date === today)
      const pending = reservations.filter(r => r.status === 'pending').length
      const monthRevenue = reservations
        .filter(r => r.status === 'completed' && r.date?.startsWith(thisMonth))
        .reduce((sum: number, r: any) => sum + (r.price_at_booking || 0), 0)

      setStats({ clients: clientsSnap.size, todayRes: todayRes.length, monthRevenue, pending })
      setTodayReservations(todayRes.sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5))
      setClientMap(Object.fromEntries(clientsSnap.docs.map(d => [d.id, d.data()])))
      setServiceMap(Object.fromEntries(servicesSnap.docs.map(d => [d.id, d.data()])))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Today: ${formatDateAr(todayISO())}`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard label="Total Clients" value={stats.clients} icon="👩" />
        <StatCard label="Today's Bookings" value={stats.todayRes} icon="📅" color="#C9956C" />
        <StatCard label="Monthly Revenue" value={formatPrice(stats.monthRevenue)} icon="💰" color="#059669" />
        <StatCard label="Pending" value={stats.pending} icon="⏳" color="#F59E0B" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: '#F2C4CE' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: '#8B3A52' }}>حجوزات اليوم</h2>
        {todayReservations.length === 0 ? (
          <p className="text-center text-gray-400 py-8">مفيش حجوزات النهارده</p>
        ) : (
          <table className="w-full" dir="rtl">
            <thead>
              <tr>
                {['العميلة', 'الخدمة', 'الوقت', 'الحالة', 'السعر'].map(h => (
                  <th key={h} className="text-right text-xs font-semibold text-gray-400 pb-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayReservations.map(r => (
                <tr key={r.id} className="border-t" style={{ borderColor: '#F2C4CE20' }}>
                  <td className="py-3 text-sm font-medium text-right">{clientMap[r.client_id]?.name ?? r.client_id}</td>
                  <td className="py-3 text-sm text-gray-500 text-right">{serviceMap[r.service_id]?.name ?? '-'}</td>
                  <td className="py-3 text-sm text-right">{r.time}</td>
                  <td className="py-3 text-right"><StatusBadge status={r.status} /></td>
                  <td className="py-3 text-sm font-medium text-right" style={{ color: '#8B3A52' }}>{formatPrice(r.price_at_booking)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
