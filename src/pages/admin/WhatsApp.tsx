import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getReservations, getClients, getServices } from '../../services/firestore'
import { buildConfirmationMessage, buildReviewMessage, buildWhatsAppLink } from '../../utils/whatsapp'
import { formatDateAr } from '../../utils/formatters'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'

export default function WhatsApp() {
  const { userProfile } = useAuth()
  const [reservations, setReservations] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [serviceMap, setServiceMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'confirm' | 'review'>('confirm')

  useEffect(() => {
    if (!userProfile) return
    async function load() {
      const [res, cls, svcs] = await Promise.all([
        getReservations({ adminId: userProfile!.uid }),
        getClients(),
        getServices(),
      ])
      setReservations(res as any[])
      setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c])))
      setServiceMap(Object.fromEntries(svcs.map((s: any) => [s.id, s])))
      setLoading(false)
    }
    load()
  }, [userProfile])

  const confirmList = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed')
  const reviewList = reservations.filter(r => r.status === 'completed')

  function buildConfirmLink(r: any) {
    const client = clientMap[r.client_id]
    const service = serviceMap[r.service_id]
    if (!client) return '#'
    const msg = buildConfirmationMessage({
      clientName: client.name,
      date: formatDateAr(r.date),
      time: r.time,
      serviceName: service?.name ?? '',
      price: r.price_at_booking,
    })
    return buildWhatsAppLink(client.phone, msg)
  }

  function buildReviewLink(r: any) {
    const client = clientMap[r.client_id]
    if (!client) return '#'
    return buildWhatsAppLink(client.phone, buildReviewMessage(client.name))
  }

  const list = activeTab === 'confirm' ? confirmList : reviewList

  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Send confirmation messages and review requests via WhatsApp" />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('confirm')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'confirm' ? 'text-white' : 'border'}`}
          style={activeTab === 'confirm' ? { backgroundColor: '#8B3A52' } : { borderColor: '#F2C4CE', color: '#8B3A52' }}
        >
          Confirmation Messages ({confirmList.length})
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'review' ? 'text-white' : 'border'}`}
          style={activeTab === 'review' ? { backgroundColor: '#8B3A52' } : { borderColor: '#F2C4CE', color: '#8B3A52' }}
        >
          Request Review ({reviewList.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon="💬" title="No bookings" description={activeTab === 'confirm' ? 'No bookings need confirmation' : 'No completed sessions'} />
      ) : (
        <div className="space-y-4">
          {list.map(r => {
            const client = clientMap[r.client_id]
            const service = serviceMap[r.service_id]
            const link = activeTab === 'confirm' ? buildConfirmLink(r) : buildReviewLink(r)
            return (
              <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4" style={{ borderColor: '#F2C4CE' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: '#F2C4CE' }}>👩</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{client?.name ?? '-'}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500">{service?.name ?? '-'} • {formatDateAr(r.date)} • {r.time}</p>
                  <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{client?.phone}</p>
                </div>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <span>💬</span>
                  {activeTab === 'confirm' ? 'Send Confirmation' : 'Request Review'}
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
