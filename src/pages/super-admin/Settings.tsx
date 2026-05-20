import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import PageHeader from '../../components/ui/PageHeader'

interface ClinicForm {
  name: string
  phone: string
  address: string
  workingHours: string
  googleReviewLink: string
}

const SETTINGS_DOC = doc(db, 'settings', 'clinic')

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const { register, handleSubmit, reset } = useForm<ClinicForm>({
    defaultValues: {
      name: 'ريم غلو هاوس',
      phone: '+201000000000',
      address: 'القاهرة، مصر',
      workingHours: '9 ص - 9 م',
      googleReviewLink: '',
    }
  })

  useEffect(() => {
    getDoc(SETTINGS_DOC).then(snap => {
      if (snap.exists()) reset(snap.data() as ClinicForm)
    }).finally(() => setLoading(false))
  }, [reset])

  async function onSubmit(data: ClinicForm) {
    setSaving(true)
    try {
      await setDoc(SETTINGS_DOC, data)
      toast.success('تم حفظ الإعدادات')
    } catch {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>

  return (
    <div>
      <PageHeader title="إعدادات العيادة" subtitle="البيانات الأساسية للعيادة" />

      <div className="max-w-xl bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Clinic Name</label>
            <input {...register('name')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone Number</label>
            <input {...register('phone')} dir="ltr" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Address</label>
            <input {...register('address')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Working Hours</label>
            <input {...register('workingHours')} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Google Review Link</label>
            <input {...register('googleReviewLink')} dir="ltr" placeholder="https://g.page/r/..." className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: '#8B3A52' }}
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </form>
      </div>
    </div>
  )
}
