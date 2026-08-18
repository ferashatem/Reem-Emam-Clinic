import { useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getReservations, createReservation, updateReservation, softDeleteReservation,
  getClients, getActiveServices, createClient, getClientByPhone,
} from '../../services/firestore'
import { backfillAvailability } from '../../services/availability'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'
import CloseSessionSheet from '../../components/session/CloseSessionSheet'
import { ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import DataTable, { type Column } from '../../components/ui/DataTable'
import RowMenu, { type RowAction } from '../../components/ui/RowMenu'
import MuiButton from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import MuiTabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchRounded from '@mui/icons-material/SearchRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import DoneAllRounded from '@mui/icons-material/DoneAllRounded'
import CancelOutlined from '@mui/icons-material/CancelOutlined'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import {
  daysAgo, formatDateShort, formatMoney, formatTime, todayISO, toNumber, isPastSlot,
} from '../../utils/formatters'
import { dueOf, isPriced, priceOf, priceLabel } from '../../utils/pricing'
import {
  groupServices, optionsOf, pricedService, serviceLabel, sessionMinutes,
} from '../../utils/services'
import {
  CLINIC_SLOTS, takenSlots, slotUsage, fitsInSlot, freeMinutes, isSlotPast, slotOf,
} from '../../utils/slots'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'
import { buildWhatsAppLink, buildConfirmationMessage } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Client, Reservation, Service } from '../../types'

type TabKey = 'today' | 'upcoming' | 'past'

/**
 * A booking is only who, what, and when. The price isn't settled until the
 * session actually happens, so it isn't asked for here — it's filled in when
 * the session is closed.
 */
interface BookingForm {
  client_id: string
  new_name: string
  new_phone: string
  /** The main service — «ليزر». Narrows what the next field offers. */
  main_id: string
  /** What actually gets booked: the type inside, or the service itself. */
  service_id: string
  date: string
  time: string
  notes: string
}

/**
 * How far back the archive tab reaches. The screen is the desk's working view,
 * not the clinic's permanent record — a patient's whole history lives on her
 * own file, which is fetched by client id and costs the same however old the
 * clinic gets.
 */
const ARCHIVE_WINDOW_DAYS = 90

const emptyForm: BookingForm = {
  client_id: '', new_name: '', new_phone: '',
  main_id: '', service_id: '', date: todayISO(), time: '', notes: '',
}

