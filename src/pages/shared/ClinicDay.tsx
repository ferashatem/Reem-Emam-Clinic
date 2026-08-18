import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  updateReservation, getClientById, createSessionReport,
  getReservationsByClient, getSessionReportsByClient, getPaymentsByClient,
  getActiveServices,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useLiveReservations } from '../../hooks/useLiveReservations'
import { useBasePath } from '../../hooks/useBasePath'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'
import CloseSessionSheet from '../../components/session/CloseSessionSheet'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Textarea, Button } from '../../components/ui/Form'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import MuiButton from '@mui/material/Button'
import MuiTabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ButtonBase from '@mui/material/ButtonBase'
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded'
import PaymentsRounded from '@mui/icons-material/PaymentsRounded'
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded'
import LanguageRounded from '@mui/icons-material/LanguageRounded'
import PhoneRounded from '@mui/icons-material/PhoneRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import FolderSharedRounded from '@mui/icons-material/FolderSharedRounded'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import {
  formatDateAr, formatDateShort, formatMoney, formatTime, todayISO, toNumber, toDate,
} from '../../utils/formatters'
import { dueOf, isPriced, priceLabel } from '../../utils/pricing'
import { pricedService } from '../../utils/services'
import { slotOf } from '../../utils/slots'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Client, Payment, Reservation, Service, SessionReport } from '../../types'

/** Where a patient sits relative to the clock — drives the badge and the sort accent. */
type Turn = 'now' | 'late' | 'next' | 'done'

/** The left card holds two job lists: the day itself, and the money still owed. */
type SideTab = 'queue' | 'debts'

