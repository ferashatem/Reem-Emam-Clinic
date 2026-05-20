import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import { getSessionReportsByClient } from '../../services/firestore'
import { formatDateAr } from '../../utils/formatters'
import type { DocumentData } from 'firebase/firestore'

export default function ClientReports() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const [reports, setReports] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DocumentData | null>(null)

  useEffect(() => {
    if (!client?.id) return
    getSessionReportsByClient(client.id).then(r => {
      setReports(r)
      setLoading(false)
    })
  }, [client?.id])

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4" style={{ color: '#8B3A52' }}>تقاريري</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">🌸</p>
          <p className="text-gray-500 text-sm">مفيش تقارير لسه</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-2xl p-4 border shadow-sm"
              style={{ borderColor: '#F2C4CE' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">
                    {r.session_date?.toDate
                      ? formatDateAr(r.session_date.toDate().toISOString().split('T')[0])
                      : '—'}
                  </p>
                  <p className="font-semibold text-sm" style={{ color: '#2C1A1D' }}>
                    {r.diagnosis ? r.diagnosis.slice(0, 60) + (r.diagnosis.length > 60 ? '...' : '') : 'تقرير جلسة'}
                  </p>
                  {r.treatment && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{r.treatment}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelected(r)}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-xl border"
                style={{ borderColor: '#8B3A52', color: '#8B3A52' }}
              >
                عرض التقرير الكامل
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Full report modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 overflow-y-auto"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>تقرير الجلسة</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'التشخيص / ملاحظات الجلسة', value: selected.diagnosis },
                { label: 'العلاج المستخدم', value: selected.treatment },
                { label: '💊 الأدوية الموصوفة', value: Array.isArray(selected.medicines) ? selected.medicines.map((m: any) => `${m.name}${m.dosage ? ` — ${m.dosage}` : ''}`).join('\n') : selected.medicines },
                { label: '🚫 الأشياء المحظورة', value: selected.prohibited_items },
                { label: '🥗 توصيات الأكل', value: selected.food_recommendations },
                { label: 'المنتجات المستخدمة', value: selected.products_used },
                { label: 'الخطوات القادمة', value: selected.next_steps },
              ].map(field => field.value ? (
                <div key={field.label} className="rounded-xl p-3" style={{ backgroundColor: '#FDF6F0' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#8B3A52' }}>{field.label}</p>
                  <p className="text-sm whitespace-pre-line" style={{ color: '#2C1A1D' }}>{field.value}</p>
                </div>
              ) : null)}

              {/* Photos */}
              {selected.photos && selected.photos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#8B3A52' }}>الصور</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.photos.map((url: string, i: number) => (
                      <img
                        key={i}
                        src={url}
                        alt={`صورة ${i + 1}`}
                        className="w-full rounded-xl object-cover aspect-square"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
