import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getClients, softDeleteClient, createClient } from '../../services/firestore'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  'walk-in': 'Walk-in',
  website: 'Website',
  other: 'Other',
}

export default function SuperAdminClients() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewModal, setViewModal] = useState<any | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', age: '', skin_type: '', source: '', notes: '' })

  async function load() {
    setLoading(true)
    setClients(await getClients())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (!validateEgyptianPhone(form.phone)) return toast.error('Invalid phone number')
    setSaving(true)
    try {
      await createClient({
        name: form.name.trim(),
        phone: normalizePhone(form.phone),
        ...(form.age ? { age: Number(form.age) } : {}),
        ...(form.skin_type ? { skin_type: form.skin_type } : {}),
        ...(form.source ? { source: form.source } : {}),
        ...(form.notes ? { notes: form.notes.trim() } : {}),
      })
      toast.success('Client added')
      setAddModal(false)
      setForm({ name: '', phone: '', age: '', skin_type: '', source: '', notes: '' })
      load()
    } catch {
      toast.error('Failed to add client')
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
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} registered clients`}
        action={<button onClick={() => setAddModal(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#8B3A52' }}>+ Add Client</button>}
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
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No clients found" description={search ? 'No results match your search' : 'No clients registered yet'} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full" dir="rtl">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['الاسم', 'التليفون', 'نوع البشرة', 'المصدر', 'السن', 'الحالة', ''].map(h => (
                  <th key={h} className="text-right text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium text-right">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right" dir="ltr">{c.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{c.skin_type || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{sourceLabels[c.source] ?? c.source ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{c.age ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.uid ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.uid ? '🔗 مرتبطة' : '📋 يدوي'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-start">
                      <button onClick={() => setViewModal(c)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>عرض</button>
                      <button onClick={() => handleDelete(c)} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-200">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Client">
        <form onSubmit={handleAdd} className="space-y-4">
          {[
            { label: 'Name *', field: 'name', type: 'text', placeholder: 'Full name' },
            { label: 'Phone *', field: 'phone', type: 'tel', placeholder: '01xxxxxxxxx' },
            { label: 'Age', field: 'age', type: 'number', placeholder: 'e.g. 25' },
            { label: 'Skin Type', field: 'skin_type', type: 'text', placeholder: 'e.g. Dry, Oily...' },
            { label: 'Source', field: 'source', type: 'text', placeholder: 'e.g. Instagram, Referral...' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 text-gray-700">{label}</label>
              <input
                type={type}
                value={form[field as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]"
                style={{ borderColor: '#F2C4CE' }}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any notes..."
              rows={2}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52] resize-none"
              style={{ borderColor: '#F2C4CE' }}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#8B3A52' }}
          >
            {saving ? 'Saving...' : 'Add Client'}
          </button>
        </form>
      </Modal>

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
                { label: 'Firebase UID', value: viewModal.uid ? '✅ Linked' : '❌ Not linked' },
                { label: 'Registered via', value: viewModal.source === 'website' ? '🌐 Website booking' : '👩‍💼 Manual' },
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
