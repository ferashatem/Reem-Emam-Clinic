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
import Tabs from '../../components/ui/Tabs'
import CloseSessionSheet from '../../components/session/CloseSessionSheet'
import { BranchPill, PricingPill, SourcePill } from '../../components/ui/Pills'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateShort, formatMoney, formatTime, todayISO, toNumber, isPastSlot,
} from '../../utils/formatters'
import { dueOf, isPriced, perPulseOf, priceLabel } from '../../utils/pricing'
import {
  groupServices, optionsOf, pricedService, serviceLabel, sessionMinutes,
} from '../../utils/services'
import {
  CLINIC_SLOTS, takenSlots, slotUsage, fitsInSlot, freeMinutes, isSlotPast, slotOf,
} from '../../utils/slots'
import {
  BRANCHES, BRANCH_INFO, branchOf, branchOfReservation, reservationsOfBranch,
} from '../../utils/branches'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'
import { buildWhatsAppLink, buildConfirmationMessage } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Branch, Client, Reservation, Service } from '../../types'

type TabKey = 'requests' | 'today' | 'upcoming' | 'past'
/** The desk can work one line at a time, or watch both at once. */
type BranchFilter = Branch | 'all'

/**
 * A booking is only who, what, and when. The pulse count — and so the price —
 * can't exist until the laser has actually run, so neither is asked for here;
 * both are filled in when the session is closed.
 */
interface BookingForm {
  client_id: string
  new_name: string
  new_phone: string
  new_age: string
  /** The main service — «ليزر». Narrows what the next field offers. */
  main_id: string
  /** What actually gets booked: the type inside, or the service itself. */
  service_id: string
  date: string
  time: string
  notes: string
}

const emptyForm: BookingForm = {
  client_id: '', new_name: '', new_phone: '', new_age: '',
  main_id: '', service_id: '', date: todayISO(), time: '', notes: '',
}

