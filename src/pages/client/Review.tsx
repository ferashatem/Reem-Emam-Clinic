import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import {
  getReservationById,
  getReviewByReservation,
  createReview,
  updateReservation,
} from '../../services/firestore'
import type { DocumentData } from 'firebase/firestore'

export default function ClientReview() {
  const { reservationId } = useParams<{ reservationId: string }>()
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()

  const [reservation, setReservation] = useState<DocumentData | null>(null)
  const [existingReview, setExistingReview] = useState<DocumentData | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!reservationId) return
    Promise.all([
      getReservationById(reservationId),
      getReviewByReservation(reservationId),
    ]).then(([res, review]) => {
      setReservation(res)
      setExistingReview(review)
      if (review) {
        setRating((review as DocumentData).rating || 0)
        setComment((review as DocumentData).comment || '')
      }
      setLoading(false)
    })
  }, [reservationId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) return toast.error('اختاري عدد النجوم')
    if (!client || !reservationId) return
    setSubmitting(true)
    try {
      await createReview({
        client_id: client.id,
        reservation_id: reservationId,
        rating,
        comment,
        is_public: false,
      })
      await updateReservation(reservationId, { reviewed: true })
      setDone(true)
    } catch {
      toast.error('حدث خطأ، حاولي مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDF6F0' }}>
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
      </div>
    )
  }

  if (!reservation || reservation.status !== 'completed') {
    return (
      <div className="p-6 text-center mt-10">
        <p className="text-gray-500">هذه الجلسة مش متاحة للتقييم</p>
        <button onClick={() => navigate('/client/sessions')} className="mt-4 text-sm" style={{ color: '#8B3A52' }}>
          رجوع للجلسات
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center mt-10">
        <div className="text-5xl mb-4">🌟</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#8B3A52' }}>شكراً لتقييمك!</h2>
        <p className="text-gray-500 text-sm mb-6">رأيك يهمنا جداً ويساعدنا نتحسن أكتر 💕</p>
        <button
          onClick={() => navigate('/client/home')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#8B3A52' }}
        >
          الرئيسية
        </button>
      </div>
    )
  }

  if (existingReview) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center mt-10">
        <div className="text-4xl mb-3">⭐</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#8B3A52' }}>قيّمتي الجلسة دي قبل كده</h2>
        <div className="flex justify-center gap-1 my-3">
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} className="text-2xl">{s <= rating ? '⭐' : '☆'}</span>
          ))}
        </div>
        {comment && <p className="text-sm text-gray-500 mt-2">{comment}</p>}
        <button onClick={() => navigate('/client/home')} className="mt-6 text-sm" style={{ color: '#8B3A52' }}>
          الرئيسية ←
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <p className="text-3xl mb-2">⭐</p>
        <h1 className="text-xl font-bold" style={{ color: '#8B3A52' }}>قيّمي جلستك</h1>
        <p className="text-sm text-gray-500 mt-1">{reservation.service_name || 'الجلسة'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Stars */}
        <div className="bg-white rounded-2xl p-5 border text-center" style={{ borderColor: '#F2C4CE' }}>
          <p className="text-sm font-medium mb-4" style={{ color: '#2C1A1D' }}>كمية رضاكي عن الجلسة</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className="text-4xl transition-transform hover:scale-110"
              >
                {s <= rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm mt-3 font-medium" style={{ color: '#8B3A52' }}>
              {rating === 5 ? 'ممتاز! 🌟' : rating === 4 ? 'جيد جداً 😊' : rating === 3 ? 'كويس 👍' : rating === 2 ? 'مقبول 🤔' : 'يحتاج تحسين 😔'}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: '#F2C4CE' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: '#2C1A1D' }}>
            تعليقك (اختياري)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="شاركينا تجربتك..."
            rows={3}
            className="w-full text-sm focus:outline-none resize-none text-right"
            style={{ color: '#2C1A1D' }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: '#8B3A52' }}
        >
          {submitting ? 'جارٍ الإرسال...' : 'إرسال التقييم 🌸'}
        </button>
      </form>
    </div>
  )
}
