import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getClientById, getReservationsByClient, getSessionReportsByClient,
  getPaymentsByClient, updateClient,
} from '../../services/firestore'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateShort, formatDateAr, formatMoney, formatTime, toNumber, toDate,
} from '../../utils/formatters'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'
import { isPriced } from '../../utils/pricing'
import { C } from '../../theme'
import type { Client, Payment, Reservation, SessionReport } from '../../types'

const skinTypes = ['دهنية', 'جافة', 'مختلطة', 'حساسة', 'عادية']
const sourceLabels: Record<string, string> = {
  instagram: 'إنستجرام', whatsapp: 'واتساب', referral: 'ترشيح',
  'walk-in': 'زيارة مباشرة', website: 'الموقع', other: 'أخرى',
}

interface ProfileForm {
  name: string
  phone: string
  age: string
  skin_type: string
  notes: string
}

export default function PatientFile() {
  const { clientId = '' } = useParams()
  const base = useBasePath()
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data, loading, error, reload } = useLoader(async () => {
    const client = await getClientById(clientId) as Client | null
    if (!client) throw new Error('ملف المريضة مش موجود')
    const [reservations, reports, payments] = await Promise.all([
      getReservationsByClient(clientId),
      getSessionReportsByClient(clientId),
      getPaymentsByClient(clientId),
    ])
    return { client, reservations, reports, payments }
  }, [clientId])

  const client = data?.client
  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const reports = useMemo(() => data?.reports ?? [], [data])
  const payments = useMemo(() => data?.payments ?? [], [data])

  /** Group the report + the money against each visit, so one card tells the whole story. */
  const visits = useMemo(() => {
    const reportsBy = new Map<string, SessionReport[]>()
    for (const rep of reports) {
      if (!rep.reservation_id) continue
      const list = reportsBy.get(rep.reservation_id) ?? []
      list.push(rep)
      reportsBy.set(rep.reservation_id, list)
    }

    const paymentsBy = new Map<string, Payment[]>()
    for (const p of payments) {
      if (!p.reservation_id) continue
      const list = paymentsBy.get(p.reservation_id) ?? []
      list.push(p)
      paymentsBy.set(p.reservation_id, list)
    }

    return reservations.map(r => ({
      reservation: r,
      reports: reportsBy.get(r.id) ?? [],
      payments: paymentsBy.get(r.id) ?? [],
    }))
  }, [reservations, reports, payments])

  const orphanReports = useMemo(
    () => reports.filter(rep => !rep.reservation_id || !reservations.some(r => r.id === rep.reservation_id)),
    [reports, reservations]
  )

  const stats = useMemo(() => {
    const active = reservations.filter(r => r.status !== 'cancelled')
    const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0)
    const done = active.filter(r => r.status === 'completed').length
    return { visits: active.length, done, paid }
  }, [reservations, payments])

  // ─── Edit profile ─────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>()

  function openEdit() {
    if (!client) return
    reset({
      name: client.name ?? '',
      phone: client.phone ?? '',
      age: client.age != null ? String(client.age) : '',
      skin_type: client.skin_type ?? '',
      notes: client.notes ?? '',
    })
    setEditOpen(true)
  }

  async function onSubmit(values: ProfileForm) {
    setSaving(true)
    try {
      await updateClient(clientId, {
        name: values.name.trim(),
        phone: normalizePhone(values.phone),
        age: values.age ? toNumber(values.age) : null,
        skin_type: values.skin_type || null,
        notes: values.notes?.trim() ?? '',
      })
      toast.success('تم حفظ بيانات المريضة')
      setEditOpen(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  const backLink = (
    <Link to={`${base}/patients`} className="text-sm mb-3 inline-block" style={{ color: C.primary }}>
      → رجوع لقائمة المرضى
    </Link>
  )

  if (loading) return <div>{backLink}<LoadingBlock /></div>
  if (error || !client) {
    return <div>{backLink}<ErrorState message={error ?? 'ملف المريضة مش موجود'} onRetry={reload} /></div>
  }

  return (
    <div>
      <PageHeader
        back={backLink}
        title={client.name}
        subtitle={client.phone}
        action={<Button variant="outline" onClick={openEdit}>تعديل البيانات</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <StatCard label="عدد الزيارات" value={stats.visits} icon="📅" hint={`${stats.done} جلسة خلصت`} />
        <StatCard label="إجمالي المدفوع" value={formatMoney(stats.paid)} icon="💰" color={C.green} />
      </div>

      {/* Profile */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm mb-6" style={{ borderColor: C.primarySoft }}>
        <h2 className="text-sm font-bold mb-4" style={{ color: C.primary }}>بيانات المريضة</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Detail label="السن" value={client.age ? `${client.age} سنة` : '—'} />
          <Detail label="نوع البشرة" value={client.skin_type || '—'} />
          <Detail label="عرفت عننا من" value={sourceLabels[client.source ?? ''] ?? client.source ?? '—'} />
          <Detail label="مسجلة من" value={client.uid ? 'الموقع' : 'العيادة'} />
        </div>
        {client.notes && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-1">ملاحظات عامة</p>
            <p className="text-sm bg-gray-50 rounded-xl p-3 leading-relaxed whitespace-pre-line">{client.notes}</p>
          </div>
        )}
      </section>

      {/* Visit history — the reason this page exists */}
      <section>
        <h2 className="text-sm font-bold mb-3" style={{ color: C.primary }}>
          سجل الزيارات ({visits.length})
        </h2>

        {visits.length === 0 ? (
          <EmptyState icon="📋" title="مفيش زيارات مسجلة" description="أول ما تحجز جلسة هتظهر هنا بكل تفاصيلها" />
        ) : (
          <div className="space-y-3">
            {visits.map((v, i) => (
              <VisitCard key={v.reservation.id} visit={v} index={visits.length - i} defaultOpen={i === 0} />
            ))}
          </div>
        )}
      </section>

      {orphanReports.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold mb-3" style={{ color: C.primary }}>
            تقارير مش مربوطة بحجز ({orphanReports.length})
          </h2>
          <div className="space-y-3">
            {orphanReports.map(rep => (
              <div key={rep.id} className="bg-white rounded-2xl p-4 border shadow-sm" style={{ borderColor: C.primarySoft }}>
                <p className="text-xs text-gray-400 mb-2">
                  {toDate(rep.session_date)?.toLocaleDateString('ar-EG') ?? '—'}
                </p>
                <ReportBody report={rep} />
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="تعديل بيانات المريضة">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="الاسم" required error={errors.name?.message}>
            <Input {...register('name', { required: 'اكتبي الاسم' })} invalid={!!errors.name} />
          </Field>
          <Field label="رقم التليفون" required error={errors.phone?.message}>
            <Input
              {...register('phone', {
                required: 'اكتبي الرقم',
                validate: v => validateEgyptianPhone(v) || 'الرقم مش صحيح',
              })}
              invalid={!!errors.phone}
              dir="ltr" inputMode="tel"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="السن">
              <Input {...register('age')} type="number" inputMode="numeric" min={1} max={120} />
            </Field>
            <Field label="نوع البشرة">
              <Select {...register('skin_type')}>
                <option value="">—</option>
                {skinTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="ملاحظات عامة" hint="حساسية، أمراض مزمنة، أدوية بتاخدها...">
            <Textarea {...register('notes')} rows={3} />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">حفظ</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>رجوع</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

interface Visit {
  reservation: Reservation
  reports: SessionReport[]
  payments: Payment[]
}

function VisitCard({ visit, index, defaultOpen }: { visit: Visit; index: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { reservation: r, reports, payments } = visit
  const paid = payments.reduce((s, p) => s + toNumber(p.amount), 0)
  const total = toNumber(r.price_at_booking)
  const paymentStatus = r.payment_status ?? (paid <= 0 ? 'unpaid' : paid < total ? 'partial' : 'paid')
  const hasDetail = reports.length > 0 || payments.length > 0 || !!r.notes

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.primarySoft }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-start p-4 flex items-start gap-3 hover:bg-[#FDF6F0]/60 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: C.bg, color: C.primary }}
        >
          {index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{r.service_name || 'خدمة'}</span>
            <StatusBadge status={r.status} />
            {isPriced(r) && <StatusBadge status={paymentStatus} />}
          </div>
          <p className="text-xs text-gray-500">
            {formatDateAr(r.date)} · {formatTime(r.time)}
            {r.pulses ? ` · ${r.pulses} نبضة` : ''}
          </p>
        </div>

        <div className="text-end shrink-0">
          <p className="font-bold text-sm" style={{ color: C.primary }}>
            {isPriced(r) ? formatMoney(total) : '—'}
          </p>
          <p className="text-xs text-gray-400">{open ? '▲' : '▼'}</p>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t space-y-4" style={{ borderColor: '#F2C4CE40' }}>
          {r.notes && (
            <Block label="ملاحظات الحجز">{r.notes}</Block>
          )}

          {r.pulses != null && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Detail label="عدد النبضات" value={`${r.pulses}`} />
              {toNumber(r.price_per_pulse) > 0 && (
                <Detail label="سعر النبضة" value={formatMoney(r.price_per_pulse)} />
              )}
              <Detail label="الإجمالي" value={formatMoney(total)} />
            </div>
          )}

          {reports.map(rep => <ReportBody key={rep.id} report={rep} />)}

          {payments.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: C.primary }}>الدفعات</p>
              <div className="space-y-1.5">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between text-sm rounded-xl px-3 py-2" style={{ backgroundColor: C.bg }}>
                    <span className="text-gray-500">{formatDateShort(p.date)}</span>
                    <span className="font-semibold" style={{ color: C.green }}>{formatMoney(p.amount)}</span>
                  </div>
                ))}
                {paid < total && (
                  <div className="flex justify-between text-sm px-3 py-2 font-semibold" style={{ color: C.amber }}>
                    <span>المتبقي</span>
                    <span>{formatMoney(total - paid)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasDetail && (
            <p className="text-sm text-gray-400 py-2">مفيش تفاصيل إضافية مسجلة على الزيارة دي</p>
          )}
        </div>
      )}
    </div>
  )
}

function ReportBody({ report }: { report: SessionReport }) {
  const medicines = Array.isArray(report.medicines)
    ? (report.medicines as { name?: string; dosage?: string }[])
        .map(m => `${m.name ?? ''}${m.dosage ? ` — ${m.dosage}` : ''}`)
        .filter(Boolean)
        .join('\n')
    : (report.medicines as string | undefined)

  const fields: [string, string | undefined][] = [
    ['التشخيص', report.diagnosis],
    ['العلاج المستخدم', report.treatment],
    ['💊 الأدوية', medicines],
    ['🚫 ممنوعات', report.prohibited_items],
    ['🥗 توصيات الأكل', report.food_recommendations],
    ['المنتجات المستخدمة', report.products_used],
    ['الخطوات القادمة', report.next_steps],
  ]

  const filled = fields.filter(([, v]) => v && String(v).trim())
  if (filled.length === 0 && !report.photos?.length) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold" style={{ color: C.primary }}>تقرير الجلسة</p>
      {filled.map(([label, value]) => (
        <Block key={label} label={label}>{value}</Block>
      ))}
      {report.photos && report.photos.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">صور الجلسة ({report.photos.length})</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {report.photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`صورة ${i + 1}`} className="w-full h-20 sm:h-24 object-cover rounded-xl" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm bg-gray-50 rounded-xl p-3 leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-medium wrap-break-word">{value}</p>
    </div>
  )
}
