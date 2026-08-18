import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getServices, createService, updateService, softDeleteService, setServiceActive } from '../../services/firestore'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/Feedback'
import DataTable, { type Column } from '../../components/ui/DataTable'
import RowMenu, { type RowAction } from '../../components/ui/RowMenu'
import Chip from '@mui/material/Chip'
import EditRounded from '@mui/icons-material/EditRounded'
import AddRounded from '@mui/icons-material/AddRounded'
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded'
import VisibilityRounded from '@mui/icons-material/VisibilityRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { Field, Input, Textarea, Button } from '../../components/ui/Form'
import { formatMoney, toNumber } from '../../utils/formatters'
import { groupServices, sessionMinutes } from '../../utils/services'
import { SLOT_MINUTES } from '../../utils/slots'
import { C } from '../../theme'
import type { Service } from '../../types'

interface ServiceForm {
  name: string
  description: string
  duration_minutes: string
  price: string
}

/** The lengths a session actually runs to — an hour holds 60 minutes of them. */
const durationChoices = [15, 20, 30, 45, 60]

/**
 * What one session of this service costs. It's what the closing sheet opens the
 * total on; a service with none set is priced by hand when its session ends.
 */
function priceOf(s: Service) {
  const price = toNumber(s.price)
  return price > 0
    ? { value: formatMoney(price), priced: true }
    : { value: '', priced: false }
}

/** How many of these sessions the clinic can stack inside one hour. */
function perHour(s: Service) {
  const minutes = toNumber(s.duration_minutes) || SLOT_MINUTES
  const n = Math.floor(SLOT_MINUTES / minutes)
  return n > 1 ? `${n} جلسات في الساعة` : 'جلسة واحدة في الساعة'
}

