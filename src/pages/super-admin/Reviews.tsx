import { useEffect, useState } from 'react'
import { getReviews, updateReview } from '../../services/firestore'
import { getClients } from '../../services/firestore'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function Reviews() {
  const [reviews, setReviews] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    const [revs, cls] = await Promise.all([getReviews(), getClients()])
    setReviews(revs as any[])
    setClients(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function togglePublic(review: any) {
    await updateReview(review.id, { is_public: !review.is_public })
    toast.success(review.is_public ? 'Review hidden' : 'Review published')
    load()
  }

  function renderStars(rating: number) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Manage client reviews" />

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : reviews.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews yet" description="No reviews received yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">{clients[r.client_id]?.name ?? 'Client'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {r.created_at?.toDate ? format(r.created_at.toDate(), 'dd MMM yyyy', { locale: ar }) : ''}
                  </p>
                </div>
                <div className="text-yellow-400 text-lg">{renderStars(r.rating)}</div>
              </div>
              {r.comment && <p className="text-sm text-gray-600 mb-4 leading-relaxed">{r.comment}</p>}
              <div className="flex items-center justify-between">
                <span className={`text-xs px-3 py-1 rounded-full ${r.is_public ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.is_public ? 'Published' : 'Hidden'}
                </span>
                <button
                  onClick={() => togglePublic(r)}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}
                >
                  {r.is_public ? 'Hide' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
