import { useEffect, useState } from 'react'
import { getSessionReports } from '../../services/firestore'
import { getClients, getAdmins } from '../../services/firestore'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { format } from 'date-fns'

export default function Reports() {
  const [reports, setReports] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, any>>({})
  const [admins, setAdmins] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    async function load() {
      const [reps, cls, adms] = await Promise.all([
        getSessionReports(),
        getClients(),
        getAdmins(),
      ])
      setReports(reps as any[])
      setClients(Object.fromEntries(cls.map((c: any) => [c.id, c])))
      setAdmins(Object.fromEntries(adms.map((a: any) => [a.id, a])))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <PageHeader title="Session Reports" subtitle="All clinic session reports" />

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : reports.length === 0 ? (
        <EmptyState icon="📋" title="No reports yet" description="No session reports have been added yet" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full" dir="rtl">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['العميلة', 'الأدمن', 'التشخيص', 'تاريخ الجلسة', 'الصور', ''].map(h => (
                  <th key={h} className="text-right text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium text-right">{clients[r.client_id]?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{admins[r.admin_id]?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate text-right">{r.diagnosis ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {r.session_date?.toDate ? format(r.session_date.toDate(), 'dd MMM yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{r.photos?.length ?? 0} صورة</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(r)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>عرض</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Session Report Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Client</p>
                <p className="text-sm font-medium">{clients[selected.client_id]?.name ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Admin</p>
                <p className="text-sm font-medium">{admins[selected.admin_id]?.name ?? '-'}</p>
              </div>
            </div>
            {[
              { label: 'التشخيص / ملاحظات الجلسة', value: selected.diagnosis },
              { label: 'العلاج المستخدم', value: selected.treatment },
              { label: '💊 الأدوية الموصوفة', value: Array.isArray(selected.medicines) ? selected.medicines.map((m: any) => `${m.name}${m.dosage ? ` — ${m.dosage}` : ''}`).join('\n') : selected.medicines },
              { label: '🚫 الأشياء المحظورة', value: selected.prohibited_items },
              { label: '🥗 توصيات الأكل', value: selected.food_recommendations },
              { label: 'المنتجات المستخدمة', value: selected.products_used },
              { label: 'الخطوات القادمة', value: selected.next_steps },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm bg-gray-50 rounded-xl p-3 whitespace-pre-line">{value}</p>
              </div>
            ) : null)}
            {selected.photos?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Photos ({selected.photos.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.photos.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-24 object-cover rounded-xl" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