export default function ClinicDay() {
  const { userProfile } = useAuth()
  const base = useBasePath()

  const [date, setDate] = useState(todayISO())
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sideTab, setSideTab] = useState<SideTab>('queue')

  // The whole page is "who is in the chair right now", so the clock has to move.
  const [clock, setClock] = useState(() => new Date().toTimeString().slice(0, 5))
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toTimeString().slice(0, 5)), 60_000)
    return () => clearInterval(id)
  }, [])

  // Needed to price a session: the listed price the total opens on.
  const services = useLoader(() => getActiveServices(), [])

  /**
   * The day on screen, live. One open query on one date: the dozen rows are
   * billed once and then only when one of them actually changes — no timer
   * re-reading the same rows every thirty seconds, and no waiting thirty
   * seconds to find out the doctor closed a session.
   */
  const day = useLiveReservations({ date })

  /**
   * Sessions that still owe money — asked for by what they owe rather than by
   * when they happened, so nothing a client owes can quietly age out of the
   * desk's list. Live too: the assistant takes a payment on one screen and the
   * debt clears on the other.
   */
  const ledger = useLiveReservations({ unsettled: true })

  /** The doc holding the rate — a booking made on a type is priced from its service. */
  const serviceFor = (r: Reservation) => {
    const list = services.data ?? []
    return pricedService(list.find(s => s.id === r.service_id), list)
  }
  const isToday = date === todayISO()

  const queue = useMemo(() => {
    const list = (day.data ?? []).filter(r => r.status !== 'cancelled')
    return list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }, [day.data])

  /**
   * Every session that still owes money — today's first, in the order the
   * patients sat in the chair, then whatever is left over from earlier days.
   * This is the assistant's job list, so it has to include the day on screen.
   */
  const debts = useMemo(() => {
    return (ledger.data ?? [])
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
  }, [ledger.data, date])

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

  /** Price and payment both happen in one sheet — see CloseSessionSheet. */
  const [closing, setClosing] = useState<Reservation | null>(null)

  async function markConfirmed(r: Reservation) {
    setBusy(true)
    try {
      await updateReservation(r.id, { status: 'confirmed', admin_id: userProfile?.uid ?? null })
      toast.success('تم تأكيد الحجز ✅')
      day.reload()
      ledger.reload()
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
    // The screen is the frame: the header and the day's numbers stay put, and
    // each column scrolls inside itself instead of pushing the page down.
    <div className="h-full min-h-0 flex flex-col">
      <PageHeader
        title="يوم العيادة"
        subtitle={`${formatDateAr(date)}${isToday ? ` · الساعة ${formatTime(clock)}` : ''}`}
        action={
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Input
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setPickedId(null) }}
              className="w-auto"
              aria-label="اختاري اليوم"
            />
            {!isToday && (
              <MuiButton
                variant="outlined"
                onClick={() => { setDate(todayISO()); setPickedId(null) }}
              >
                النهاردة
              </MuiButton>
            )}
          </Stack>
        }
      />

      {/* Four numbers on one line rather than four cards — the day's shape at a
          glance, without eating the height the queue needs. */}
      <Paper
        variant="outlined"
        sx={{
          mb: 2,
          px: { xs: 1.5, sm: 2 },
          py: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, sm: 1 },
        }}
      >
        <Metric icon={<PeopleAltRounded />} label="حالات اليوم" value={String(counts.total)} />
        <Metric icon={<TaskAltRounded />} label="خلصت" value={String(counts.done)} color={C.green} />
        <Metric icon={<HourglassEmptyRounded />} label="فاضل" value={String(counts.left)} color={C.amber} />
        <Metric
          icon={<PaymentsRounded />}
          label="متبقي على المرضى"
          value={formatMoney(counts.due)}
          color={counts.due > 0 ? C.amber : C.green}
        />
      </Paper>

      {/* Only the first load blanks the screen — later updates arrive silently. */}
      {day.loading && !day.data ? (
        <LoadingBlock />
      ) : day.error ? (
        <ErrorState message={day.error} onRetry={day.reload} />
      ) : queue.length === 0 && debts.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title={isToday ? 'مفيش حالات النهاردة' : 'مفيش حالات في اليوم ده'}
          description="الحجوزات اللي هتتسجل هتظهر هنا بالترتيب"
        />
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4">
          {/* The two job lists, one card, one tab each. The collection list used
              to hang below the fold at the bottom of the page, where nobody
              working the desk ever scrolled to find it. */}
          <Paper
            variant="outlined"
            className="order-2 lg:order-1 flex flex-col min-h-0 lg:h-full overflow-hidden"
          >
            <MuiTabs
              value={sideTab}
              onChange={(_, v: SideTab) => setSideTab(v)}
              variant="fullWidth"
              sx={{
                borderBottom: `1px solid ${C.primarySoft}`,
                '& .MuiTab-root': { minHeight: 48, fontWeight: 700, fontSize: '0.85rem' },
              }}
            >
              <Tab value="queue" label={<TabLabel text="الطابور" count={queue.length} />} />
              <Tab
                value="debts"
                label={<TabLabel text="تحصيل" count={debts.length} color="warning" />}
              />
            </MuiTabs>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.25 }}>
              {sideTab === 'queue' ? (
                queue.length === 0 ? (
                  <ListNote text="مفيش حالات في اليوم ده" />
                ) : (
                  <Stack spacing={1}>
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
                  </Stack>
                )
              ) : debts.length === 0 ? (
                <ListNote text="مفيش فلوس متبقية على حد 🎉" />
              ) : (
                <Stack spacing={1}>
                  {/* What the whole tab adds up to, before the rows themselves */}
                  <Stack
                    direction="row"
                    sx={{ alignItems: 'center', justifyContent: 'space-between', px: 0.5, pb: 0.5 }}
                  >
                    <span className="text-xs text-gray-500">إجمالي المتبقي</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: C.amber }}>
                      {formatMoney(debtsTotal)}
                    </span>
                  </Stack>
                  {debts.map(r => (
                    <DebtRow
                      key={r.id}
                      r={r}
                      sameDay={r.date === date}
                      base={base}
                      busy={busy}
                      onCollect={() => setClosing(r)}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>

          {/* The file of whoever is selected */}
          <div className="order-1 lg:order-2 min-h-0 lg:h-full lg:overflow-y-auto">
            {selected ? (
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
            ) : (
              <Paper variant="outlined" sx={{ p: 4 }}>
                <p className="text-sm text-gray-400 text-center">
                  اختاري حالة من الطابور علشان يظهر ملفها هنا
                </p>
              </Paper>
            )}
          </div>
        </div>
      )}

      <CloseSessionSheet
        reservation={closing}
        service={closing ? serviceFor(closing) : null}
        onClose={() => setClosing(null)}
        onSaved={() => { setClosing(null); day.reload(); ledger.reload(); file.reload() }}
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
  const fromSite = r.booked_by === 'client'

  /** One line telling the assistant what this patient still needs from her. */
  const money = !priced
    ? { text: priceLabel(r, service).text, color: '#9CA3AF' }
    : due > 0
      ? { text: `متبقي ${formatMoney(due)}`, color: C.amber }
      : { text: 'مدفوعة بالكامل', color: C.green }

  const [hour, period] = formatTime(r.time).split(' ')

  return (
    <ButtonBase
      onClick={onSelect}
      sx={{
        width: '100%',
        display: 'block',
        textAlign: 'start',
        borderRadius: 2,
        border: '1px solid',
        borderColor: active ? C.primary : style.border,
        backgroundColor: '#fff',
        // The selected row is the one the panel is showing — it gets a rail on
        // its own edge rather than a second, heavier border.
        boxShadow: active ? `inset 3px 0 0 ${C.primary}` : 'none',
        opacity: turn === 'done' ? 0.7 : 1,
        p: 1.25,
        '&:hover': { backgroundColor: C.bg },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 52,
            flexShrink: 0,
            borderRadius: 1.5,
            py: 0.75,
            textAlign: 'center',
            backgroundColor: turn === 'now' ? C.primary : C.bg,
            color: turn === 'now' ? '#fff' : C.primary,
          }}
        >
          <p className="text-xs font-bold leading-tight tabular-nums">{hour}</p>
          <p className="text-[10px] opacity-80">{period ?? ''}</p>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            <p className="font-semibold text-sm truncate" style={{ color: C.text }}>
              {r.client_name || 'بدون اسم'}
            </p>
            {/* Where it came from is one glyph, not a whole pill — a website
                request behaves differently, but it doesn't need a headline. */}
            <Tooltip title={fromSite ? 'حجز من الموقع' : 'حجز من العيادة'}>
              <Box component="span" sx={{ display: 'flex', color: fromSite ? C.blue : '#9CA3AF' }}>
                {fromSite
                  ? <LanguageRounded sx={{ fontSize: 14 }} />
                  : <PhoneRounded sx={{ fontSize: 14 }} />}
              </Box>
            </Tooltip>
          </Stack>
          <p className="text-xs text-gray-500 truncate">{r.service_name || 'خدمة'}</p>
          <p className="text-[11px] mt-0.5 tabular-nums truncate" style={{ color: money.color }}>
            {money.text}
          </p>
        </Box>

        <Chip
          size="small"
          label={style.label}
          sx={{
            flexShrink: 0,
            backgroundColor: style.bg,
            color: style.color,
            fontSize: '0.68rem',
          }}
        />
      </Stack>
    </ButtonBase>
  )
}

