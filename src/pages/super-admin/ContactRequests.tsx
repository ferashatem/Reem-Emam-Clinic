import { useEffect, useState } from 'react'
import { getDocs, collection, orderBy, query } from 'firebase/firestore'
import { db } from '../../services/firebase'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateAr } from '../../utils/formatters'
import { buildWhatsAppLink } from '../../utils/whatsapp'

export default function ContactRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'contact_requests'), orderBy('created_at', 'desc')))
      .then(snap => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      })
  }, [])

  return (
    <div>
      <PageHeader
        title="Contact Requests"
        subtitle={`${requests.length} requests from the landing page`}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState icon="📬" title="No requests yet" description="Requests submitted from the landing page will appear here" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full" dir="rtl">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['الاسم', 'التليفون', 'الخدمة', 'التاريخ', 'وقت الإرسال', ''].map(h => (
                  <th key={h} className="text-right text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const waLink = r.phone
                  ? buildWhatsAppLink(r.phone, `مرحباً ${r.name}، شكراً لتواصلك مع ريم غلو هاوس 🌸`)
                  : null
                return (
                  <tr key={r.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                    <td className="px-4 py-3 text-sm font-medium text-right">{r.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right" dir="ltr">{r.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{r.service || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{r.date ? formatDateAr(r.date) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 text-right">
                      {r.created_at?.toDate
                        ? formatDateAr(r.created_at.toDate().toISOString().split('T')[0])
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                          style={{ backgroundColor: '#25D366' }}
                        >
                          💬 WhatsApp
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
