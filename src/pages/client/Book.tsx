import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import type { ClientProfile } from '../../context/AuthContext'
import {
  getServices,
  createReservation,
  getAvailableTimeSlots,
} from '../../services/firestore'
import { formatDateAr, formatPrice } from '../../utils/formatters'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import type { DocumentData } from 'firebase/firestore'

type Step = 1 | 2 | 3 | 4 | 5

const ADMIN_PHONE = '+201000000000' // fallback — will show WA link

function generateDefaultSlots(): string[] {
  const slots: string[] = []
  for (let h = 12; h <= 22; h++)
    slots.push(`${String(h).padStart(2, '0')}:00`)
  return slots
}

export default function ClientBook() {
  const { clientProfile } = useAuth()
  const client = clientProfile as ClientProfile | null
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const preselectedServiceId = searchParams.get('service')

  const [step, setStep] = useState<Step>(1)
  const [services, setServices] = useState<DocumentData[]>([])
  const [selectedService, setSelectedService] = useState<DocumentData | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const todayISO = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getServices().then(s => {
      const active = s.filter((sv: DocumentData) => sv.is_active)
      setServices(active)
      if (preselectedServiceId) {
        const match = active.find((sv: DocumentData) => sv.id === preselectedServiceId)
        if (match) {
          setSelectedService(match)
          setStep(2)
        }
      }
    })
  }, [preselectedServiceId])

  useEffect(() => {
    if (!selectedDate) return
    setLoadingSlots(true)
    setSelectedTime('')
    getAvailableTimeSlots(selectedDate)
      .then(slots => setAvailableSlots(slots))
      .catch(() => setAvailableSlots(generateDefaultSlots()))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate])

  async function handleSubmit() {
    if (!client || !selectedService) return
    setSubmitting(true)
    try {
      await createReservation({
        client_id: client.id,
        admin_id: null,
        service_id: selectedService.id,
        service_name: selectedService.name,
        price_at_booking: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        booked_by: 'client',
        notes,
      })
      setDone(true)
    } catch {
      toast.error('حدث خطأ أثناء الحجز، حاولي مرة أخرى')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    const waMsg = `🌸 طلب حجز جديد!\n\nالعميلة: ${client?.name}\nالتليفون: ${client?.phone}\nالخدمة: ${selectedService?.name}\nالتاريخ المطلوب: ${selectedDate}\nالوقت المطلوب: ${selectedTime}`
    const waLink = buildWhatsAppLink(ADMIN_PHONE, waMsg)
    return (
      <div className="p-6 max-w-lg mx-auto text-center mt-10">
        <div className="text-5xl mb-4">🌸</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#8B3A52' }}>تم إرسال طلب الحجز!</h2>
        <p className="text-gray-500 text-sm mb-6">هنتواصل معاكي للتأكيد في أقرب وقت 💕</p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl font-semibold text-white mb-3"
          style={{ backgroundColor: '#25D366' }}
        >
          💬 إبعتي رسالة للتأكيد
        </a>
        <button
          onClick={() => navigate('/client/sessions')}
          className="w-full py-3 rounded-xl font-semibold border"
          style={{ borderColor: '#8B3A52', color: '#8B3A52' }}
        >
          شوفي جلساتي
        </button>
      </div>
    )
  }

  const steps = ['الخدمة', 'التاريخ', 'الوقت', 'ملاحظات', 'تأكيد']

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
              style={{
                backgroundColor: step > i + 1 ? '#3D9970' : step === i + 1 ? '#8B3A52' : '#F2C4CE',
                color: step >= i + 1 ? 'white' : '#8B3A52',
              }}
            >
              {step > i + 1 ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-6 h-0.5 mx-1" style={{ backgroundColor: step > i + 1 ? '#3D9970' : '#F2C4CE' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Service */}
      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>اختاري الخدمة</h2>
          {services.map(sv => (
            <button
              key={sv.id}
              onClick={() => { setSelectedService(sv); setStep(2) }}
              className="w-full text-right bg-white rounded-2xl p-4 border shadow-sm transition-all"
              style={{ borderColor: selectedService?.id === sv.id ? '#8B3A52' : '#F2C4CE' }}
            >
              <p className="font-semibold text-sm" style={{ color: '#2C1A1D' }}>{sv.name}</p>
              {sv.description && <p className="text-xs text-gray-500 mt-1">{sv.description}</p>}
              <div className="flex gap-3 mt-2">
                <span className="text-xs text-gray-400">⏱ {sv.duration_minutes} دقيقة</span>
                <span className="text-xs font-semibold" style={{ color: '#8B3A52' }}>{formatPrice(sv.price)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Date */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>اختاري التاريخ</h2>
          <p className="text-sm text-gray-500">الخدمة: {selectedService?.name}</p>
          <input
            type="date"
            min={todayISO}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
            style={{ borderColor: '#F2C4CE' }}
          />
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE' }}>
              رجوع
            </button>
            <button
              disabled={!selectedDate}
              onClick={() => setStep(3)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#8B3A52' }}
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Time */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>اختاري الوقت</h2>
          <p className="text-sm text-gray-500">{formatDateAr(selectedDate)}</p>
          {loadingSlots ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-center text-gray-500 py-8">مفيش مواعيد متاحة في هذا اليوم 😔</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                  style={{
                    backgroundColor: selectedTime === slot ? '#8B3A52' : 'white',
                    color: selectedTime === slot ? 'white' : '#2C1A1D',
                    borderColor: selectedTime === slot ? '#8B3A52' : '#F2C4CE',
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE' }}>
              رجوع
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => setStep(4)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#8B3A52' }}
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Notes */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>ملاحظات (اختياري)</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="أي حاجة تحبي تعرفينا بيها..."
            rows={4}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
            style={{ borderColor: '#F2C4CE' }}
          />
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE' }}>
              رجوع
            </button>
            <button
              onClick={() => setStep(5)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#8B3A52' }}
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: '#8B3A52' }}>تأكيد الحجز</h2>
          <div className="bg-white rounded-2xl p-5 border space-y-3" style={{ borderColor: '#F2C4CE' }}>
            {[
              { label: 'الخدمة', value: selectedService?.name },
              { label: 'التاريخ', value: formatDateAr(selectedDate) },
              { label: 'الوقت', value: selectedTime },
              { label: 'السعر', value: formatPrice(selectedService?.price || 0) },
              ...(notes ? [{ label: 'ملاحظات', value: notes }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{row.label}</span>
                <span className="font-medium" style={{ color: '#2C1A1D' }}>{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center">
            سيتم تأكيد الموعد من قِبل الإدارة وسيتم إشعارك
          </p>
          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE' }}>
              رجوع
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#8B3A52' }}
            >
              {submitting ? 'جارٍ الإرسال...' : 'تأكيد الحجز 🌸'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