// ─── Collection row ──────────────────────────────────────────────────────────

/**
 * Money still on the street — from any earlier day, not just the one on screen.
 * Taking it is the assistant's job, so the collect button is the loud part.
 */
function DebtRow({
  r, sameDay, base, busy, onCollect,
}: {
  r: Reservation; sameDay: boolean; base: string; busy: boolean; onCollect: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderColor: '#FDBA74' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <p className="font-semibold text-sm truncate" style={{ color: C.text }}>
            {r.client_name || 'بدون اسم'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {sameDay ? formatTime(r.time) : formatDateShort(r.date)}
            {' · '}{r.service_name || 'خدمة'}
          </p>
        </Box>

        <Box sx={{ textAlign: 'end', flexShrink: 0 }}>
          <p className="text-[11px] text-gray-400">متبقي</p>
          <p className="font-bold text-sm tabular-nums" style={{ color: C.amber }}>
            {formatMoney(dueOf(r))}
          </p>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <MuiButton size="small" variant="contained" disabled={busy} onClick={onCollect}>
            تحصيل
          </MuiButton>
          <Tooltip title="الملف الكامل">
            <MuiButton
              size="small"
              variant="outlined"
              component={Link}
              to={`${base}/patients/${r.client_id}`}
              sx={{ minWidth: 0, px: 1 }}
            >
              <FolderSharedRounded fontSize="small" />
            </MuiButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
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
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          backgroundColor: C.bg,
          borderBottom: `1px solid ${C.primarySoft}`,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mb: 1.25 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <p className="text-lg font-bold truncate" style={{ color: C.primary }}>
              {r.client_name || client?.name || 'بدون اسم'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums" dir="ltr">{phone || '—'}</p>
          </Box>
          <Chip
            label={turnStyles[turn].label}
            sx={{
              flexShrink: 0,
              backgroundColor: turnStyles[turn].bg,
              color: turnStyles[turn].color,
            }}
          />
        </Stack>

        {/* What today's booking is, in the order the desk reads it */}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          <MetaChip icon={<AccessTimeRounded />} label={formatTime(r.time)} />
          <MetaChip label={r.service_name || 'خدمة'} />
          <MetaChip icon={<PaymentsRounded />} label={priceLabel(r, service).text} />
        </Stack>
      </Box>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* What the doctor must know before touching the laser */}
          {client?.notes && (
            <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
              <span className="text-sm leading-relaxed whitespace-pre-line">{client.notes}</span>
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            <Detail label="السن" value={client?.age ? `${client.age} سنة` : '—'} />
            <Detail label="نوع البشرة" value={client?.skin_type || '—'} />
            <Detail label="جلسات سابقة" value={`${previous.length}`} />
            <Detail label="إجمالي دفعت" value={formatMoney(paidEver)} />
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Today's booking */}
          <SectionTitle
            title="جلسة النهاردة"
            trailing={
              <Stack direction="row" spacing={0.75}>
                <StatusBadge status={r.status} />
                {priced && <StatusBadge status={paymentStatus} />}
              </Stack>
            }
          />
          <Box sx={{ borderRadius: 2, backgroundColor: C.bg, p: 1.75 }}>
            {priced ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                <Detail label="الإجمالي" value={formatMoney(total)} />
                <Detail label="مدفوع" value={formatMoney(paid)} />
                <Detail label="متبقي" value={due > 0 ? formatMoney(due) : '—'} strong={due > 0} />
              </Box>
            ) : (
              <p className="text-sm text-gray-500">
                لسه متسعّرتش — اقفلي الجلسة من «إنهاء الجلسة» وسجّلي الإجمالي.
              </p>
            )}
            {r.notes && (
              <p className="text-sm mt-3 bg-white rounded-xl p-3 leading-relaxed whitespace-pre-line">
                {r.notes}
              </p>
            )}
          </Box>

          <Divider sx={{ my: 2.5 }} />

          {/* Last time she was here */}
          <SectionTitle title="آخر جلسة" />
          {previous.length === 0 ? (
            <p className="text-sm text-gray-400">أول زيارة ليها 🌸</p>
          ) : (
            <Paper variant="outlined" sx={{ p: 1.75 }}>
              <p className="text-xs text-gray-500 mb-1.5">
                {formatDateShort(previous[0].date)} · {previous[0].service_name || 'خدمة'}
              </p>
              {lastReport ? (
                <ReportSummary report={lastReport} />
              ) : (
                <p className="text-sm text-gray-400">مفيش تقرير متسجل على الجلسة اللي فاتت</p>
              )}
            </Paper>
          )}

          <Divider sx={{ my: 2.5 }} />

          {/* What she does now — closing the session is the whole job, so it
              gets the full-width primary button and everything else is quiet. */}
          <Stack spacing={1.25}>
            <MuiButton variant="contained" size="large" fullWidth disabled={busy} onClick={onClose}>
              {!priced
                ? 'إنهاء الجلسة وتسجيل السعر'
                : due > 0
                  ? `تحصيل ${formatMoney(due)}`
                  : 'تعديل الجلسة'}
            </MuiButton>

            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {r.status === 'pending' && (
                <MuiButton variant="contained" color="success" disabled={busy} onClick={onConfirm}>
                  تأكيد الحجز
                </MuiButton>
              )}
              {onReport && (
                <MuiButton
                  variant="outlined"
                  startIcon={<DescriptionRounded />}
                  disabled={busy}
                  onClick={onReport}
                >
                  تقرير الجلسة
                </MuiButton>
              )}
              <MuiButton
                variant="outlined"
                startIcon={<FolderSharedRounded />}
                component={Link}
                to={`${base}/patients/${r.client_id}`}
              >
                الملف الكامل
              </MuiButton>
              {phone && (
                <MuiButton
                  variant="outlined"
                  color="success"
                  startIcon={<WhatsAppIcon />}
                  href={buildWhatsAppLink(phone, '')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  واتساب
                </MuiButton>
              )}
            </Stack>
          </Stack>
        </Box>
      )}
    </Paper>
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
    ['الأدوية', medicines],
    ['ممنوعات', report.prohibited_items],
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

function Metric({ icon, label, value, color = C.primary }: {
  icon: ReactNode; label: string; value: string; color?: string
}) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          backgroundColor: `${color}15`,
          color,
          '& svg': { fontSize: 19 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <p className="text-[11px] text-gray-500 leading-tight truncate">{label}</p>
        <p className="text-base font-bold leading-tight tabular-nums truncate" style={{ color }}>
          {value}
        </p>
      </Box>
    </Stack>
  )
}

/** A tab's name with the size of the list behind it. */
function TabLabel({ text, count, color }: {
  text: string; count: number; color?: 'warning'
}) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      {count > 0 && (
        <Chip
          size="small"
          color={color}
          label={count}
          sx={{ height: 20, minWidth: 20, fontSize: '0.7rem', pointerEvents: 'none' }}
        />
      )}
    </Stack>
  )
}

function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}
    >
      <p className="text-xs font-bold" style={{ color: C.primary }}>{title}</p>
      {trailing}
    </Stack>
  )
}

/** One fact about today's booking, quiet enough to sit in a row of them. */
function MetaChip({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={icon as never}
      label={label}
      sx={{
        backgroundColor: '#fff',
        fontWeight: 600,
        fontSize: '0.72rem',
        '& .MuiChip-icon': { fontSize: 15, color: C.primary },
      }}
    />
  )
}

function ListNote({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-10">{text}</p>
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p
        className={`text-sm wrap-break-word tabular-nums ${strong ? 'font-bold' : 'font-medium'}`}
        style={strong ? { color: C.amber } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
