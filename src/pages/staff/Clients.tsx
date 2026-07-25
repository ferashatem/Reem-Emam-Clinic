import { useEffect, useState } from 'react'
import { getClients } from '../../services/firestore'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  'walk-in': 'Walk-in',
  website: 'Website',
  other: 'Other',
}

export default function StaffClients() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewModal, setViewModal] = useState<any | null>(null)
  const [search, setSearch] = useState('')

  async function load() { setLoading(true); setClients(await getClients()); setLoading(false) }
  useEffect(() => { load() }, [])

  const filtered = clients.filter(c =>
    c.name?.includes(search) || c.phone?.includes(search)
  )

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} registered clients`}
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
        <EmptyState icon="👤" title="No clients found" description={search ? 'No results match your search' : 'No clients yet'} />
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