export default function Services() {
  const { data, loading, error, reload } = useLoader(() => getServices(), [])
  const services = data ?? []
  const groups = groupServices(services)
  const optionCount = services.length - groups.length
  const { confirm, dialog } = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  /** Set when the doc being saved is a variant inside this service. */
  const [parent, setParent] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ServiceForm>()
  const watchedDuration = watch('duration_minutes')

  const blank: ServiceForm = { name: '', description: '', duration_minutes: '', price: '' }

  function openCreate() {
    setEditTarget(null)
    setParent(null)
    reset(blank)
    setModalOpen(true)
  }

  /** Adds a device / area / tier inside an existing service. */
  function openAddOption(main: Service) {
    setEditTarget(null)
    setParent(main)
    reset(blank)
    setModalOpen(true)
  }

  function openEdit(s: Service) {
    setEditTarget(s)
    setParent(s.parent_id ? services.find(x => x.id === s.parent_id) ?? null : null)
    reset({
      name: s.name ?? '',
      description: s.description ?? '',
      duration_minutes: toNumber(s.duration_minutes) > 0 ? String(s.duration_minutes) : '',
      price: toNumber(s.price) > 0 ? String(toNumber(s.price)) : '',
    })
    setModalOpen(true)
  }

  async function onSubmit(values: ServiceForm) {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        parent_id: parent?.id ?? null,
        description: values.description?.trim() ?? '',
        // 0 = a type falling back to its service's length, or an hour for a
        // service that never got one.
        duration_minutes: Math.min(toNumber(values.duration_minutes), SLOT_MINUTES),
        // The rate sits on the service, never on a type inside it — a type is
        // a choice of *what* is used, not of what it costs.
        price: parent ? null : (values.price.trim() ? toNumber(values.price) : null),
      }
      if (editTarget) {
        await updateService(editTarget.id, payload)
        toast.success(parent ? 'تم تعديل النوع' : 'تم تعديل الخدمة')
      } else {
        await createService(payload)
        toast.success(parent ? 'تم إضافة النوع' : 'تم إضافة الخدمة')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(s: Service, options: Service[]) {
    try {
      await setServiceActive(s.id, !s.is_active)
      toast.success(
        s.is_active
          ? `تم إخفاء الخدمة${options.length ? ' وأنواعها' : ''}`
          : `تم تفعيل الخدمة${options.length ? ' وأنواعها' : ''}`
      )
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  async function handleDelete(s: Service, options: Service[]) {
    const ok = await confirm({
      title: s.parent_id ? 'مسح النوع' : 'مسح الخدمة',
      message: options.length
        ? `هتمسحي خدمة "${s.name}" و${options.length} نوع جواها؟ الحجوزات القديمة هتفضل زي ما هي.`
        : `هتمسحي "${s.name}"؟ الحجوزات القديمة هتفضل زي ما هي.`,
      confirmLabel: 'مسح',
      danger: true,
    })
    if (!ok) return
    try {
      await softDeleteService(s.id)
      toast.success('تم المسح')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  /**
   * The catalogue is two levels deep, so the table is too: each service is
   * followed by the types booked under it. Sorting is deliberately off — the
   * order *is* the structure, and a sorted column would scatter every type away
   * from its service.
   */
  const rows = useMemo(
    () => groups.flatMap(({ service, options }) => [
      { service, parent: null as Service | null },
      ...options.map(o => ({ service: o, parent: service })),
    ]),
    [groups]
  )

  const columns = useMemo<Column<{ service: Service; parent: Service | null }>[]>(() => [
    {
      id: 'name',
      label: 'الخدمة',
      render: ({ service: s, parent }) => (
        <div style={{ paddingInlineStart: parent ? 22 : 0 }}>
          <p className={parent ? 'text-sm' : 'font-semibold'} style={{ color: parent ? '#6B7280' : C.text }}>
            {parent && <span style={{ color: C.primarySoft }}>↳ </span>}
            {s.name}
          </p>
          {s.description && (
            <p className="text-xs text-gray-400 line-clamp-1">{s.description}</p>
          )}
        </div>
      ),
    },
    {
      id: 'duration',
      label: 'مدة الجلسة',
      width: 190,
      render: ({ service: s }) => (
        <span className="whitespace-nowrap">
          <span style={{ color: C.primary, fontWeight: 600 }}>{sessionMinutes(s, services)} دقيقة</span>
          <span className="text-xs text-gray-400"> · {perHour(s)}</span>
        </span>
      ),
    },
    {
      id: 'price',
      label: 'السعر',
      width: 170,
      hideBelow: 'md',
      render: ({ service: s, parent }) => {
        if (parent) return <span className="text-xs text-gray-400">سعر الخدمة</span>
        const price = priceOf(s)
        return price.priced
          ? (
            <span className="whitespace-nowrap" style={{ color: C.primary, fontWeight: 700 }}>
              {price.value}
            </span>
          )
          : <span className="text-xs text-gray-400">بيتحدد وقت إنهاء الجلسة</span>
      },
    },
    {
      id: 'state',
      label: 'الحالة',
      width: 110,
      render: ({ service: s }) => (
        <Chip
          size="small"
          variant="outlined"
          color={s.is_active ? 'success' : 'default'}
          label={s.is_active ? 'مفعّلة' : 'مخفية'}
        />
      ),
    },
    {
      id: 'actions',
      label: '',
      align: 'left',
      width: 60,
      render: ({ service: s, parent }) => {
        const options = parent ? [] : (groups.find(g => g.service.id === s.id)?.options ?? [])
        const actions: RowAction[] = [
          { label: 'تعديل', icon: <EditRounded fontSize="small" />, onClick: () => openEdit(s) },
          {
            label: 'إضافة نوع جوّاها',
            icon: <AddRounded fontSize="small" />,
            onClick: () => openAddOption(s),
            hidden: !!parent,
          },
          {
            label: s.is_active ? 'إخفاء' : 'تفعيل',
            icon: s.is_active
              ? <VisibilityOffRounded fontSize="small" />
              : <VisibilityRounded fontSize="small" />,
            onClick: () => handleToggleActive(s, options),
            hidden: !!parent,
          },
          {
            label: 'مسح',
            icon: <DeleteOutlineRounded fontSize="small" />,
            onClick: () => handleDelete(s, options),
            danger: true,
          },
        ]
        return <RowMenu actions={actions} />
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [groups, services])

  const addButton = <Button className="w-full sm:w-auto" onClick={openCreate}>+ إضافة خدمة</Button>

  return (
    <div>
      <PageHeader
        title="الخدمات"
        subtitle={`${groups.length} خدمة${optionCount ? ` · ${optionCount} نوع` : ''}`}
        action={addButton}
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={r => r.service.id}
          loading={loading}
          paginated={false}
          rowSx={r => ({
            ...(r.service.is_active ? null : { opacity: 0.6 }),
            // A type belongs to the service above it, so it sits back from it
            ...(r.parent ? { backgroundColor: 'rgba(139,58,82,0.02)' } : null),
          })}
          empty={
            <EmptyState
              icon="✨"
              title="مفيش خدمات لسه"
              description="ضيفي أول خدمة عشان تظهر في الحجز وفي الموقع"
              action={addButton}
            />
          }
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          parent
            ? (editTarget ? `تعديل نوع في «${parent.name}»` : `إضافة نوع في «${parent.name}»`)
            : (editTarget ? 'تعديل خدمة' : 'إضافة خدمة')
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {parent && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ backgroundColor: C.bg, color: C.primary }}>
              العميلة هتختار «{parent.name}» الأول، وبعدين تختار النوع ده.
            </p>
          )}

          <Field label={parent ? 'اسم النوع' : 'اسم الخدمة'} required error={errors.name?.message}>
            <Input
              {...register('name', { required: parent ? 'اكتبي اسم النوع' : 'اكتبي اسم الخدمة' })}
              invalid={!!errors.name}
              placeholder={parent ? 'مثال: جهاز كانديلا' : 'مثال: ليزر'}
            />
          </Field>

          <Field label="الوصف">
            <Textarea {...register('description')} rows={2} placeholder="بيظهر للعملاء في الموقع" />
          </Field>

          {/* The price lives on the service, not on the types inside it. It's
              a default, not a commitment: the closing sheet opens on it and
              whoever closes the session can still change the figure. */}
          {!parent && (
            <Field
              label="سعر الجلسة (جنيه)"
              error={errors.price?.message}
              hint="بيظهر جاهز وقت إنهاء الجلسة — سيبيه فاضي لو السعر بيختلف كل مرة"
            >
              <Input
                {...register('price', {
                  validate: v => !v || toNumber(v) >= 0 || 'السعر مينفعش يكون بالسالب',
                })}
                invalid={!!errors.price}
                type="number" inputMode="numeric" min={0} dir="ltr"
                placeholder="مثال: 500"
              />
            </Field>
          )}

          <Field
            label="مدة الجلسة (دقيقة)"
            error={errors.duration_minutes?.message}
            hint={parent
              ? 'سيبيها فاضية عشان تاخد مدة الخدمة الرئيسية'
              : 'الساعة فيها ٦٠ دقيقة — الجلسة اللي بنص ساعة بتسيب نص الساعة مفتوح لحد تاني'}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {durationChoices.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValue('duration_minutes', String(m), { shouldValidate: true })}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    style={toNumber(watchedDuration) === m
                      ? { backgroundColor: C.primary, color: '#fff', borderColor: C.primary }
                      : { backgroundColor: '#fff', color: C.primary, borderColor: C.primarySoft }}
                  >
                    {m} دقيقة
                  </button>
                ))}
              </div>
              <Input
                {...register('duration_minutes', {
                  validate: v => {
                    if (!v) return true
                    const n = toNumber(v)
                    if (n <= 0) return 'المدة لازم تكون أكبر من صفر'
                    if (n > SLOT_MINUTES) return `أطول مدة للجلسة ${SLOT_MINUTES} دقيقة`
                    return true
                  },
                })}
                invalid={!!errors.duration_minutes}
                type="number" inputMode="numeric" min={0} max={SLOT_MINUTES} dir="ltr"
                placeholder={parent ? `مدة الخدمة (${sessionMinutes(parent, services)} دقيقة)` : '60'}
              />
            </div>
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">حفظ</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>رجوع</Button>
          </div>
        </form>
      </Modal>

      {dialog}
    </div>
  )
}
