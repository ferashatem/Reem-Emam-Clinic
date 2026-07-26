import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getServices, createService, updateService, softDeleteService } from '../../services/firestore'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Textarea, Button } from '../../components/ui/Form'
import { formatMoney, toNumber } from '../../utils/formatters'
import { C } from '../../theme'
import type { Service } from '../../types'

interface ServiceForm {
  name: string
  description: string
  duration_minutes: string
  price: string
  price_per_pulse: string
}

export default function Services() {
  const { data, loading, error, reload } = useLoader(() => getServices(), [])
  const services = data ?? []
  const { confirm, dialog } = useConfirm()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>()

  function openCreate() {
    setEditTarget(null)
    reset({ name: '', description: '', duration_minutes: '', price: '', price_per_pulse: '' })
    setModalOpen(true)
  }

  function openEdit(s: Service) {
    setEditTarget(s)
    reset({
      name: s.name ?? '',
      description: s.description ?? '',
      duration_minutes: s.duration_minutes != null ? String(s.duration_minutes) : '',
      price: String(toNumber(s.price)),
      price_per_pulse: toNumber(s.price_per_pulse) > 0 ? String(s.price_per_pulse) : '',
    })
    setModalOpen(true)
  }

  async function onSubmit(values: ServiceForm) {
    setSaving(true)
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() ?? '',
        duration_minutes: toNumber(values.duration_minutes),
        price: toNumber(values.price),
        // Empty = flat-price service; the booking form then ignores pulses for pricing.
        price_per_pulse: values.price_per_pulse ? toNumber(values.price_per_pulse) : null,
      }
      if (editTarget) {
        await updateService(editTarget.id, payload)
        toast.success('تم تعديل الخدمة')
      } else {
        await createService(payload)
        toast.success('تم إضافة الخدمة')
      }
      setModalOpen(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(s: Service) {
    try {
      await updateService(s.id, { is_active: !s.is_active })
      toast.success(s.is_active ? 'تم إخفاء الخدمة' : 'تم تفعيل الخدمة')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  async function handleDelete(s: Service) {
    const ok = await confirm({
      title: 'مسح الخدمة',
      message: `هتمسحي خدمة "${s.name}"؟ الحجوزات القديمة هتفضل زي ما هي.`,
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

  const addButton = <Button className="w-full sm:w-auto" onClick={openCreate}>+ إضافة خدمة</Button>

  return (
    <div>
      <PageHeader title="الخدمات" subtitle={`${services.length} خدمة`} action={addButton} />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : services.length === 0 ? (
        <EmptyState icon="✨" title="مفيش خدمات لسه" description="ضيفي أول خدمة عشان تظهر في الحجز وفي الموقع" action={addButton} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(s => {
            const perPulse = toNumber(s.price_per_pulse)
            return (
              <div key={s.id} className="bg-white rounded-2xl p-5 shadow-sm border flex flex-col" style={{ borderColor: C.primarySoft }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base" style={{ color: C.text }}>{s.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'مفعّلة' : 'مخفية'}
                  </span>
                </div>

                {s.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{s.description}</p>}

                <div className="flex items-end justify-between mb-4 mt-auto">
                  <div>
                    {perPulse > 0 ? (
                      <>
                        <p className="text-lg font-bold" style={{ color: C.primary }}>{formatMoney(perPulse)}</p>
                        <p className="text-xs text-gray-400">للنبضة الواحدة</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold" style={{ color: C.primary }}>{formatMoney(s.price)}</p>
                        <p className="text-xs text-gray-400">سعر ثابت</p>
                      </>
                    )}
                  </div>
                  {!!s.duration_minutes && (
                    <span className="text-xs text-gray-400">{s.duration_minutes} دقيقة</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(s)}>تعديل</Button>
                  <Button
                    size="sm" variant="outline" className="flex-1"
                    onClick={() => handleToggleActive(s)}
                    style={s.is_active
                      ? { borderColor: '#FED7AA', color: '#C2410C' }
                      : { borderColor: '#BBF7D0', color: '#15803D' }}
                  >
                    {s.is_active ? 'إخفاء' : 'تفعيل'}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleDelete(s)}
                    style={{ borderColor: '#FECACA', color: C.red }}
                  >
                    مسح
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'تعديل خدمة' : 'إضافة خدمة'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="اسم الخدمة" required error={errors.name?.message}>
            <Input {...register('name', { required: 'اكتبي اسم الخدمة' })} invalid={!!errors.name} placeholder="مثال: ليزر وش" />
          </Field>

          <Field label="الوصف">
            <Textarea {...register('description')} rows={2} placeholder="بيظهر للعملاء في الموقع" />
          </Field>

          <Field
            label="سعر النبضة (جنيه)"
            error={errors.price_per_pulse?.message}
            hint="سيبيه فاضي لو الخدمة بسعر ثابت مش بالنبضة"
          >
            <Input
              {...register('price_per_pulse', {
                validate: v => !v || toNumber(v) > 0 || 'السعر لازم يكون أكبر من صفر',
              })}
              invalid={!!errors.price_per_pulse}
              type="number" inputMode="numeric" min={0} dir="ltr" placeholder="مثال: 15"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="السعر الثابت (جنيه)"
              required
              error={errors.price?.message}
              hint="بيُستخدم لو مفيش سعر نبضة، وبيظهر في الموقع"
            >
              <Input
                {...register('price', {
                  required: 'اكتبي السعر',
                  min: { value: 0, message: 'السعر لازم يكون موجب' },
                })}
                invalid={!!errors.price}
                type="number" inputMode="numeric" min={0} dir="ltr"
              />
            </Field>
            <Field label="المدة (دقيقة)" error={errors.duration_minutes?.message}>
              <Input {...register('duration_minutes')} type="number" inputMode="numeric" min={0} dir="ltr" />
            </Field>
          </div>

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
