import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getClients, createClient, updateClient, softDeleteClient } from '../../services/firestore'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { normalizePhone } from '../../utils/validators'

interface ClientForm {
  name: string
  phone: string
  email: string
  age: number
  skin_type: string
  source: string
  notes: string
}

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  'walk-in': 'Walk-in',
  website: 'Website',
  other: 'Other',
}

const skinTypes = ['Dry', 'Oily', 'Combination', 'Sensitive', 'Normal']

export default function Clients() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModal, setViewModal] = useState<any | null>(null)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientForm>()

  async function load() { setLoading(true); setClients(await getClients()); setLoading(false) }
  useEffect(() => { load() }, [])

  function openCreate() { setEditTarget(null); reset({}); setModalOpen(true) }
  function openEdit(c: any) { setEditTarget(c); reset(c); setModalOpen(true) }

  async function onSubmit(data: ClientForm) {
    setSaving(true)
    try {
      const payload = { ...data, age: Number(data.age), phone: normalizePhone(data.phone) }
      if (editTarget) {
        await updateClient(editTarget.id, payload)
        toast.success('Client updated')
      } else {
        await createClient(payload)
        toast.success('Client added')
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: any) {
    if (!confirm(`Delete client "${c.name}"?`)) return
    await softDeleteClient(c.id)
    toast.success('Client deleted')
    load()
  }

  const filtered = clients.filter(c =>
    c.name?.includes(search) || c.phone?.includes(search)
  )

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} registered clients`}
        action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Client</button>}
      />

      <div className="mb-5">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]"
          style={{ borderColor: '#F2C4CE' }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No clients found" description={search ? 'No results match your search' : 'Add your first client'} action={!search ? <button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Client</button> : undefined} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['Name', 'Phone', 'Skin Type', 'Source', 'Age', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500" dir="ltr">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.skin_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sourceLabels[c.source] ?? c.source ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.age ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setViewModal(c)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>View</button>
                      <button onClick={() => openEdit(c)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Edit</button>
                      <button onClick={() => handleDelete(c)} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-200">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Client' : 'Add New Client'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input {...register('name', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.name ? '#ef4444' : '#F2C4CE' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input {...register('phone', { required: true })} dir="ltr" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.phone ? '#ef4444' : '#F2C4CE' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input {...register('email')} type="email" dir="ltr" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Age</label>
              <input {...register('age')} type="number" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Skin Type</label>
              <select {...register('skin_type')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }}>
                <option value="">Select...</option>
                {skinTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Source</label>
              <select {...register('source')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }}>
                <option value="">Select...</option>
                {Object.entries(sourceLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
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

      {/* View Modal */}
      <Modal open={!!viewModal} onClose={() => setViewModal(null)} title="Client Profile">
        {viewModal && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b" style={{ borderColor: '#F2C4CE' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#F2C4CE' }}>👤</div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: '#8B3A52' }}>{viewModal.name}</h3>
                <p className="text-sm text-gray-500" dir="ltr">{viewModal.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Age', value: viewModal.age ? `${viewModal.age} yrs` : '—' },
                { label: 'Skin Type', value: viewModal.skin_type || '—' },
                { label: 'Source', value: sourceLabels[viewModal.source] ?? viewModal.source ?? '—' },
                { label: 'Email', value: viewModal.email || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
            {viewModal.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm bg-gray-50 rounded-xl p-3 leading-relaxed">{viewModal.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
