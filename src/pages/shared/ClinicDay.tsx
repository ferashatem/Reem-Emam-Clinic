import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getReservations, updateReservation, getClientById, createSessionReport,
  getReservationsByClient, getSessionReportsByClient, getPaymentsByClient,
} from '../../services/firestore'
import { uploadSessionPhotos } from '../../services/storage'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateAr, formatDateShort, formatMoney, formatTime, todayISO, toNumber, toDate,
} from '../../utils/formatters'
import { slotOf } from '../../utils/slots'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Client, Payment, Reservation, SessionReport } from '../../types'

/** Where a patient sits relative to the clock — drives the badge and the sort accent. */
type Turn = 'now' | 'late' | 'next' | 'done'

export default function ClinicDay() {
  const { userProfile } = useAuth()
  const base = useBasePath()

  const [date, setDate] = useState(todayISO())
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The whole page is "who is in the chair right now", so the clock has to move.
  const [clock, setClock] = useState(() => new Date().toTimeString().slice(0, 5))
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toTimeString().slice(0, 5)), 60_000)
    return () => clearInterval(id)
  }, [])

  const day = useLoader(() => getReservations({ date }), [date])
  const isToday = date === todayISO()

  const queue = useMemo(() => {
    const list = (day.data ?? []).filter(r => r.status !== 'cancelled')
    return list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }, [day.data])

  /**
   * Whose turn it is: the booking sitting on the current hour, and if that hour
   * is empty (or the day isn't today) the earliest one still not finished —
   * a 9:00 session never marked done is still the doctor's next job at 10:15.
   */
  const currentId = useMemo(() => {
    const waiting = queue.filter(r => r.status !== 'completed')
    if (waiting.length === 0) return null
    if (!isToday) return waiting[0].id
    const nowSlot = slotOf(clock)
    return (waiting.find(r => slotOf(r.time) === nowSlot) ?? waiting[0]).id
  }, [queue, isToday, clock])

  function turnOf(r: Reservation): Turn {
    if (r.status === 'completed') return 'done'
    if (r.id === currentId) return isToday && slotOf(r.time) === slotOf(clock) ? 'now' : 'late'
    if (isToday && (r.time ?? '') < clock) return 'late'
    return 'next'
  }

  const selected = useMemo(
    () => queue.find(r => r.id === pickedId) ?? queue.find(r => r.id === currentId) ?? null,
    [queue, pickedId, currentId]
  )

  const counts = useMemo(() => {
    const done = queue.filter(r => r.status === 'completed').length
    const due = queue.reduce(
      (s, r) => s + Math.max(0, toNumber(r.price_at_booking) - toNumber(r.paid_amount)), 0
    )
    return { total: queue.length, done, left: queue.length - done, due }
  }, [queue])

  // ─── The selected patient's file — pulled only for who's on screen ─────────
  const clientId = selected?.client_id ?? ''
  const file = useLoader(async () => {
    if (!clientId) return null
    const [client, visits, reports, payments] = await Promise.all([
      getClientById(clientId) as Promise<Client | null>,
      getReservationsByClient(clientId),
      getSessionReportsByClient(clientId),
      getPaymentsByClient(clientId),
    ])
    return { client, visits, reports, payments }
  }, [clientId])

  async function markDone(r: Reservation) {
    setBusy(true)
    try {
      await updateReservation(r.id, { status: 'completed' })
      toast.success('تم تسجيل الجلسة كمنتهية ✅')
      day.reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  async function markConfirmed(r: Reservation) {
    setBusy(true)
    try {
      await updateReservation(r.id, { status: 'confirmed', admin_id: userProfile?.uid ?? null })
      toast.success('تم تأكيد الحجز ✅')
      day.reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  // ─── Session report ───────────────────────────────────────────────────────
  const [reportFor, setReportFor] = useState<Reservation | null>(null)

  function afterReport() {
    setReportFor(null)
    day.reload()
    file.reload()
  }

  return (
    <div>
      <PageHeader
        title="يوم العيادة"
        subtitle={`${formatDateAr(date)}${isToday ? ` · الساعة ${formatTime(clock)}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setPickedId(null) }}
              className="w-auto"
              aria-label="اختاري اليوم"
            />
            {!isToday && (
              <Button variant="outline" onClick={() => { setDate(todayISO()); setPickedId(null) }}>
                النهاردة
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniStat label="حالات اليوم" value={String(counts.total)} icon="👩" />
        <MiniStat label="خلصت" value={String(counts.done)} icon="✅" color={C.green} />
        <MiniStat label="فاضل" value={String(counts.left)} icon="⏳" color={C.amber} />
        <MiniStat label="متبقي على المرضى" value={formatMoney(counts.due)} icon="💰" color={C.gold} />
      </div>

      {day.loading ? (
        <LoadingBlock />
      ) : day.error ? (
        <ErrorState message={day.error} onRetry={day.reload} />
      ) : queue.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title={isToday ? 'مفيش حالات النهاردة' : 'مفيش حالات في اليوم ده'}
          description="الحجوزات اللي هتتسجل هتظهر هنا بالترتيب"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 lg:gap-6 items-start">
          {/* Queue */}
          <div className="space-y-2.5 order-2 lg:order-1">
            <h2 className="text-sm font-bold px-1" style={{ color: C.primary }}>
              الطابور ({queue.length})
            </h2>
            {queue.map(r => (
              <QueueRow
                key={r.id}
                r={r}
                turn={turnOf(r)}
                active={selected?.id === r.id}
                onSelect={() => setPickedId(r.id)}
              />
            ))}
          </div>

          {/* The file of whoever is selected */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-6">
            {selected && (
              <PatientPanel
                key={selected.id}
                r={selected}
                turn={turnOf(selected)}
                base={base}
                busy={busy}
                loading={file.loading}
                error={file.error}
                onRetry={file.reload}
                client={file.data?.client ?? null}
                visits={file.data?.visits ?? []}
                reports={file.data?.reports ?? []}
                payments={file.data?.payments ?? []}
                onConfirm={() => markConfirmed(selected)}
                onDone={() => markDone(selected)}
                onReport={() => setReportFor(selected)}
              />
            )}
          </div>
        </div>
      )}

      {/* Keyed so every opening starts from a blank form instead of the last one */}
      <ReportModal
        key={reportFor?.id ?? 'closed'}
        reservation={reportFor}
        adminId={userProfile?.uid ?? null}
        onClose={() => setReportFor(null)}
        onSaved={afterReport}
      />
    </div>
  )
}

// ─── Queue row ───────────────────────────────────────────────────────────────

const turnStyles: Record<Turn, { label: string; bg: string; color: string; border: string }> = {
  now:  { label: 'دورها دلوقتي', bg: '#8B3A52', color: '#fff',    border: '#8B3A52' },
  late: { label: 'مستنية',       bg: '#FEF3C7', color: '#92400E', border: '#FDBA74' },
  next: { label: 'الجاية',       bg: '#FDF6F0', color: '#8B3A52', border: '#F2C4CE' },
  done: { label: 'خلصت',         bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
}

function QueueRow({
  r, turn, active, onSelect,
}: { r: Reservation; turn: Turn; active: boolean; onSelect: () => void }) {
  const style = turnStyles[turn]
  const total = toNumber(r.price_at_booking)
  const due = Math.max(0, total - toNumber(r.paid_amount))

  return (
    <button
      onClick={onSelect}
      className="w-full text-start bg-white rounded-2xl p-3.5 border shadow-sm flex items-center gap-3 transition-colors hover:bg-[#FDF6F0]/60"
      style={{
        borderColor: active ? C.primary : style.border,
        boxShadow: active ? `0 0 0 1px ${C.primary}` : undefined,
        opacity: turn === 'done' ? 0.75 : 1,
      }}
    >
      <div
        className="w-14 shrink-0 rounded-xl py-2 text-center"
        style={{ backgroundColor: turn === 'now' ? C.primary : C.bg, color: turn === 'now' ? '#fff' : C.primary }}
      >
        <p className="text-xs font-bold leading-tight">{formatTime(r.time).split(' ')[0]}</p>
        <p className="text-[10px] opacity-80">{formatTime(r.time).split(' ')[1] ?? ''}</p>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: C.text }}>
          {r.client_name || 'بدون اسم'}
        </p>
        <p className="text-xs text-gray-500 truncate">
          {r.service_name || 'خدمة'}{r.pulses ? ` · ${r.pulses} نبضة` : ''}
        </p>
      </div>

      <div className="shrink-0 text-end space-y-1">
        <span
          className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {style.label}
        </span>
        {due > 0 && turn !== 'done' && (
          <p className="text-[11px] text-gray-400">متبقي {formatMoney(due)}</p>
        )}
      </div>
    </button>
  )
}

// ─── Patient panel ───────────────────────────────────────────────────────────

interface PanelProps {
  r: Reservation
  turn: Turn
  base: string
  busy: boolean
  loading: boolean
  error: string | null
  onRetry: () => void
  client: Client | null
  visits: Reservation[]
  reports: SessionReport[]
  payments: Payment[]
  onConfirm: () => void
  onDone: () => void
  onReport: () => void
}

function PatientPanel({
  r, turn, base, busy, loading, error, onRetry,
  client, visits, reports, payments, onConfirm, onDone, onReport,
}: PanelProps) {
  const total = toNumber(r.price_at_booking)
  const paid = toNumber(r.paid_amount)
  const due = Math.max(0, total - paid)
  const paymentStatus = r.payment_status ?? (paid <= 0 ? 'unpaid' : paid < total ? 'partial' : 'paid')
  const phone = r.client_phone || client?.phone || ''

  const previous = visits.filter(v => v.id !== r.id && v.status === 'completed')
  const lastReport = reports[0]
  const paidEver = payments.reduce((s, p) => s + toNumber(p.amount), 0)

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.primarySoft }}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b" style={{ borderColor: '#F2C4CE40', backgroundColor: C.bg }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-lg font-bold truncate" style={{ color: C.primary }}>
              {r.client_name || client?.name || 'بدون اسم'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5" dir="ltr">{phone || '—'}</p>
          </div>
          <span
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: turnStyles[turn].bg, color: turnStyles[turn].color }}
          >
            {turnStyles[turn].label}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <span>🕐 {formatTime(r.time)}</span>
          <span>💠 {r.service_name || 'خدمة'}</span>
          {r.pulses ? <span>⚡ {r.pulses} نبضة</span> : null}
          <span>💵 {formatMoney(total)}</span>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <div className="p-4 sm:p-5 space-y-5">
          {/* What the doctor must know before touching the laser */}
          {client?.notes && (
            <div className="rounded-xl p-3.5 border" style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }}>
              <p className="text-xs font-bold mb-1" style={{ color: '#9A3412' }}>⚠️ ملاحظات طبية</p>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#7C2D12' }}>
                {client.notes}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Detail label="السن" value={client?.age ? `${client.age} سنة` : '—'} />
            <Detail label="نوع البشرة" value={client?.skin_type || '—'} />
            <Detail label="جلسات سابقة" value={`${previous.length}`} />
            <Detail label="إجمالي دفعت" value={formatMoney(paidEver)} />
          </div>

          {/* Today's booking */}
          <section className="rounded-xl p-3.5" style={{ backgroundColor: C.bg }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold" style={{ color: C.primary }}>جلسة النهاردة</p>
              <div className="flex gap-1.5">
                <StatusBadge status={r.status} />
                <StatusBadge status={paymentStatus} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Detail label="الإجمالي" value={formatMoney(total)} />
              <Detail label="مدفوع" value={formatMoney(paid)} />
              <Detail label="متبقي" value={due > 0 ? formatMoney(due) : '—'} strong={due > 0} />
            </div>
            {r.notes && (
              <p className="text-sm mt-3 bg-white rounded-xl p-3 leading-relaxed whitespace-pre-line">
                {r.notes}
              </p>
            )}
          </section>

          {/* Last time she was here */}
          <section>
            <p className="text-xs font-bold mb-2" style={{ color: C.primary }}>آخر جلسة</p>
            {previous.length === 0 ? (
              <p className="text-sm text-gray-400">أول زيارة ليها 🌸</p>
            ) : (
              <div className="rounded-xl border p-3.5 space-y-2" style={{ borderColor: C.primarySoft }}>
                <p className="text-xs text-gray-500">
                  {formatDateShort(previous[0].date)} · {previous[0].service_name || 'خدمة'}
                  {previous[0].pulses ? ` · ${previous[0].pulses} نبضة` : ''}
                </p>
                {lastReport ? (
                  <ReportSummary report={lastReport} />
                ) : (
                  <p className="text-sm text-gray-400">مفيش تقرير متسجل على الجلسة اللي فاتت</p>
                )}
              </div>
            )}
          </section>

          {/* What she does now */}
          <div className="flex flex-wrap gap-2 pt-1">
            {r.status === 'pending' && (
              <Button variant="success" onClick={onConfirm} disabled={busy}>تأكيد الحجز</Button>
            )}
            <Button onClick={onReport} disabled={busy}>📝 تقرير الجلسة</Button>
            {r.status !== 'completed' && (
              <Button variant="outline" onClick={onDone} disabled={busy}>✅ خلصت الجلسة</Button>
            )}
            <Link
              to={`${base}/patients/${r.client_id}`}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border bg-white"
              style={{ borderColor: C.primarySoft, color: C.primary }}
            >
              الملف الكامل
            </Link>
            {phone && (
              <a
                href={buildWhatsAppLink(phone, '')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white border border-transparent"
                style={{ backgroundColor: '#25D366' }}
              >
                واتساب
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReportSummary({ report }: { report: SessionReport }) {
  const medicines = Array.isArray(report.medicines)
    ? (report.medicines as { name?: string; dosage?: string }[])
        .map(m => `${m.name ?? ''}${m.dosage ? ` — ${m.dosage}` : ''}`)
        .filter(Boolean)
        .join('، ')
    : (report.medicines as string | undefined)

  const rows: [string, string | undefined][] = [
    ['التشخيص', report.diagnosis],
    ['العلاج', report.treatment],
    ['💊 الأدوية', medicines],
    ['🚫 ممنوعات', report.prohibited_items],
    ['الخطوة الجاية', report.next_steps],
  ]
  const filled = rows.filter(([, v]) => v && String(v).trim())
  if (filled.length === 0) return <p className="text-sm text-gray-400">التقرير فاضي</p>

  return (
    <div className="space-y-2">
      {filled.map(([label, value]) => (
        <div key={label}>
          <p className="text-[11px] text-gray-400">{label}</p>
          <p className="text-sm leading-relaxed whitespace-pre-line">{value}</p>
        </div>
      ))}
      <p className="text-[11px] text-gray-400">
        {toDate(report.session_date)?.toLocaleDateString('ar-EG') ?? ''}
      </p>
    </div>
  )
}

// ─── Report modal ────────────────────────────────────────────────────────────

interface ReportFormValues {
  diagnosis: string
  treatment: string
  medicines: string
  prohibited_items: string
  food_recommendations: string
  products_used: string
  next_steps: string
}

const emptyReport: ReportFormValues = {
  diagnosis: '', treatment: '', medicines: '',
  prohibited_items: '', food_recommendations: '', products_used: '', next_steps: '',
}

function ReportModal({
  reservation, adminId, onClose, onSaved,
}: {
  reservation: Reservation | null
  adminId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [alsoComplete, setAlsoComplete] = useState(reservation?.status !== 'completed')
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<ReportFormValues>({
    defaultValues: emptyReport,
  })

  // Object URLs are only valid while the picked files are on screen.
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews])

  function pickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  async function onSubmit(values: ReportFormValues) {
    if (!reservation) return
    setSaving(true)
    try {
      const urls = photos.length > 0
        ? await uploadSessionPhotos(photos, reservation.id)
        : []

      await createSessionReport({
        ...values,
        reservation_id: reservation.id,
        client_id: reservation.client_id,
        admin_id: adminId,
        photos: urls,
      })

      if (alsoComplete && reservation.status !== 'completed') {
        await updateReservation(reservation.id, { status: 'completed' })
      }

      toast.success('تم حفظ تقرير الجلسة ✅')
      onSaved()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  const fields: { name: keyof ReportFormValues; label: string; hint?: string; required?: boolean }[] = [
    { name: 'diagnosis', label: 'التشخيص', required: true, hint: 'حالة البشرة النهاردة' },
    { name: 'treatment', label: 'العلاج اللي اتعمل' },
    { name: 'medicines', label: '💊 الأدوية', hint: 'كل دوا في سطر — الاسم والجرعة' },
    { name: 'prohibited_items', label: '🚫 ممنوعات', hint: 'شمس، سباحة، منتجات...' },
    { name: 'food_recommendations', label: '🥗 توصيات الأكل' },
    { name: 'products_used', label: 'المنتجات المستخدمة' },
    { name: 'next_steps', label: 'الخطوات الجاية', hint: 'موعد الجلسة الجاية أو المتابعة' },
  ]

  return (
    <Modal
      open={!!reservation}
      onClose={onClose}
      title={reservation ? `تقرير جلسة — ${reservation.client_name || 'المريضة'}` : ''}
      width="max-w-2xl"
    >
      {reservation && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-xs text-gray-500 rounded-xl p-3" style={{ backgroundColor: C.bg }}>
            {formatDateAr(reservation.date)} · {formatTime(reservation.time)} ·{' '}
            {reservation.service_name || 'خدمة'}
            {reservation.pulses ? ` · ${reservation.pulses} نبضة` : ''}
          </p>

          {fields.map(({ name, label, hint, required }) => (
            <Field
              key={name}
              label={label}
              hint={hint}
              required={required}
              error={errors[name]?.message}
            >
              <Textarea
                {...register(name, required ? { required: 'اكتبي التشخيص' } : undefined)}
                invalid={!!errors[name]}
                rows={name === 'diagnosis' ? 3 : 2}
              />
            </Field>
          ))}

          <Field label="صور الجلسة">
            <input ref={fileRef} type="file" multiple accept="image/*" onChange={pickPhotos} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed text-sm transition-colors"
              style={{ borderColor: C.primarySoft, color: C.primary }}
            >
              📷 اختاري الصور ({photos.length})
            </button>
            {previews.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {previews.map((url, i) => (
                  <img key={url} src={url} alt={`صورة ${i + 1}`} className="w-16 h-16 object-cover rounded-xl" />
                ))}
              </div>
            )}
          </Field>

          {reservation.status !== 'completed' && (
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={alsoComplete}
                onChange={e => setAlsoComplete(e.target.checked)}
                className="w-4 h-4 accent-[#8B3A52]"
              />
              سجّلي الجلسة كمنتهية كمان
            </label>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">حفظ التقرير</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>رجوع</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon, color = C.primary }: {
  label: string; value: string; icon: string; color?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-3.5 border shadow-sm" style={{ borderColor: C.primarySoft }}>
      <p className="text-xs text-gray-500 mb-1">{icon} {label}</p>
      <p className="text-lg font-bold wrap-break-word" style={{ color }}>{value}</p>
    </div>
  )
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p
        className={`text-sm wrap-break-word ${strong ? 'font-bold' : 'font-medium'}`}
        style={strong ? { color: C.amber } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
