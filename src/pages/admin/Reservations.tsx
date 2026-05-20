import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getReservations, createReservation, updateReservation, softDeleteReservation,
  getPendingClientReservations, getClients, getServices,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateAr, formatPrice } from '../../utils/formatters'
import { buildWhatsAppLink, buildConfirmationMessage } from '../../utils/whatsapp'

interface ResForm {
  client_id: string
  service_id: string
  date: string
  time: string
  notes: string
}

export default function AdminReservations() {
  const { userProfile } = useAuth()
  const [reservations, setReservations] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [serviceMap, setServiceMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResForm>()

  async function load() {
    setLoading(true)
    const [res, pending, cls, svcs] = await Promise.all([
      getReservations({ adminId: userProfile?.uid }),
      getPendingClientReservations(),
      getClients(),
      getServices(),
    ])
    setReservations(res as any[])
    setPendingRequests(pending as any[])
    setClients(cls as any[])
    setServices(svcs as any[])
    setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setServiceMap(Object.fromEntries(svcs.map((s: any) => [s.id, s])))
    setLoading(false)
  }

  async function confirmRequest(r: any) {
    await updateReservation(r.id, {
      status: 'confirmed',
      admin_id: userProfile?.uid,
    })
    toast.success('Booking confirmed ✅')
    load()
  }

  async function cancelRequest(r: any) {
    if (!confirm('Cancel this request?')) return
    await updateReservation(r.id, { status: 'cancelled' })
    toast.success('Request cancelled')
    load()
  }

  function buildWaLink(r: any) {
    const client = clientMap[r.client_id]
    const service = serviceMap[r.service_id]
    if (!client?.phone) return ''
    const msg = buildConfirmationMessage({
      clientName: client.name,
      date: formatDateAr(r.date),
      time: r.time,
      serviceName: service?.name || r.service_name || 'Service',
      price: r.price_at_booking || service?.price || 0,
    })
    return buildWhatsAppLink(client.phone, msg)
  }

  useEffect(() => { if (userProfile) load() }, [userProfile])

  function openCreate() { setEditTarget(null); reset({}); setModalOpen(true) }
  function openEdit(r: any) { setEditTarget(r); reset(r); setModalOpen(true) }

  async function onSubmit(data: ResForm) {
    setSaving(true)
    try {
      const service = serviceMap[data.service_id]
      const payload = {
        ...data,
        admin_id: userProfile?.uid,
        price_at_booking: service?.price ?? 0,
        ...(editTarget ? {} : { status: 'confirmed' }),
      }
      if (editTarget) {
        await updateReservation(editTarget.id, payload)
        toast.success('Booking updated')
      } else {
        await createReservation(payload)
        toast.success('Booking added')
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    await updateReservation(id, { status })
    toast.success('Status updated')
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this booking?')) return
    await softDeleteReservation(id)
    toast.success('Deleted')
    load()
  }

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div>
      <PageHeader
        title="Reservations"
        subtitle={`${reservations.length} total`}
        action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Booking</button>}
      />

      {/* Pending client requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold" style={{ color: '#8B3A52' }}>Client Booking Requests</span>
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: '#FF851B' }}>
              {pendingRequests.length}
            </span>
          </div>
          <div className="space-y-3">
            {pendingRequests.map(r => {
              const client = clientMap[r.client_id]
              const service = serviceMap[r.service_id]
              const waLink = buildWaLink(r)
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 border shadow-sm flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: '#FF851B40', borderLeftWidth: 4, borderLeftColor: '#FF851B' }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#2C1A1D' }}>
                      {client?.name ?? r.client_id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {service?.name ?? r.service_name ?? 'Service'} — {formatDateAr(r.date)} — {r.time}
                    </p>
                    {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                    <p className="text-xs font-medium mt-1" style={{ color: '#8B3A52' }}>
                      {formatPrice(r.price_at_booking || service?.price || 0)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => confirmRequest(r)}
                      className="text-xs px-3 py-2 rounded-xl text-white font-medium"
                      style={{ backgroundColor: '#3D9970' }}
                    >
                      ✅ Confirm
                    </button>
                    <button
                      onClick={() => cancelRequest(r)}
                      className="text-xs px-3 py-2 rounded-xl text-white font-medium"
                      style={{ backgroundColor: '#FF4136' }}
                    >
                      ❌ Cancel
                    </button>
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-2 rounded-xl text-white font-medium"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        💬 WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : reservations.length === 0 ? (
        <EmptyState icon="📅" title="No reservations yet" action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Booking</button>} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['Client', 'Service', 'Date', 'Time', 'Status', 'Price', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium">{clientMap[r.client_id]?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{serviceMap[r.service_id]?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateAr(r.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.time}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={e => handleStatusChange(r.id, e.target.value)}
                      className="text-xs border rounded-lg px-2 py-1 focus:outline-none focus:border-[#8B3A52]"
                      style={{ borderColor: '#F2C4CE' }}
                    >
                      {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#8B3A52' }}>{formatPrice(r.price_at_booking)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(r)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Edit</button>
                      <button onClick={() => handleDelete(r.id)} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-200">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Reservation' : 'New Booking'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Client</label>
            <select {...register('client_id', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.client_id ? '#ef4444' : '#F2C4CE' }}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Service</label>
            <select {...register('service_id', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.service_id ? '#ef4444' : '#F2C4CE' }}>
              <option value="">Select service...</option>
              {services.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <input {...register('date', { required: true })} type="date" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.date ? '#ef4444' : '#F2C4CE' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Time</label>
              <input {...register('time', { required: true })} type="time" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.time ? '#ef4444' : '#F2C4CE' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes</label>
            <textarea {...register('notes')} rows={3} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52] resize-none" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: '#8B3A52' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border font-medium" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
