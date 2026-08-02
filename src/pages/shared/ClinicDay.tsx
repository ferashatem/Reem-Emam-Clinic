import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getReservations, updateReservation, getClientById, createSessionReport,
  getReservationsByClient, getSessionReportsByClient, getPaymentsByClient,
  getActiveServices,
} from '../../services/firestore'
import { backfillAvailability } from '../../services/availability'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'
import CloseSessionSheet from '../../components/session/CloseSessionSheet'
import { PricingPill, SourcePill } from '../../components/ui/Pills'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateAr, formatDateShort, formatMoney, formatTime, todayISO, toNumber, toDate,
} from '../../utils/formatters'
import { dueOf, isPriced, priceLabel } from '../../utils/pricing'
import { slotOf } from '../../utils/slots'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Client, Payment, Reservation, Service, SessionReport } from '../../types'

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

  // Every booking, not just the day's: unsettled sessions from earlier days are
  // money the assistant still has to collect, so they have to be on this screen.
  const day = useLoader(async () => {
    const reservations = await getReservations()
    // Publishes the upcoming days to the public site's slot mirror, once per
    // session — the desk lives on this screen, so it's the surest place to
    // catch bookings made before the mirror existed.
    void backfillAvailability(reservations)
    return reservations
  }, [])
  /**
   * The doctor prices a session on her own screen while the assistant's is
   * already open, so this page has to go and look again by itself — otherwise
   * the money never shows up at the desk until someone refreshes the browser.
   */
  const reloadDay = day.reload
  useEffect(() => {
    const id = setInterval(reloadDay, 30_000)
    const onFocus = () => { if (!document.hidden) reloadDay() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [reloadDay])

  // Needed to price a session: the flat price for services that aren't per-pulse.
  const services = useLoader(() => getActiveServices(), [])
  const serviceFor = (r: Reservation) => (services.data ?? []).find(s => s.id === r.service_id)
  const isToday = date === todayISO()

  const queue = useMemo(() => {
    const list = (day.data ?? []).filter(r => r.date === date && r.status !== 'cancelled')
    return list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }, [day.data, date])

  /**
   * Every session that still owes money — today's first, in the order the
   * patients sat in the chair, then whatever is left over from earlier days.
   * This is the assistant's job list, so it has to include the day on screen.
   */
  const debts = useMemo(() => {
    return (day.data ?? [])
      .filter(r =>
        r.status !== 'cancelled' &&
        r.status !== 'pending' &&
        (r.date ?? '') <= todayISO() &&
        dueOf(r) > 0
      )
      .sort((a, b) => {
        // The day being viewed comes first; older debts trail behind it.
        const onDate = (r: Reservation) => (r.date === date ? 0 : 1)
        return onDate(a) - onDate(b) || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      })
  }, [day.data, date])

  const debtsTotal = useMemo(() => debts.reduce((s, r) => s + dueOf(r), 0), [debts])

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
    // Only priced sessions owe anything — the rest have no total to owe against.
    const due = queue.reduce((s, r) => s + dueOf(r), 0)
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

  /** Pulses, price, and payment all happen in one sheet — see CloseSessionSheet. */
  const [closing, setClosing] = useState<Reservation | null>(null)

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
  // firestore.rules only lets the partners write session_reports — showing the
  // assistant a button that always fails on permissions would be a dead end.
  const canWriteReports = userProfile?.role !== 'staff'
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

      {/* Only the first load blanks the screen — the 30s refresh stays invisible. */}
      {day.loading && !day.data ? (
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
                service={serviceFor(r)}
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
                service={serviceFor(selected)}
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
                onClose={() => setClosing(selected)}
                onReport={canWriteReports ? () => setReportFor(selected) : undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Money still on the street — from any earlier day, not just this one.
          Taking it is the assistant's job, so only she gets the collect button. */}
      {debts.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
            <h2 className="text-sm font-bold" style={{ color: C.primary }}>
              💰 مطلوب تحصيل ({debts.length})
            </h2>
            <span className="text-sm font-bold ms-auto" style={{ color: C.amber }}>
              {formatMoney(debtsTotal)}
            </span>
          </div>

          <div className="space-y-2.5">
            {debts.map(r => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-3.5 border shadow-sm flex flex-wrap items-center gap-3"
                style={{ borderColor: '#FDBA74' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: C.text }}>
                    {r.client_name || 'بدون اسم'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.date === date ? formatTime(r.time) : formatDateShort(r.date)}
                    {' · '}{r.service_name || 'خدمة'}
                    {r.pulses ? ` · ${r.pulses} نبضة` : ''}
                  </p>
                </div>

                <div className="text-end shrink-0">
                  <p className="text-[11px] text-gray-400">متبقي</p>
                  <p className="font-bold text-sm" style={{ color: C.amber }}>{formatMoney(dueOf(r))}</p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => setClosing(r)} disabled={busy}>تحصيل</Button>
                  <Link
                    to={`${base}/patients/${r.client_id}`}
                    className="px-4 py-2 rounded-xl text-sm font-medium border bg-white"
                    style={{ borderColor: C.primarySoft, color: C.primary }}
                  >
                    الملف
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <CloseSessionSheet
        reservation={closing}
        service={closing ? serviceFor(closing) : null}
        onClose={() => setClosing(null)}
        onSaved={() => { setClosing(null); day.reload(); file.reload() }}
      />

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
  r, service, turn, active, onSelect,
}: {
  r: Reservation; service?: Service | null
  turn: Turn; active: boolean; onSelect: () => void
}) {
  const style = turnStyles[turn]
  const priced = isPriced(r)
  const due = dueOf(r)

  /** One line telling the assistant what this patient still needs from her. */
  const money = !priced
    ? { text: priceLabel(r, service).text, color: '#9CA3AF' }
    : due > 0
      ? { text: `متبقي ${formatMoney(due)}`, color: C.amber }
      : { text: '✓ مدفوعة', color: C.green }

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
        <div className="flex items-center gap-2 mt-1">
          <PricingPill reservation={r} service={service} />
          <SourcePill bookedBy={r.booked_by} />
        </div>
      </div>

      <div className="shrink-0 text-end space-y-1">
        <span
          className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {style.label}
        </span>
        <p className="text-[11px]" style={{ color: money.color }}>{money.text}</p>
      </div>
    </button>
  )
}

// ─── Patient panel ───────────────────────────────────────────────────────────

interface PanelProps {
  r: Reservation
  service?: Service | null
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
  onClose: () => void
  /** Undefined for the assistant — only the partners may write reports. */
  onReport?: () => void
}

function PatientPanel({
  r, service, turn, base, busy, loading, error, onRetry,
  client, visits, reports, payments, onConfirm, onClose, onReport,
}: PanelProps) {
  const priced = isPriced(r)
  const total = toNumber(r.price_at_booking)
  const paid = toNumber(r.paid_amount)
  const due = dueOf(r)
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
          <span className="tabular-nums">💵 {priceLabel(r, service).text}</span>
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
                {priced && <StatusBadge status={paymentStatus} />}
              </div>
            </div>
            {priced ? (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Detail label="الإجمالي" value={formatMoney(total)} />
                <Detail label="مدفوع" value={formatMoney(paid)} />
                <Detail label="متبقي" value={due > 0 ? formatMoney(due) : '—'} strong={due > 0} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                لسه متسعّرتش — سجّلي النبضات من «إنهاء الجلسة» والإجمالي هيتحسب لوحده.
              </p>
            )}
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

          {/* What she does now — closing the session is the whole job, so it
              gets the full-width primary button and everything else is quiet. */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={onClose}
              disabled={busy}
              className="w-full py-3.5! text-base!"
            >
              {!priced
                ? '✅ إنهاء الجلسة وتسجيل النبضات'
                : due > 0
                  ? `💰 تحصيل ${formatMoney(due)}`
                  : '✏️ تعديل الجلسة'}
            </Button>

            <div className="flex flex-wrap gap-2">
              {r.status === 'pending' && (
                <Button variant="success" onClick={onConfirm} disabled={busy}>تأكيد الحجز</Button>
              )}
              {onReport && (
                <Button variant="outline" onClick={onReport} disabled={busy}>📝 تقرير الجلسة</Button>
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
  products_used: string
  next_steps: string
}

const emptyReport: ReportFormValues = {
  diagnosis: '', products_used: '', next_steps: '',
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
  const [alsoComplete, setAlsoComplete] = useState(reservation?.status !== 'completed')

  const { register, handleSubmit, formState: { errors } } = useForm<ReportFormValues>({
    defaultValues: emptyReport,
  })

  async function onSubmit(values: ReportFormValues) {
    if (!reservation) return
    setSaving(true)
    try {
      await createSessionReport({
        ...values,
        reservation_id: reservation.id,
        client_id: reservation.client_id,
        admin_id: adminId,
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