export default function StaffReservations() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()
  /** The assistant takes the money; the doctor closes the session. */
  const collecting = userProfile?.role === 'staff'

  const { data, loading, error, reload } = useLoader(async () => {
    const [reservations, services] = await Promise.all([
      // A window, not the whole archive: this query used to grow by a few
      // thousand documents a year and be paid for on every single page load.
      getReservations({ from: daysAgo(ARCHIVE_WINDOW_DAYS) }),
      getActiveServices(),
    ])
    // Publishes the upcoming days to the public site's slot mirror, once per
    // session — bookings made before the mirror existed still have to show up
    // as taken on the website.
    void backfillAvailability(reservations, services)
    return { reservations, services }
  }, [])

  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const services = useMemo(() => data?.services ?? [], [data])

  /**
   * The patient list is only ever needed by the booking form's picker, so it
   * is fetched the first time that form opens rather than on every visit to
   * this screen. Every row here already carries the name it was booked under.
   */
  const [clients, setClients] = useState<Client[]>([])
  const clientsRequested = useRef(false)
  function ensureClients() {
    if (clientsRequested.current) return
    clientsRequested.current = true
    getClients()
      .then(setClients)
      .catch(() => { clientsRequested.current = false })
  }

  const [tab, setTab] = useState<TabKey>('today')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [closing, setClosing] = useState<Reservation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c])) as Record<string, Client>,
    [clients]
  )
  const serviceMap = useMemo(
    () => Object.fromEntries(services.map(s => [s.id, s])) as Record<string, Service>,
    [services]
  )

  // Website requests carry the name/phone but no client_id until they're confirmed
  function nameOf(r: Reservation) {
    return r.client_name || (r.client_id ? clientMap[r.client_id]?.name : '') || 'بدون اسم'
  }
  function phoneOf(r: Reservation) {
    return r.client_phone || (r.client_id ? clientMap[r.client_id]?.phone : '') || ''
  }
  function serviceOf(r: Reservation) {
    return r.service_name || serviceMap[r.service_id]?.name || '—'
  }
  /** The doc that holds this booking's rate — a type carries none of its own. */
  function rateDocOf(r: Reservation) {
    return pricedService(serviceMap[r.service_id], services)
  }

  /**
   * Bucketed by when it happens, and by nothing else. A request that came
   * from the site is a booking like any other — it sits on its own day next
   * to the ones taken over the phone, carrying its source and its status.
   */
  const buckets = useMemo(() => {
    const today = todayISO()
    const todayList: Reservation[] = []
    const upcoming: Reservation[] = []
    const past: Reservation[] = []

    for (const r of reservations) {
      if (r.status === 'completed' || r.status === 'cancelled') {
        past.push(r)
      } else if (r.date === today) {
        todayList.push(r)
      } else if (r.date > today) {
        upcoming.push(r)
      } else {
        past.push(r) // date passed but never marked done — still needs attention
      }
    }

    const byTime = (a: Reservation, b: Reservation) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)

    return {
      today: todayList.sort(byTime),
      upcoming: upcoming.sort(byTime),
      past: past.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    }
  }, [reservations])

  const visible = useMemo(() => {
    const list = buckets[tab]
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(r =>
      nameOf(r).toLowerCase().includes(q) ||
      phoneOf(r).includes(q) ||
      serviceOf(r).toLowerCase().includes(q)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, tab, search, clientMap, serviceMap])

  // ─── Row actions ──────────────────────────────────────────────────────────
  async function patch(r: Reservation, changes: Partial<Reservation>, successMsg: string) {
    setBusyId(r.id)
    try {
      await updateReservation(r.id, changes)
      toast.success(successMsg)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Confirming a website request also turns the visitor into a patient:
   * requests arrive with a name + phone but no `client_id`, so we match on the
   * phone (reusing an existing file) or open a new one, then link them.
   */
  async function handleConfirm(r: Reservation) {
    setBusyId(r.id)
    try {
      const changes: Partial<Reservation> = {
        status: 'confirmed',
        admin_id: userProfile?.uid ?? null,
      }

      if (!r.client_id) {
        const phone = r.client_phone ? normalizePhone(r.client_phone) : ''
        if (!phone) throw new Error('الطلب ده مفيهوش رقم تليفون — عدّليه الأول')

        let client = await getClientByPhone(phone) as Client | null
        if (client) {
          toast('العميلة دي عندها ملف قديم — تم الربط بيه', { icon: 'ℹ️' })
        } else {
          const ref = await createClient({
            name: r.client_name?.trim() || phone,
            phone,
            source: 'website',
            uid: null,
          })
          client = { id: ref.id, name: r.client_name ?? '', phone } as Client
        }

        changes.client_id = client.id
        changes.client_name = client.name ?? r.client_name ?? ''
        changes.client_phone = client.phone ?? phone
      }

      await updateReservation(r.id, changes)
      toast.success('تم تأكيد الحجز ✅')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(r: Reservation) {
    const ok = await confirm({
      title: 'إلغاء الحجز',
      message: `هتلغي حجز ${nameOf(r)} يوم ${formatDateShort(r.date)}؟`,
      confirmLabel: 'إلغاء الحجز',
      danger: true,
    })
    if (ok) patch(r, { status: 'cancelled' }, 'تم إلغاء الحجز')
  }

  async function handleDelete(r: Reservation) {
    const ok = await confirm({
      title: 'مسح الحجز',
      message: 'الحجز هيختفي من الجداول نهائي. متأكدة؟',
      confirmLabel: 'مسح',
      danger: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await softDeleteReservation(r.id)
      toast.success('تم المسح')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  function waLink(r: Reservation) {
    const phone = phoneOf(r)
    if (!phone) return ''
    return buildWhatsAppLink(phone, buildConfirmationMessage({
      clientName: nameOf(r),
      date: formatDateShort(r.date),
      time: formatTime(r.time),
      serviceName: serviceOf(r),
    }))
  }

  // ─── Booking form ─────────────────────────────────────────────────────────
  const [isNewClient, setIsNewClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const form = useForm<BookingForm>({ defaultValues: emptyForm })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = form

  const watchedMain = watch('main_id')
  const watchedClientId = watch('client_id')
  const watchedDate = watch('date')
  const watchedTime = watch('time')

  const mainServices = useMemo(
    () => groupServices(services).map(g => g.service),
    [services]
  )
  /** The types inside the chosen service — empty when it's booked directly. */
  const serviceOptions = useMemo(
    () => optionsOf(services, watchedMain),
    [services, watchedMain]
  )
  /** The rate to quote always sits on the main service, never on the type. */
  const selectedService = serviceMap[watchedMain]

  /** The listed price, for reference only — nothing is charged at booking time. */
  const rateHint = !selectedService
    ? undefined
    : priceOf(selectedService) > 0
      ? `سعر الجلسة ${formatMoney(selectedService.price)}`
      : 'السعر بيتحدد وقت إنهاء الجلسة'

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    const list = q
      ? clients.filter(c => (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      : clients
    return list.slice(0, 30)
  }, [clients, clientSearch])

  /** How long the session being booked runs — what has to fit in the hour. */
  const bookedService = serviceOptions.length > 0
    ? serviceMap[watch('service_id')]
    : selectedService
  const minutes = sessionMinutes(bookedService, services)

  // How full each hour of the chosen day is. The bookings are already in
  // memory, so no extra read — `onSubmit` re-checks against fresh data before
  // writing, in case someone booked from another screen meanwhile.
  const usage = useMemo(
    // A booking from before sessions had lengths takes whatever its service
    // runs to today, so the desk sees the same free minutes the site does.
    () => slotUsage(reservations, watchedDate, editTarget?.id,
      r => sessionMinutes(serviceMap[r.service_id], services)),
    [reservations, watchedDate, editTarget, serviceMap, services]
  )
  const slotOptions = useMemo(() => {
    const current = slotOf(watchedTime)
    const list = CLINIC_SLOTS.map(slot => ({
      slot,
      // An hour holds 60 minutes; it's only closed once this session no longer
      // fits in what's left of it.
      full: !fitsInSlot(usage.get(slot) ?? 0, minutes),
      past: isSlotPast(watchedDate, slot),
    }))
    // A booking made before the fixed hours (or from the website) can sit on an
    // off-grid time — keep it selectable so editing doesn't silently move it.
    if (watchedTime && !CLINIC_SLOTS.includes(watchedTime) && current) {
      list.push({ slot: watchedTime, full: false, past: false })
      list.sort((a, b) => a.slot.localeCompare(b.slot))
    }
    return list
  }, [usage, minutes, watchedDate, watchedTime])

  const freeCount = slotOptions.filter(o => !o.full && !o.past).length

  function openCreate() {
    ensureClients()
    setEditTarget(null)
    setIsNewClient(false)
    setClientSearch('')
    reset({ ...emptyForm, date: todayISO() })
    setModalOpen(true)
  }

  function openEdit(r: Reservation) {
    ensureClients()
    setEditTarget(r)
    setIsNewClient(false)
    // Seed the search so the booked client is guaranteed to be in the visible list
    setClientSearch(r.client_name || clientMap[r.client_id]?.name || '')
    reset({
      ...emptyForm,
      client_id: r.client_id,
      // A booking points at whatever was booked — walk back up to its service
      // so the first select opens on the right one.
      main_id: serviceMap[r.service_id]?.parent_id || r.service_id,
      service_id: r.service_id,
      date: r.date ?? todayISO(),
      time: r.time ?? '',
      notes: r.notes ?? '',
    })
    setModalOpen(true)
  }

  /** Reuses an existing client with the same phone instead of duplicating them. */
  async function resolveClient(values: BookingForm): Promise<Client> {
    if (!isNewClient) {
      const existing = clientMap[values.client_id]
      if (!existing) throw new Error('اختاري العميلة الأول')
      return existing
    }

    const phone = normalizePhone(values.new_phone)
    const duplicate = await getClientByPhone(phone) as Client | null
    if (duplicate) {
      toast('العميلة دي مسجلة قبل كده — تم استخدام ملفها', { icon: 'ℹ️' })
      return duplicate
    }

    const ref = await createClient({
      name: values.new_name.trim(),
      phone,
      source: 'walk-in',
      uid: null,
    })
    return { id: ref.id, name: values.new_name.trim(), phone } as Client
  }

  async function onSubmit(values: BookingForm) {
    setSaving(true)
    try {
      const client = await resolveClient(values)
      // A service with no types inside is booked as itself.
      const serviceId = optionsOf(services, values.main_id).length > 0
        ? values.service_id
        : values.main_id
      const service = serviceMap[serviceId]
      const takes = sessionMinutes(service, services)

      // The list on screen can be minutes old — re-read the day before writing
      // so two people booking at once can't overrun the same hour.
      const sameDay = await getReservations({ date: values.date })
      const slot = slotOf(values.time)
      const used = slotUsage(sameDay, values.date, editTarget?.id,
        x => sessionMinutes(serviceMap[x.service_id], services)).get(slot) ?? 0
      if (!fitsInSlot(used, takes)) {
        const who = (takenSlots(sameDay, values.date, editTarget?.id).get(slot) ?? []).map(nameOf)
        throw new Error(
          `الساعة دي فاضل فيها ${freeMinutes(used)} دقيقة بس (${who.join('، ')}) — والجلسة دي ${takes} دقيقة`
        )
      }

      const payload: Record<string, unknown> = {
        client_id: client.id,
        client_name: client.name ?? '',
        client_phone: client.phone ?? '',
        service_id: serviceId,
        service_name: serviceLabel(service, services),
        // What the hour has to keep free for her.
        duration_minutes: takes,
        date: values.date,
        time: values.time,
        notes: values.notes?.trim() ?? '',
      }

      if (editTarget) {
        await updateReservation(editTarget.id, payload)
        toast.success('تم تعديل الحجز ✅')
      } else {
        await createReservation({
          ...payload,
          // Nothing is charged at booking time — the total is agreed and
          // written when the session is closed.
          price_at_booking: 0,
          priced_at: null,
          status: 'confirmed',
          booked_by: 'staff',
          admin_id: userProfile?.uid ?? null,
          paid_amount: 0,
          payment_status: 'unpaid',
        })
        toast.success('تم إضافة الحجز ✅')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  /** Past its hour and still not closed — the row the desk has to chase. */
  function overdue(r: Reservation) {
    return r.status !== 'completed' && r.status !== 'cancelled' && isPastSlot(r.date, r.time)
  }

  /**
   * The one thing this row is waiting for. The assistant collects money, the
   * doctor closes sessions, and a request from the site needs confirming before
   * either — so each row offers exactly one button, and never all of them.
   */
  function primaryAction(r: Reservation) {
    if (r.status === 'pending') {
      return { label: 'تأكيد', color: 'success' as const, onClick: () => handleConfirm(r) }
    }
    const closable = r.status === 'confirmed'
    const needsPricing = r.status === 'completed' && !isPriced(r)
    if (collecting) {
      return isPriced(r) && dueOf(r) > 0
        ? { label: `تحصيل ${formatMoney(dueOf(r))}`, color: 'primary' as const, onClick: () => setClosing(r) }
        : null
    }
    return closable || needsPricing
      ? { label: needsPricing ? 'تسعير' : 'إنهاء الجلسة', color: 'primary' as const, onClick: () => setClosing(r) }
      : null
  }

  const columns = useMemo<Column<Reservation>[]>(() => [
    {
      id: 'client',
      label: 'العميلة',
      sortValue: r => nameOf(r),
      width: '22%',
      render: r => (
        <div>
          <p className="font-semibold" style={{ color: C.text }}>{nameOf(r)}</p>
          <p className="text-xs text-gray-400" dir="ltr">{phoneOf(r) || '—'}</p>
          {/* With the website tab gone, this is the only thing that says where
              the booking came from — so it has to be readable, not a whisper. */}
          <Chip
            size="small"
            variant="outlined"
            label={r.booked_by === 'client' ? '🌐 من الموقع' : '☎️ من العيادة'}
            sx={{
              height: 20,
              mt: 0.5,
              fontSize: '0.68rem',
              fontWeight: 600,
              ...(r.booked_by === 'client'
                ? { color: C.blue, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }
                : { color: '#6B7280', borderColor: '#E5E7EB' }),
            }}
          />
        </div>
      ),
    },
    {
      id: 'service',
      label: 'الخدمة',
      sortValue: r => serviceOf(r),
      render: r => (
        <p className="text-gray-700">{serviceOf(r)}</p>
      ),
    },
    {
      id: 'when',
      label: 'المعاد',
      sortValue: r => `${r.date} ${r.time}`,
      width: 140,
      render: r => (
        <div className="whitespace-nowrap">
          <p className="text-gray-700">{formatDateShort(r.date)}</p>
          <p className="text-xs text-gray-400">{formatTime(r.time)}</p>
        </div>
      ),
    },
    {
      id: 'status',
      label: 'الحالة',
      sortValue: r => r.status,
      width: 110,
      render: r => <StatusBadge status={r.status} />,
    },
    {
      id: 'money',
      label: 'الإجمالي والدفع',
      sortValue: r => toNumber(r.price_at_booking),
      hideBelow: 'md',
      width: 150,
      render: r => (
        <div className="whitespace-nowrap">
          <PriceText r={r} service={rateDocOf(r)} />
          <div className="mt-1"><PaymentCell r={r} /></div>
        </div>
      ),
    },
    {
      id: 'actions',
      label: '',
      align: 'left',
      width: 170,
      render: r => {
        const primary = primaryAction(r)
        const closed = r.status === 'completed' || r.status === 'cancelled'
        // Closing a session is the primary button on some rows; it only needs
        // to appear in the menu on the rows where it isn't.
        const closeInMenu = !closed && primary?.onClick !== undefined
          && primary.label !== 'إنهاء الجلسة' && primary.label !== 'تسعير'
        const wa = waLink(r)
        const menu: RowAction[] = [
          { label: 'تعديل', icon: <EditRounded fontSize="small" />, onClick: () => openEdit(r) },
          { label: 'واتساب', icon: <WhatsAppIcon fontSize="small" />, href: wa, hidden: !wa, onClick: () => {} },
          {
            label: 'إنهاء الجلسة',
            icon: <DoneAllRounded fontSize="small" />,
            onClick: () => setClosing(r),
            hidden: !closeInMenu,
          },
          {
            label: 'إلغاء الحجز',
            icon: <CancelOutlined fontSize="small" />,
            onClick: () => handleCancel(r),
            hidden: closed,
            danger: true,
          },
          {
            label: 'مسح',
            icon: <DeleteOutlineRounded fontSize="small" />,
            onClick: () => handleDelete(r),
            hidden: !closed,
            danger: true,
          },
        ]
        return (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {primary && (
              <MuiButton
                size="small"
                variant={primary.color === 'success' ? 'contained' : 'outlined'}
                color={primary.color}
                disabled={busyId === r.id}
                onClick={primary.onClick}
                sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
              >
                {primary.label}
              </MuiButton>
            )}
            <RowMenu actions={menu} disabled={busyId === r.id} />
          </Stack>
        )
      },
    },
    // Recreated per render on purpose: every cell above reads live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [clientMap, serviceMap, services, busyId, collecting])

  /**
   * The new-booking button sits in the table's own toolbar rather than up in
   * the page header: it belongs with the list it adds to, and the header stays
   * a title instead of a third bar of controls.
   */
  const addButton = (
    <MuiButton
      variant="contained"
      startIcon={<AddRounded />}
      onClick={openCreate}
      sx={{ whiteSpace: 'nowrap' }}
    >
      حجز جديد
    </MuiButton>
  )

  /** Waiting on someone to confirm it — wherever it was booked from. */
  const pendingCount = useMemo(
    () => buckets[tab].filter(r => r.status === 'pending').length,
    [buckets, tab]
  )

  /** The day's work: what is happening now, what is coming, and the archive. */
  const tabs = [
    { value: 'today' as const, label: 'النهاردة', count: buckets.today.length },
    { value: 'upcoming' as const, label: 'الجاية', count: buckets.upcoming.length },
    { value: 'past' as const, label: 'الأرشيف', count: buckets.past.length },
  ]

  const tableHeader = (
    <>
      <MuiTabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          px: 1,
          borderBottom: `1px solid ${C.primarySoft}`,
          '& .MuiTab-root': { minHeight: 52, fontWeight: 700, fontSize: '0.85rem' },
        }}
      >
        {tabs.map(t => (
          <Tab
            key={t.value}
            value={t.value}
            label={
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <span>{t.label}</span>
                {t.count > 0 && (
                  <Chip
                    size="small"
                    label={t.count}
                    sx={{ height: 20, minWidth: 20, fontSize: '0.7rem', pointerEvents: 'none' }}
                  />
                )}
              </Stack>
            }
          />
        ))}
      </MuiTabs>

      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: `1px solid ${C.primarySoft}`,
        }}
      >
        <TextField
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو التليفون"
          sx={{ flex: '1 1 260px', maxWidth: 380 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" sx={{ color: C.primary, opacity: 0.6 }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {visible.length} من {reservations.length}
        </Box>
        {/* The count the desk acts on — the rows themselves are marked too. */}
        {pendingCount > 0 && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={`${pendingCount} محتاجة تأكيد`}
            sx={{ fontSize: '0.75rem' }}
          />
        )}
        <Box sx={{ marginInlineStart: 'auto' }}>{addButton}</Box>
      </Box>
    </>
  )


  return (
    // The screen is the frame: the header stays, the rows scroll inside the
    // table, and the page itself never grows a scrollbar.
    <div className="h-full min-h-0 flex flex-col">
      <PageHeader
        title="الحجوزات"
        subtitle={`${reservations.length} حجز في المجموع`}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="flex-1 min-h-0">
        <DataTable
          fill
          columns={columns}
          rows={visible}
          getRowId={r => r.id}
          loading={loading}
          header={tableHeader}
          rowSx={r => {
            if (overdue(r)) return { backgroundColor: '#FFF7ED' }
            // Not confirmed yet — most of these came in off the site overnight
            if (r.status === 'pending') return { backgroundColor: '#FFFBEB' }
            return undefined
          }}
          empty={
            <EmptyState
              icon={search ? '🔍' : '📅'}
              title={search ? 'مفيش نتائج للبحث ده' : emptyTitles[tab]}
              description={search ? 'جربي اسم أو رقم تاني' : undefined}
              action={!search ? addButton : undefined}
            />
          }
        />
        </div>
      )}

      {/* ─── Booking modal ───────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'تعديل الحجز' : 'حجز جديد'}
        width="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Client */}
          {!editTarget && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ backgroundColor: C.bg }}>
              {[
                { value: false, label: '👤 عميلة مسجلة' },
                { value: true, label: '✨ عميلة جديدة' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setIsNewClient(opt.value)}
                  className="py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={isNewClient === opt.value
                    ? { backgroundColor: C.primary, color: '#fff' }
                    : { color: C.text }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {isNewClient && !editTarget ? (
            <div className="space-y-4">
              <Field label="اسم العميلة" required error={errors.new_name?.message}>
                <Input
                  {...register('new_name', {
                    required: 'اكتبي اسم العميلة',
                    minLength: { value: 2, message: 'الاسم قصير أوي' },
                  })}
                  invalid={!!errors.new_name}
                  placeholder="مثال: سارة أحمد"
                />
              </Field>
              <Field label="رقم التليفون" required error={errors.new_phone?.message}>
                <Input
                  {...register('new_phone', {
                    required: 'اكتبي رقم التليفون',
                    validate: v => validateEgyptianPhone(v) || 'الرقم مش صحيح',
                  })}
                  invalid={!!errors.new_phone}
                  dir="ltr"
                  inputMode="tel"
                  placeholder="01012345678"
                />
              </Field>
            </div>
          ) : (
            <Field label="العميلة" required error={errors.client_id?.message}>
              <div className="space-y-2">
                <Input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="ابحثي بالاسم أو الرقم..."
                />
                <input type="hidden" {...register('client_id', { required: 'اختاري العميلة' })} />
                <div
                  className="max-h-52 overflow-y-auto rounded-xl border divide-y"
                  style={{ borderColor: errors.client_id ? '#ef4444' : C.primarySoft }}
                >
                  {filteredClients.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      مفيش عميلة بالاسم ده — استخدمي "عميلة جديدة"
                    </p>
                  ) : (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setValue('client_id', c.id, { shouldValidate: true })}
                        className="w-full text-start px-4 py-3 transition-colors"
                        style={watchedClientId === c.id
                          ? { backgroundColor: C.primary, color: '#fff' }
                          : { backgroundColor: '#fff' }}
                      >
                        <span className="text-sm font-medium block">{c.name}</span>
                        <span className="text-xs opacity-70 block" dir="ltr">{c.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </Field>
          )}

          {/* Service — the listed rate is shown for reference, never as an input.
              A service that branches («ليزر» → الأجهزة) asks the type next; one
              that doesn't is booked straight from this field. */}
          <Field
            label="الخدمة"
            required
            error={errors.main_id?.message}
            hint={rateHint}
          >
            <Select
              {...register('main_id', {
                required: 'اختاري الخدمة',
                // A different service means a different set of types
                onChange: () => setValue('service_id', ''),
              })}
              invalid={!!errors.main_id}
            >
              <option value="">اختاري الخدمة...</option>
              {mainServices.map(s => {
                const inner = optionsOf(services, s.id).length
                // A service with no price yet is priced when its session ends,
                // so there's nothing to put next to the name.
                const rate = priceOf(s) > 0 ? ` — ${formatMoney(s.price)}` : ''
                return (
                  <option key={s.id} value={s.id}>
                    {s.name}{rate}{inner > 0 ? ` · ${inner} نوع` : ''}
                  </option>
                )
              })}
            </Select>
          </Field>

          {serviceOptions.length > 0 && (
            <Field
              label="النوع"
              required
              error={errors.service_id?.message}
              hint="بيحدد الجهاز/النوع اللي هيتعمل بيه — السعر جاي من الخدمة فوق"
            >
              <Select
                {...register('service_id', {
                  validate: v => serviceOptions.length === 0 || !!v || 'اختاري النوع',
                })}
                invalid={!!errors.service_id}
              >
                <option value="">اختاري النوع...</option>
                {serviceOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="التاريخ" required error={errors.date?.message}>
              <Input {...register('date', { required: 'اختاري التاريخ' })} invalid={!!errors.date} type="date" />
            </Field>
            <Field
              label="الوقت"
              required
              error={errors.time?.message}
              hint={watchedDate
                ? freeCount > 0
                  ? `${freeCount} معاد فاضي — العيادة من ٩ ص لـ ٩ م`
                  : 'اليوم ده اتحجز بالكامل'
                : 'اختاري التاريخ الأول'}
            >
              <Select
                {...register('time', {
                  required: 'اختاري المعاد',
                  validate: v => fitsInSlot(usage.get(slotOf(v)) ?? 0, minutes) ||
                    'الساعة دي مفيهاش وقت كفاية للجلسة دي — اختاري معاد تاني',
                })}
                invalid={!!errors.time}
              >
                <option value="">اختاري المعاد...</option>
                {/* An hour is either open for this session or it isn't — who's
                    already in it comes out only if a save actually collides. */}
                {slotOptions.map(({ slot, full, past }) => (
                  <option
                    key={slot}
                    value={slot}
                    disabled={full || past}
                    style={full ? { color: '#C0392B' } : undefined}
                  >
                    {formatTime(slot)}
                    {full ? ' — مليانة' : past ? ' — فات' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="ملاحظات">
            <Textarea {...register('notes')} rows={2} placeholder="أي حاجة مهمة عن الجلسة..." />
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">
              {editTarget ? 'حفظ التعديل' : 'إضافة الحجز'}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              رجوع
            </Button>
          </div>
        </form>
      </Modal>

      <CloseSessionSheet
        reservation={closing}
        service={closing ? rateDocOf(closing) : null}
        onClose={() => setClosing(null)}
        onSaved={() => { setClosing(null); reload() }}
      />

      {dialog}
    </div>
  )
}

const emptyTitles: Record<TabKey, string> = {
  today: 'مفيش حجوزات النهاردة',
  upcoming: 'مفيش حجوزات جاية',
  past: 'مفيش حجوزات سابقة',
}

/** Reads either as money, or as the reason there isn't any money yet. */
function PriceText({ r, service }: { r: Reservation; service?: Service }) {
  const { text, pending } = priceLabel(r, service)
  return pending
    ? <span className="text-xs text-gray-400">{text}</span>
    : <span className="font-semibold" style={{ color: C.primary }}>{text}</span>
}

function PaymentCell({ r }: { r: Reservation }) {
  // Nothing is owed until the session has been priced — showing "لسه مدفعش"
  // before that reads as a debt the client doesn't have yet.
  if (!isPriced(r)) return <span className="text-xs text-gray-400 whitespace-nowrap">—</span>

  const paid = toNumber(r.paid_amount)
  const total = toNumber(r.price_at_booking)
  const status = r.payment_status ?? (paid <= 0 ? 'unpaid' : paid < total ? 'partial' : 'paid')
  return (
    <div className="whitespace-nowrap">
      <StatusBadge status={status} />
      {status === 'partial' && (
        <p className="text-xs text-gray-400 mt-1">{formatMoney(paid)} من {formatMoney(total)}</p>
      )}
    </div>
  )
}
