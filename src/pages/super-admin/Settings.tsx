import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getClinicSettings, saveClinicSettings } from '../../services/firestore'
import { useLoader, messageFor } from '../../hooks/useLoader'
import PageHeader from '../../components/ui/PageHeader'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Button } from '../../components/ui/Form'
import { C } from '../../theme'

interface ClinicForm {
  name: string
  phone: string
  address: string
  workingHours: string
  googleReviewLink: string
  partners: { name: string }[]
}

const defaults: ClinicForm = {
  name: 'ريم غلو هاوس',
  phone: '+201000000000',
  address: 'القاهرة، مصر',
  workingHours: '9 ص - 9 م',
  googleReviewLink: '',
  partners: [{ name: 'ريم' }, { name: 'رانيا' }],
}

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const { data, loading, error, reload } = useLoader(() => getClinicSettings(), [])

  const { register, handleSubmit, reset, control } = useForm<ClinicForm>({ defaultValues: defaults })
  const { fields, append, remove } = useFieldArray({ control, name: 'partners' })

  useEffect(() => {
    if (!data) return
    const stored = Array.isArray(data.partners) ? (data.partners as string[]) : null
    reset({
      ...defaults,
      ...data,
      partners: stored?.length ? stored.map(name => ({ name })) : defaults.partners,
    } as ClinicForm)
  }, [data, reset])

  async function onSubmit(values: ClinicForm) {
    const partners = values.partners.map(p => p.name.trim()).filter(Boolean)
    if (partners.length === 0) {
      toast.error('لازم اسم شريكة واحدة على الأقل')
      return
    }
    setSaving(true)
    try {
      await saveClinicSettings({
        name: values.name,
        phone: values.phone,
        address: values.address,
        workingHours: values.workingHours,
        googleReviewLink: values.googleReviewLink,
        partners,
      })
      toast.success('تم حفظ الإعدادات')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div>
      <PageHeader title="إعدادات العيادة" subtitle="البيانات الأساسية وتوزيع الأرباح" />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-5">
        <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4" style={{ borderColor: C.primarySoft }}>
          <h2 className="text-sm font-bold" style={{ color: C.primary }}>بيانات العيادة</h2>
          <Field label="اسم العيادة"><Input {...register('name')} /></Field>
          <Field label="رقم التليفون"><Input {...register('phone')} dir="ltr" /></Field>
          <Field label="العنوان"><Input {...register('address')} /></Field>
          <Field label="مواعيد العمل"><Input {...register('workingHours')} /></Field>
          <Field label="لينك تقييم جوجل"><Input {...register('googleReviewLink')} dir="ltr" placeholder="https://g.page/r/..." /></Field>
        </section>

        <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4" style={{ borderColor: C.primarySoft }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: C.primary }}>الشريكات</h2>
            <p className="text-xs text-gray-400 mt-1">
              صافي ربح كل شهر بيتقسم بالتساوي على الأسماء دي في صفحة الحسابات
            </p>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="flex gap-2">
                <Input {...register(`partners.${i}.name` as const)} placeholder={`اسم الشريكة ${i + 1}`} />
                {fields.length > 1 && (
                  <Button
                    type="button" variant="outline"
                    onClick={() => remove(i)}
                    style={{ borderColor: '#FECACA', color: C.red }}
                  >
                    مسح
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={() => append({ name: '' })}>
            + إضافة شريكة
          </Button>
        </section>

        <Button type="submit" loading={saving} className="w-full sm:w-auto">حفظ الإعدادات</Button>
      </form>
    </div>
  )
}
