import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getReservations, createReservation, updateReservation, softDeleteReservation,
  getClients, getActiveServices, createClient, getClientByPhone,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'
import Tabs from '../../components/ui/Tabs'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateShort, formatMoney, formatTime, todayISO, toNumber, isPastSlot,
} from '../../utils/formatters'
import { normalizePhone, validateEgyptianPhone } from '../../utils/validators'
import { buildWhatsAppLink, buildConfirmationMessage } from '../../utils/whatsapp'
import { C } from '../../theme'
import type { Client, Reservation, Service } from '../../types'

type TabKey = 'requests' | 'today' | 'upcoming' | 'past'

interface BookingForm {
  client_id: string
  new_name: string
  new_phone: string
  new_age: string
  service_id: string
  pulses: string
  price_at_booking: string
  date: string
  time: string
  notes: string
}

const emptyForm: BookingForm = {
  client_id: '', new_name: '', new_phone: '', new_age: '',
  service_id: '', pulses: '', price_at_booking: '',
  date: todayISO(), time: '', notes: '',
}

export default function StaffReservations() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()

  const { data, loading, error, reload } = useLoader(async () => {
    const [reservations, clients, services] = await Promise.all([
      getReservations(), getClients(), getActiveServices(),
    ])
    return { reservations, clients, services }
  }, [])

  const reservations = useMemo(() => data?.reservations ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])
  const services = useMemo(() => data?.services ?? [], [data])

  const [tab, setTab] = useState<TabKey>('today')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map(c => [c.id, c])) as Record<string, Client>,
    [clients]
  )
  const serviceMap = useMemo(
    () => Object.fromEntries(services.map(s => [s.id, s])) as Record<string, Service>,
    [services]
  )

  function nameOf(r: Reservation) {
    return r.client_name || clientMap[r.client_id]?.name || 'عميلة محذوفة'
  }
  function phoneOf(r: Reservation) {
    return r.client_phone || clientMap[r.client_id]?.phone || ''
  }
  function serviceOf(r: Reservation) {
    return r.service_name || serviceMap[r.service_id]?.name || '—'
  }

  // ─── Bucketing: website requests / today / upcoming / done ────────────────
  const buckets = useMemo(() => {
    const today = todayISO()
    const requests: Reservation[] = []
    const todayList: Reservation[] = []
    const upcoming: Reservation[] = []
    const past: Reservation[] = []

    for (const r of reservations) {
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
      price: toNumber(r.price_at_booking),
    }))
  }

  // ─── Booking form ─────────────────────────────────────────────────────────
  const [isNewClient, setIsNewClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [priceTouched, setPriceTouched] = useState(false)

  const form = useForm<BookingForm>({ defaultValues: emptyForm })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = form

  const watchedService = watch('service_id')
  const watchedPulses = watch('pulses')
  const watchedClientId = watch('client_id')
  const selectedService = serviceMap[watchedService]
  const perPulse = toNumber(selectedService?.price_per_pulse)
  const isPerPulse = perPulse > 0

  // Auto-price: pulses × per-pulse rate, or the flat service price.
  // Stops as soon as the assistant types her own number (discount, package…).
  useEffect(() => {
    if (!selectedService || priceTouched) return
    const computed = isPerPulse
      ? toNumber(watchedPulses) * perPulse
      : toNumber(selectedService.price)
    setValue('price_at_booking', computed ? String(computed) : '')
  }, [selectedService, watchedPulses, perPulse, isPerPulse, priceTouched, setValue])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    const list = q
      ? clients.filter(c => (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      : clients
    return list.slice(0, 30)
  }, [clients, clientSearch])

  function openCreate() {
    setEditTarget(null)
    setIsNewClient(false)
    setClientSearch('')
    setPriceTouched(false)
    reset({ ...emptyForm, date: todayISO() })
    setModalOpen(true)
  }

  function openEdit(r: Reservation) {
    setEditTarget(r)
    setIsNewClient(false)
    // Seed the search so the booked client is guaranteed to be in the visible list
    setClientSearch(r.client_name || clientMap[r.client_id]?.name || '')
    setPriceTouched(true) // keep the price already agreed with the client
    reset({
      ...emptyForm,
      client_id: r.client_id,
      service_id: r.service_id,
      pulses: r.pulses != null ? String(r.pulses) : '',
      price_at_booking: String(toNumber(r.price_at_booking)),
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
      const client = await resolveClient(values)
      const service = serviceMap[values.service_id]
      const payload = {
        client_id: client.id,
        client_name: client.name ?? '',
        client_phone: client.phone ?? '',
        service_id: values.service_id,
        service_name: service?.name ?? '',
        pulses: values.pulses ? toNumber(values.pulses) : null,
        price_per_pulse: isPerPulse ? perPulse : null,
        price_at_booking: toNumber(values.price_at_booking),
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
                busy={busyId === r.id}
                waHref={waLink(r)}
                onConfirm={() => patch(r, { status: 'confirmed' }, 'تم تأكيد الحجز')}
                onComplete={() => patch(r, { status: 'completed' }, 'تم تسجيل الجلسة كمنتهية')}
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
                        <p className="text-xs text-gray-400" dir="ltr">{phoneOf(r) || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{serviceOf(r)}</td>
                      <td className="px-4 py-3 text-gray-600">{r.pulses ? `${r.pulses} نبضة` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateShort(r.date)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatTime(r.time)}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: C.primary }}>{formatMoney(r.price_at_booking)}</td>
                      <td className="px-4 py-3"><PaymentCell r={r} /></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <RowActions
                          r={r}
                          busy={busyId === r.id}
                          waHref={waLink(r)}
                          onConfirm={() => patch(r, { status: 'confirmed' }, 'تم تأكيد الحجز')}
                          onComplete={() => patch(r, { status: 'completed' }, 'تم تسجيل الجلسة كمنتهية')}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Field label="السن" error={errors.new_age?.message}>
                  <Input {...register('new_age')} type="number" inputMode="numeric" min={1} max={120} placeholder="اختياري" />
                </Field>
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

          {/* Service + pulses + price */}
          <Field label="الخدمة" required error={errors.service_id?.message}>
            <Select
              {...register('service_id', {
                required: 'اختاري الخدمة',
                onChange: () => setPriceTouched(false),
              })}
              invalid={!!errors.service_id}
            >
              <option value="">اختاري الخدمة...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {toNumber(s.price_per_pulse) > 0
                    ? `${formatMoney(s.price_per_pulse)} / نبضة`
                    : formatMoney(s.price)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="عدد النبضات"
              error={errors.pulses?.message}
              hint={isPerPulse ? `${formatMoney(perPulse)} للنبضة الواحدة` : 'اختياري — للتوثيق الطبي'}
            >
              <Input
                {...register('pulses', {
                  min: { value: 0, message: 'العدد لازم يكون موجب' },
                })}
                invalid={!!errors.pulses}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
              />
            </Field>
            <Field
              label="الإجمالي (جنيه)"
              required
              error={errors.price_at_booking?.message}
              hint={priceTouched ? 'اتعدّل يدوي' : 'بيتحسب أوتوماتيك'}
            >
              <Input
                {...register('price_at_booking', {
                  required: 'اكتبي الإجمالي',
                  min: { value: 0, message: 'المبلغ لازم يكون موجب' },
                  onChange: () => setPriceTouched(true),
                })}
                invalid={!!errors.price_at_booking}
                type="number"
                inputMode="numeric"
                min={0}
                dir="ltr"
                className="font-semibold"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="التاريخ" required error={errors.date?.message}>
              <Input {...register('date', { required: 'اختاري التاريخ' })} invalid={!!errors.date} type="date" />
            </Field>
            <Field label="الوقت" required error={errors.time?.message}>
              <Input {...register('time', { required: 'اختاري الوقت' })} invalid={!!errors.time} type="time" />
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

function PaymentCell({ r }: { r: Reservation }) {
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
  busy: boolean
  waHref: string
  onConfirm: () => void
  onComplete: () => void
  onCancel: () => void
  onEdit: () => void
  onDelete: () => void
}

function RowActions({ r, busy, waHref, onConfirm, onComplete, onCancel, onEdit, onDelete }: ActionProps) {
  const canConfirm = r.status === 'pending'
  const canComplete = r.status === 'confirmed' || r.status === 'pending'
  const closed = r.status === 'completed' || r.status === 'cancelled'

  return (
    <div className="flex gap-1.5 justify-end flex-wrap">
      {canConfirm && (
        <Button size="sm" variant="success" onClick={onConfirm} disabled={busy}>تأكيد</Button>
      )}
      {canComplete && (
        <Button size="sm" onClick={onComplete} disabled={busy}>تمت</Button>
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
  r, name, service, busy, waHref, onConfirm, onComplete, onCancel, onEdit, onDelete,
}: ActionProps & { name: string; service: string }) {
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
        </div>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
        <Info label="التاريخ" value={formatDateShort(r.date)} />
        <Info label="الوقت" value={formatTime(r.time)} />
        {r.pulses ? <Info label="النبضات" value={`${r.pulses} نبضة`} /> : null}
        <Info label="الإجمالي" value={formatMoney(r.price_at_booking)} strong />
      </div>

      <div className="mb-3"><PaymentCell r={r} /></div>

      {r.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 mb-3">{r.notes}</p>}

      <RowActions
        r={r} busy={busy} waHref={waHref}
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
