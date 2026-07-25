import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getPayments, createPayment, softDeletePayment,
  getClients, getReservations,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { formatPrice, formatDateAr, todayISO } from '../../utils/formatters'

interface PaymentForm {
  client_id: string
  reservation_id: string
  amount: number
  method: string
  note: string
  date: string
}

const methods = [
  { value: 'cash', label: 'Cash 💵' },
  { value: 'instapay', label: 'InstaPay 📲' },
  { value: 'wallet', label: 'Wallet 📱' },
  { value: 'card', label: 'Card 💳' },
]

export default function StaffCollections() {
  const { userProfile } = useAuth()
  const [payments, setPayments] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PaymentForm>()

  const watchedResId = watch('reservation_id')

  async function load() {
    setLoading(true)
    const [pays, cls, res] = await Promise.all([
      getPayments(),
      getClients(),
      getReservations(),
    ])
    setPayments(pays as any[])
    setClients(cls as any[])
    setReservations((res as any[]).filter(r => r.status === 'completed' || r.status === 'confirmed'))
    setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // When a reservation is picked, auto-fill client + suggested amount
  useEffect(() => {
    if (!watchedResId) return
    const r = reservations.find(x => x.id === watchedResId)
    if (r) {
      setValue('client_id', r.client_id)
      if (r.price_at_booking) setValue('amount', r.price_at_booking)
    }
  }, [watchedResId, reservations])

  function openCreate() {
    reset({ date: todayISO(), method: 'cash', reservation_id: '', client_id: '', amount: undefined, note: '' })
    setModalOpen(true)
  }

  async function onSubmit(data: PaymentForm) {
    setSaving(true)
    try {
      const client = clientMap[data.client_id]
      await createPayment({
        client_id: data.client_id,
        client_name: client?.name ?? '',
        reservation_id: data.reservation_id || null,
        amount: Number(data.amount),
        method: data.method,
        note: data.note ?? '',
        date: data.date || todayISO(),
        staff_id: userProfile?.uid ?? '',
        staff_name: userProfile?.name ?? '',
      })
      toast.success('Payment recorded 💰')
      setModalOpen(false)
      load()
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: any) {
    if (!confirm('Delete this payment record?')) return
    await softDeletePayment(p.id)
    toast.success('Deleted')
    load()
  }

  const today = todayISO()
  const totalAll = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const totalToday = payments
    .filter(p => p.date === today)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Money collected after each session"
        action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Payment</button>}
      />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
          <p className="text-xs text-gray-400 mb-1">Today's total</p>
          <p className="text-2xl font-bold" style={{ color: '#8B3A52' }}>{formatPrice(totalToday)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border shadow-sm" style={{ borderColor: '#F2C4CE' }}>
          <p className="text-xs text-gray-400 mb-1">All-time total</p>
          <p className="text-2xl font-bold" style={{ color: '#8B3A52' }}>{formatPrice(totalAll)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : payments.length === 0 ? (
        <EmptyState icon="💰" title="No payments recorded" description="Record what each client paid after their session" action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Payment</button>} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['Client', 'Amount', 'Method', 'Date', 'Note', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium">{p.client_name || clientMap[p.client_id]?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#8B3A52' }}>{formatPrice(Number(p.amount) || 0)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{methods.find(m => m.value === p.method)?.label ?? p.method ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.date ? formatDateAr(p.date) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">{p.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleDelete(p)} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-200">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Payment">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Session (optional)</label>
            <select {...register('reservation_id')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }}>
              <option value="">— Not linked to a session —</option>
              {reservations.map(r => (
                <option key={r.id} value={r.id}>
                  {clientMap[r.client_id]?.name ?? r.client_id} — {r.date} {r.time}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Client</label>
            <select {...register('client_id', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.client_id ? '#ef4444' : '#F2C4CE' }}>
              <option value="">Select client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Amount (EGP)</label>
              <input {...register('amount', { required: true, min: 1 })} type="number" step="any" placeholder="0" dir="ltr" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.amount ? '#ef4444' : '#F2C4CE' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Method</label>
              <select {...register('method', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }}>
                {methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <input {...register('date', { required: true })} type="date" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.date ? '#ef4444' : '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Note</label>
            <textarea {...register('note')} rows={2} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52] resize-none" style={{ borderColor: '#F2C4CE' }} />
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
