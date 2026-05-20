import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getAdmins, createAdmin, updateAdmin, softDeleteAdmin } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { normalizePhone } from '../../utils/validators'

interface AdminForm {
  name: string
  phone: string
  working_hours: string
}

export default function Admins() {
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const { userProfile } = useAuth()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdminForm>()

  async function load() {
    setLoading(true)
    setAdmins(await getAdmins())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditTarget(null); reset({}); setModalOpen(true) }
  function openEdit(admin: any) { setEditTarget(admin); reset(admin); setModalOpen(true) }

  async function onSubmit(data: AdminForm) {
    setSaving(true)
    try {
      const phone = normalizePhone(data.phone)
      if (editTarget) {
        await updateAdmin(editTarget.id, {
          name: data.name,
          phone,
          working_hours: data.working_hours,
        })
        toast.success('Admin updated')
      } else {
        // Create Firestore doc only — UID will be linked on first phone login
        await createAdmin({
          uid: `pending_${Date.now()}`,
          name: data.name,
          phone,
          working_hours: data.working_hours,
          created_by: userProfile?.uid ?? '',
        })
        toast.success('Admin added — they can log in with their phone number')
      }
      setModalOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(admin: any) {
    if (!confirm(`Delete ${admin.name}?`)) return
    await softDeleteAdmin(admin.id)
    toast.success('Admin deleted')
    load()
  }

  async function handleToggleActive(admin: any) {
    await updateAdmin(admin.id, { is_active: !admin.is_active })
    toast.success(admin.is_active ? 'Account disabled' : 'Account enabled')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Admins"
        subtitle="Add, edit, and disable admin accounts"
        action={
          <button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>
            + Add Admin
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : admins.length === 0 ? (
        <EmptyState icon="👩‍💼" title="No admins yet" description="Add your first admin to get started" action={<button onClick={openCreate} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ Add Admin</button>} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full" dir="rtl">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['الاسم', 'التليفون', 'ساعات العمل', 'الحالة', ''].map(h => (
                  <th key={h} className="text-right text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors" style={{ borderColor: '#F2C4CE30' }}>
                  <td className="px-4 py-3 text-sm font-medium text-right">{admin.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right" dir="ltr">{admin.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{admin.working_hours || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${admin.is_active ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                      {admin.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-start">
                      <button onClick={() => openEdit(admin)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>تعديل</button>
                      <button onClick={() => handleToggleActive(admin)} className={`text-xs px-3 py-1.5 rounded-lg border ${admin.is_active ? 'text-orange-600 border-orange-200' : 'text-green-600 border-green-200'}`}>
                        {admin.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button onClick={() => handleDeactivate(admin)} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-200">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Admin' : 'Add New Admin'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input {...register('name', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.name ? '#ef4444' : '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone Number</label>
            <input {...register('phone', { required: true })} dir="ltr" placeholder="01xxxxxxxxx" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.phone ? '#ef4444' : '#F2C4CE' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Working Hours</label>
            <input {...register('working_hours')} placeholder="9 AM - 5 PM" className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: '#F2C4CE' }} />
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            💡 Admin logs in via phone number OTP — no password needed
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: '#8B3A52' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border font-medium" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
