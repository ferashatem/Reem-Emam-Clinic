import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getServices, createService, updateService, softDeleteService } from '../../services/firestore'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { formatPrice } from '../../utils/formatters'

interface ServiceForm {
  name: string
  description: string
  duration_minutes: number
  price: number
}

export default function Services() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>()

  async function load() {
    setLoading(true)
    try { setServices(await getServices()) } catch { toast.error('Error loading services') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() { setEditTarget(null); reset({}); setModalOpen(true) }
  function openEdit(s: any) { setEditTarget(s); reset(s); setModalOpen(true) }

  async function onSubmit(data: ServiceForm) {
    setSaving(true)
    try {
      const payload = { ...data, duration_minutes: Number(data.duration_minutes), price: Number(data.price) }
      if (editTarget) {
        await updateService(editTarget.id, payload)
        toast.success('Service updated')
      } else {
        await createService(payload)
        toast.success('Service added')
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(s: any) {
    await updateService(s.id, { is_active: !s.is_active })
    toast.success(s.is_active ? 'Service disabled' : 'Service enabled')
    load()
  }

  async function handleDelete(s: any) {
    if (!confirm(`Delete service "${s.name}"?`)) return
    await softDeleteService(s.id)
    toast.success('Service deleted')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Manage clinic services"
        action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ Add Service</button>}
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : services.length === 0 ? (
        <EmptyState icon="✨" title="No services yet" description="Add your first service" action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ Add Service</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-base" style={{ color: '#2C1A1D' }}>{s.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{s.description}</p>
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold" style={{ color: '#8B3A52' }}>{formatPrice(s.price)}</span>
                <span className="text-xs text-gray-400">{s.duration_minutes} min</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="flex-1 text-xs py-2 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Edit</button>
                <button onClick={() => handleToggleActive(s)} className={`flex-1 text-xs py-2 rounded-lg border ${s.is_active ? 'text-orange-600 border-orange-200' : 'text-green-600 border-green-200'}`}>
                  {s.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(s)} className="text-xs py-2 px-3 rounded-lg border text-red-500 border-red-200">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Service' : 'Add New Service'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Service Name</label>
            <input {...register('name', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.name ? '#ef4444' : '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea {...register('description')} rows={3} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52] resize-none" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Duration (min)</label>
              <input {...register('duration_minutes', { required: true, min: 1 })} type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.duration_minutes ? '#ef4444' : '#F2C4CE' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Price (EGP)</label>
              <input {...register('price', { required: true, min: 0 })} type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.price ? '#ef4444' : '#F2C4CE' }} />
            </div>
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