export default function StaffReservations() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()
  /** The assistant takes the money; the doctor records the pulses. */
  const collecting = userProfile?.role === 'staff'

  const { data, loading, error, reload } = useLoader(async () => {
    const [reservations, clients, services] = await Promise.all([
      getReservations(), getClients(), getActiveServices(),
    ])
    // Publishes the upcoming days to the public site's slot mirror, once per
    // session — bookings made before the mirror existed still have to show up
    // as taken on the website.
    void backfillAvailability(reservations, services)
    return { reservations, clients, services }
  }, [])

  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])
  const services = useMemo(() => data?.services ?? [], [data])

  const [tab, setTab] = useState<TabKey>('today')
  /**
   * Which line's book is on screen. It starts on both so nothing goes unseen
   * on a shared desk; switching narrows every tab, count and row below.
   */
  const [branchFilter, setBranchFilter] = useState<BranchFilter>('all')
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

  /** How many bookings each line is carrying, for the switcher's counts. */
  const branchCounts = useMemo(() => {
    const counts = { laser: 0, consult: 0 } as Record<Branch, number>
    for (const r of reservations) counts[branchOfReservation(r, services)]++
    return counts
  }, [reservations, services])

  // ─── Bucketing: website requests / today / upcoming / done ────────────────
  const buckets = useMemo(() => {
    const today = todayISO()
    const requests: Reservation[] = []
    const todayList: Reservation[] = []
    const upcoming: Reservation[] = []
    const past: Reservation[] = []

    const inScope = branchFilter === 'all'
      ? reservations
      : reservationsOfBranch(reservations, branchFilter, services)

    for (const r of inScope) {
      if (r.status === 'pending' && r.booked_by === 'client') {
        requests.push(r)
        continue
      }
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
      requests,
      today: todayList.sort(byTime),
      upcoming: upcoming.sort(byTime),
      past: past.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    }
  }, [reservations, branchFilter, services])

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

  /**
   * A website request being edited: it carries a name and a phone but no
   * patient file yet. The file is opened when the request is *confirmed*, so
   * editing one — moving it to another hour, fixing a misspelt name — has to
   * leave it unlinked. Otherwise a request the desk only rescheduled would
   * turn into a patient who has still never walked in.
   */
  const editingRequest = !!editTarget && !editTarget.client_id

  /**
   * Which client question the form is actually asking right now. The rules
   * below stay attached to their fields even while those fields are off
   * screen, so they read this instead of a value captured when they were
   * registered — a stale `required` is what made a request impossible to edit.
   */
  const mode = useRef<'picker' | 'new' | 'request'>('picker')
  mode.current = editingRequest ? 'request' : isNewClient ? 'new' : 'picker'

  const watchedMain = watch('main_id')
  const watchedClientId = watch('client_id')
  const watchedDate = watch('date')
  const watchedTime = watch('time')

  /**
   * Which line the booking being written belongs to — it follows the service
   * picked, since that's what decides which room she sits in. Everything below
   * (which hours are free, who's already in them) is asked of this line alone.
   */
  const formBranch = branchOf(serviceMap[watchedMain], services)

  const mainServices = useMemo(
    () => groupServices(services)
      .map(g => g.service)
      // On a line-specific view, only that line's services are offerable —
      // booking a كشف from the laser tab is how the two get mixed up again.
      .filter(s => branchFilter === 'all' || branchOf(s, services) === branchFilter),
    [services, branchFilter]
  )
  /** The types inside the chosen service — empty when it's booked directly. */
  const serviceOptions = useMemo(
    () => optionsOf(services, watchedMain),
    [services, watchedMain]
  )
  /** The rate to quote always sits on the main service, never on the type. */
  const selectedService = serviceMap[watchedMain]

  /** The listed rate, for reference only — nothing is charged at booking time. */
  const rateHint = !selectedService
    ? undefined
    : perPulseOf(selectedService) > 0
      ? `${formatMoney(selectedService.price_per_pulse)} للنبضة — الإجمالي بيتحسب بعد الجلسة`
      : toNumber(selectedService.price) > 0
        ? `سعر ثابت ${formatMoney(selectedService.price)}`
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
  /** The chosen line's bookings — the other room's hours are none of its business. */
  const branchReservations = useMemo(
    () => reservationsOfBranch(reservations, formBranch, services),
    [reservations, formBranch, services]
  )

  const usage = useMemo(
    // A booking from before sessions had lengths takes whatever its service
    // runs to today, so the desk sees the same free minutes the site does.
    () => slotUsage(branchReservations, watchedDate, editTarget?.id,
      r => sessionMinutes(serviceMap[r.service_id], services)),
    [branchReservations, watchedDate, editTarget, serviceMap, services]
  )
  const whoIsIn = useMemo(
    () => takenSlots(branchReservations, watchedDate, editTarget?.id),
    [branchReservations, watchedDate, editTarget]
  )

  const slotOptions = useMemo(() => {
    const current = slotOf(watchedTime)
    const list = CLINIC_SLOTS.map(slot => {
      const used = usage.get(slot) ?? 0
      return {
        slot,
        used,
        // An hour holds 60 minutes; it's only closed once this session no
        // longer fits in what's left of it.
        full: !fitsInSlot(used, minutes),
        names: (whoIsIn.get(slot) ?? []).map(nameOf),
        past: isSlotPast(watchedDate, slot),
      }
    })
    // A booking made before the fixed hours (or from the website) can sit on an
    // off-grid time — keep it selectable so editing doesn't silently move it.
    if (watchedTime && !CLINIC_SLOTS.includes(watchedTime) && current) {
      list.push({ slot: watchedTime, used: 0, full: false, names: [], past: false })
      list.sort((a, b) => a.slot.localeCompare(b.slot))
    }
    return list
    // `nameOf` only reads clientMap, which `whoIsIn` already tracks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage, whoIsIn, minutes, watchedDate, watchedTime, clientMap])

  const freeCount = slotOptions.filter(o => !o.full && !o.past).length

  function openCreate() {
    setEditTarget(null)
    setIsNewClient(false)
    setClientSearch('')
    reset({ ...emptyForm, date: todayISO() })
    setModalOpen(true)
  }

  function openEdit(r: Reservation) {
    setEditTarget(r)
    setIsNewClient(false)
    // Seed the search so the booked client is guaranteed to be in the visible list
    setClientSearch(r.client_name || clientMap[r.client_id]?.name || '')
    reset({
      ...emptyForm,
      client_id: r.client_id,
      // An unconfirmed request has no file to point at, so its name and phone
      // are edited directly on the booking.
      new_name: r.client_name ?? '',
      new_phone: r.client_phone ?? '',
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
      age: values.new_age ? toNumber(values.new_age) : null,
      source: 'walk-in',
      uid: null,
    })
    return { id: ref.id, name: values.new_name.trim(), phone } as Client
  }

  async function onSubmit(values: BookingForm) {
    setSaving(true)
    try {
      // A request keeps its visitor details on the booking; everything else
      // resolves to a patient file before it's written.
      const client = editingRequest ? null : await resolveClient(values)
      // A service with no types inside is booked as itself.
      const serviceId = optionsOf(services, values.main_id).length > 0
        ? values.service_id
        : values.main_id
      const service = serviceMap[serviceId]
      const takes = sessionMinutes(service, services)
      const branch = branchOf(service, services)

      // The list on screen can be minutes old — re-read the day before writing
      // so two people booking at once can't overrun the same hour. Only this
      // line's room counts: the other one is free regardless of what's in it.
      const sameDay = reservationsOfBranch(
        await getReservations({ date: values.date }), branch, services
      )
      const slot = slotOf(values.time)
      const used = slotUsage(sameDay, values.date, editTarget?.id,
        x => sessionMinutes(serviceMap[x.service_id], services)).get(slot) ?? 0
      if (!fitsInSlot(used, takes)) {
        const who = (takenSlots(sameDay, values.date, editTarget?.id).get(slot) ?? []).map(nameOf)
        throw new Error(
          `الساعة دي فاضل فيها ${freeMinutes(used)} دقيقة بس (${who.join('، ')}) — والجلسة دي ${takes} دقيقة`
        )
      }

      const rate = perPulseOf(pricedService(service, services))
      const payload: Record<string, unknown> = {
        ...(client
          ? { client_id: client.id, client_name: client.name ?? '', client_phone: client.phone ?? '' }
          // `client_id` is left exactly as it was — null — so the request still
          // has to be confirmed before it becomes a patient.
          : { client_name: values.new_name.trim(), client_phone: normalizePhone(values.new_phone) }),
        service_id: serviceId,
        service_name: serviceLabel(service, services),
        // Pinned now, like the name and the rate: this is the line that sold
        // the session, and it stays that even if the service moves later.
        branch,
        // What the hour has to keep free for her.
        duration_minutes: takes,
        date: values.date,
        time: values.time,
        notes: values.notes?.trim() ?? '',
      }

      if (editTarget) {
        // Re-snapshot the rate only while the session is still unpriced —
        // once it's closed, the number the client was actually charged wins.
        if (!isPriced(editTarget)) payload.price_per_pulse = rate > 0 ? rate : null
        await updateReservation(editTarget.id, payload)
        toast.success('تم تعديل الحجز ✅')
      } else {
        await createReservation({
          ...payload,
          // The rate is pinned now; the service's price may change before the
          // client actually sits down, but this is the deal that was struck.
          price_per_pulse: rate > 0 ? rate : null,
          pulses: null,
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

  const tabs = [
    { value: 'requests' as const, label: 'طلبات من الموقع', count: buckets.requests.length },
    { value: 'today' as const, label: 'النهاردة', count: buckets.today.length },
    { value: 'upcoming' as const, label: 'الجاية', count: buckets.upcoming.length },
    { value: 'past' as const, label: 'اللي خلص', count: buckets.past.length },
  ]

  const addButton = (
    <Button onClick={openCreate} className="w-full sm:w-auto">+ حجز جديد</Button>
  )

  return (
    <div>
      <PageHeader
        title="الحجوزات"
        subtitle={`${reservations.length} حجز في المجموع`}
        action={addButton}
      />

      {buckets.requests.length > 0 && tab !== 'requests' && (
        <button
          onClick={() => setTab('requests')}
          className="w-full mb-4 rounded-2xl px-4 py-3 text-sm font-medium text-start border"
          style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' }}
        >
          🔔 في {buckets.requests.length} طلب حجز جديد من الموقع محتاج تأكيد — اضغطي هنا
        </button>
      )}

      <div className="space-y-3 mb-5">
        {/* Which book the desk is looking at. Everything under it — the tabs,
            their counts, the rows, and the services the form offers — narrows
            to the line picked here. */}
        <div className="flex gap-2 p-1 rounded-xl overflow-x-auto" style={{ backgroundColor: C.bg }}>
          {([
            { value: 'all' as const, label: 'الكل', icon: '📋', color: C.primary, count: reservations.length },
            ...BRANCHES.map(b => ({
              value: b,
              label: BRANCH_INFO[b].name,
              icon: BRANCH_INFO[b].icon,
              color: BRANCH_INFO[b].color,
              count: branchCounts[b],
            })),
          ]).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBranchFilter(opt.value)}
              className="flex-1 whitespace-nowrap py-2.5 px-3 rounded-lg text-sm font-medium transition-colors"
              style={branchFilter === opt.value
                ? { backgroundColor: opt.color, color: '#fff' }
                : { color: C.text }}
            >
              {opt.icon} {opt.label}
              <span className="text-xs opacity-70"> ({opt.count})</span>
            </button>
          ))}
        </div>

        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحثي بالاسم أو رقم التليفون..."
          aria-label="بحث"
        />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={search ? '🔍' : '📅'}
          title={search ? 'مفيش نتائج للبحث ده' : emptyTitles[tab]}
          description={search ? 'جربي اسم أو رقم تاني' : undefined}
          action={!search && tab !== 'requests' ? addButton : undefined}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-3 lg:hidden">
            {visible.map(r => (
              <ReservationCard
                key={r.id}
                r={r}
                name={nameOf(r)}
                service={serviceOf(r)}
                serviceDoc={rateDocOf(r)}
                branch={branchFilter === 'all' ? branchOfReservation(r, services) : null}
                collecting={collecting}
                busy={busyId === r.id}
                waHref={waLink(r)}
                onConfirm={() => handleConfirm(r)}
                onComplete={() => setClosing(r)}
                onCancel={() => handleCancel(r)}
                onEdit={() => openEdit(r)}
                onDelete={() => handleDelete(r)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: C.primarySoft }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: C.bg }}>
                  <tr>
                    {['العميلة', 'الخدمة', 'النبضات', 'التاريخ', 'الوقت', 'الإجمالي', 'الدفع', 'الحالة', ''].map(h => (
                      <th key={h} className="text-start text-xs font-semibold px-4 py-3 whitespace-nowrap" style={{ color: C.primary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id} className="border-t hover:bg-[#FDF6F0]/60 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{nameOf(r)}</p>
                        <p className="text-xs text-gray-400 tabular-nums" dir="ltr">{phoneOf(r) || '—'}</p>
                        <SourcePill bookedBy={r.booked_by} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{serviceOf(r)}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {branchFilter === 'all' && (
                            <BranchPill branch={branchOfReservation(r, services)} />
                          )}
                          <PricingPill reservation={r} service={rateDocOf(r)} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 tabular-nums">{r.pulses ? `${r.pulses} نبضة` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateShort(r.date)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(r.time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        <PriceText r={r} service={rateDocOf(r)} />
                      </td>
                      <td className="px-4 py-3"><PaymentCell r={r} /></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <RowActions
                          r={r}
                          collecting={collecting}
                          busy={busyId === r.id}
                          waHref={waLink(r)}
                          onConfirm={() => handleConfirm(r)}
                          onComplete={() => setClosing(r)}
                          onCancel={() => handleCancel(r)}
                          onEdit={() => openEdit(r)}
                          onDelete={() => handleDelete(r)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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

          {mode.current !== 'picker' ? (
            <div className="space-y-4">
              {editingRequest && (
                <p className="text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: '#FFF7ED', color: '#9A3412' }}>
                  ده لسه طلب من الموقع — الملف بيتفتح لما تأكديه، فالتعديل هنا على الطلب نفسه.
                </p>
              )}
              <Field label="اسم العميلة" required error={errors.new_name?.message}>
                <Input
                  {...register('new_name', {
                    validate: v => mode.current === 'picker' ||
                      (v ?? '').trim().length >= 2 || 'اكتبي اسم العميلة',
                  })}
                  invalid={!!errors.new_name}
                  placeholder="مثال: سارة أحمد"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="رقم التليفون" required error={errors.new_phone?.message}>
                  <Input
                    {...register('new_phone', {
                      validate: v => mode.current === 'picker' ||
                        validateEgyptianPhone(v) || 'الرقم مش صحيح',
                    })}
                    invalid={!!errors.new_phone}
                    dir="ltr"
                    inputMode="tel"
                    placeholder="01012345678"
                  />
                </Field>
                {/* The age belongs to a patient file, and a request hasn't got
                    one yet — asking for it here would drop it on save. */}
                {!editingRequest && (
                  <Field label="السن" error={errors.new_age?.message}>
                    <Input {...register('new_age')} type="number" inputMode="numeric" min={1} max={120} placeholder="اختياري" />
                  </Field>
                )}
              </div>
            </div>
          ) : (
            <Field label="العميلة" required error={errors.client_id?.message}>
              <div className="space-y-2">
                <Input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="ابحثي بالاسم أو الرقم..."
                />
                <input
                  type="hidden"
                  {...register('client_id', {
                    validate: v => mode.current !== 'picker' || !!v || 'اختاري العميلة',
                  })}
                />
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
                // Older services still carry a rate; newer ones are priced when
                // the session ends, so there's nothing to put next to the name.
                const rate = perPulseOf(s) > 0
                  ? ` — ${formatMoney(s.price_per_pulse)} / نبضة`
                  : toNumber(s.price) > 0
                    ? ` — ${formatMoney(s.price)}`
                    : ''
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
                {/* An hour that's part-booked still shows what's left of it,
                    and who is already in it. */}
                {slotOptions.map(({ slot, used, full, names, past }) => (
                  <option key={slot} value={slot} disabled={full || past}>
                    {formatTime(slot)}
                    {full
                      ? ` — مليانة (${names.join('، ')})`
                      : used > 0
                        ? ` — فاضل ${freeMinutes(used)} د (${names.join('، ')})`
                        : past ? ' — فات' : ''}
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
  requests: 'مفيش طلبات حجز من الموقع',
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

interface ActionProps {
  r: Reservation
  /** The assistant collects; the doctor prices. Changes what the button offers. */
  collecting: boolean
  busy: boolean
  waHref: string
  onConfirm: () => void
  onComplete: () => void
  onCancel: () => void
  onEdit: () => void
  onDelete: () => void
}

function RowActions({
  r, collecting, busy, waHref, onConfirm, onComplete, onCancel, onEdit, onDelete,
}: ActionProps) {
  const canConfirm = r.status === 'pending'
  const canComplete = r.status === 'confirmed' || r.status === 'pending'
  const closed = r.status === 'completed' || r.status === 'cancelled'
  // A finished-but-unpriced session still owes us its pulse count.
  const needsPricing = r.status === 'completed' && !isPriced(r)
  // The assistant only has something to do here once there's a total to collect.
  const showAction = collecting
    ? isPriced(r) && dueOf(r) > 0
    : canComplete || needsPricing

  return (
    <div className="flex gap-1.5 justify-end flex-wrap">
      {canConfirm && (
        <Button size="sm" variant="success" onClick={onConfirm} disabled={busy}>تأكيد</Button>
      )}
      {showAction && (
        <Button size="sm" onClick={onComplete} disabled={busy}>
          {collecting ? `تحصيل ${formatMoney(dueOf(r))}` : 'إنهاء الجلسة'}
        </Button>
      )}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-xl text-xs font-medium text-white border border-transparent"
          style={{ backgroundColor: '#25D366' }}
        >
          واتساب
        </a>
      )}
      <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>تعديل</Button>
      {!closed && (
        <Button size="sm" variant="outline" onClick={onCancel} disabled={busy} style={{ borderColor: '#FECACA', color: C.red }}>
          إلغاء
        </Button>
      )}
      {closed && (
        <Button size="sm" variant="outline" onClick={onDelete} disabled={busy} style={{ borderColor: '#FECACA', color: C.red }}>
          مسح
        </Button>
      )}
    </div>
  )
}

function ReservationCard({
  r, name, service, serviceDoc, branch, collecting, busy, waHref,
  onConfirm, onComplete, onCancel, onEdit, onDelete,
}: ActionProps & {
  name: string
  service: string
  serviceDoc?: Service
  /** Null on a single-line view, where every card would say the same thing. */
  branch: Branch | null
}) {
  const overdue = r.status !== 'completed' && r.status !== 'cancelled' && isPastSlot(r.date, r.time)

  return (
    <div
      className="bg-white rounded-2xl p-4 border shadow-sm"
      style={{ borderColor: overdue ? '#FDBA74' : C.primarySoft }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{name}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{service}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {branch && <BranchPill branch={branch} />}
            <PricingPill reservation={r} service={serviceDoc} />
            <SourcePill bookedBy={r.booked_by} />
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
        <Info label="التاريخ" value={formatDateShort(r.date)} />
        <Info label="الوقت" value={formatTime(r.time)} />
        {r.pulses ? <Info label="النبضات" value={`${r.pulses} نبضة`} /> : null}
        <Info
          label="الإجمالي"
          value={priceLabel(r, serviceDoc).text}
          strong={!priceLabel(r, serviceDoc).pending}
        />
      </div>

      <div className="mb-3"><PaymentCell r={r} /></div>

      {r.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 mb-3">{r.notes}</p>}

      <RowActions
        r={r} collecting={collecting} busy={busy} waHref={waHref}
        onConfirm={onConfirm} onComplete={onComplete}
        onCancel={onCancel} onEdit={onEdit} onDelete={onDelete}
      />
    </div>
  )
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className={strong ? 'font-semibold' : 'font-medium'} style={strong ? { color: C.primary } : undefined}>
        {value}
      </p>
    </div>
  )
}
