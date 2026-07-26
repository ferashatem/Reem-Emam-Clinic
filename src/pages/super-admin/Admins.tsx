import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getAdmins, createAdmin, updateAdmin, softDeleteAdmin } from '../../services/firestore'
import { createTeamMemberAuth } from '../../services/auth'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Button } from '../../components/ui/Form'
import { normalizePhone } from '../../utils/validators'
import { C } from '../../theme'
import type { Role, TeamMember } from '../../types'

interface MemberForm {
  name: string
  email: string
  password: string
  phone: string
  working_hours: string
  role: Role
}

const roles: { value: Role; label: string; description: string; color: string }[] = [
  {
    value: 'super_admin',
    label: 'مدير عام',
    description: 'كل حاجة — بما فيها الخدمات وحسابات الفريق وإعدادات العيادة',
    color: '#7C3AED',
  },
  {
    value: 'admin',
    label: 'دكتورة / شريكة',
    description: 'الرئيسية، الحجوزات، الدفع، ملفات المرضى، الحسابات والجرد، تقارير الجلسات',
    color: '#8B3A52',
  },
  {
    value: 'staff',
    label: 'أسيستانت',
    description: 'شاشتين بس — الحجوزات والدفع. مش هيشوف الحسابات ولا المصاريف ولا ملفات المرضى',
    color: '#2563EB',
  },
]

const roleOf = (value?: string) => roles.find(r => r.value === value) ?? roles[1]

export default function Admins() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()
  const { data, loading, error, reload } = useLoader(() => getAdmins(), [])
  const team = data ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<MemberForm>()

  // Describes the role currently picked in the form — not the one being edited
  const selectedRole = roleOf(watch('role'))

  /** Locking yourself out is the one mistake this page must not allow. */
  const isSelf = (m: TeamMember) => m.uid === userProfile?.uid || m.id === userProfile?.uid

  function openCreate() {
    setEditTarget(null)
    reset({ name: '', email: '', password: '', phone: '', working_hours: '', role: 'admin' })
    setModalOpen(true)
  }

  function openEdit(m: TeamMember) {
    setEditTarget(m)
    reset({
      name: m.name ?? '',
      email: m.email ?? '',
      password: '',
      phone: m.phone ?? '',
      working_hours: m.working_hours ?? '',
      role: m.role ?? 'admin',
    })
    setModalOpen(true)
  }

  /** Older accounts were created with a bare username; newer ones use a real email. */
  const loginIdOf = (m: TeamMember) => m.email || m.username || '—'

  async function onSubmit(values: MemberForm) {
    setSaving(true)
    try {
      const phone = values.phone ? normalizePhone(values.phone) : ''

      if (editTarget) {
        // Email & password are fixed at creation — they belong to the auth account
        await updateAdmin(editTarget.id, {
          name: values.name.trim(),
          phone,
          working_hours: values.working_hours?.trim() ?? '',
          role: values.role,
        })
        toast.success('تم حفظ التعديل')
      } else {
        const email = values.email.trim().toLowerCase()
        // 1) Firebase Auth account (email + password)
        const uid = await createTeamMemberAuth(email, values.password)
        // 2) Firestore profile keyed by the real UID — this is what grants the role
        await createAdmin({
          uid,
          email,
          name: values.name.trim(),
          phone,
          working_hours: values.working_hours?.trim() ?? '',
          role: values.role,
          created_by: userProfile?.uid ?? '',
        })
        toast.success('تم إنشاء الحساب ✅ يقدر يدخل بالإيميل والباسورد')
      }

      setModalOpen(false)
      reload()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/email-already-in-use') toast.error('الإيميل ده متسجّل قبل كده — استخدمي إيميل تاني')
      else if (code === 'auth/weak-password') toast.error('الباسورد لازم 6 حروف/أرقام على الأقل')
      else if (code === 'auth/invalid-email') toast.error('الإيميل مش صحيح')
      else if (code === 'auth/operation-not-allowed') {
        toast.error('فعّلي Email/Password من إعدادات Firebase Authentication', { duration: 6000 })
      } else toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(m: TeamMember) {
    if (isSelf(m)) {
      toast.error('مينفعش تعطّلي حسابك انتي')
      return
    }
    setBusyId(m.id)
    try {
      await updateAdmin(m.id, { is_active: !m.is_active })
      toast.success(m.is_active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(m: TeamMember) {
    if (isSelf(m)) {
      toast.error('مينفعش تمسحي حسابك انتي')
      return
    }
    const ok = await confirm({
      title: 'مسح الحساب',
      message: `هتمسحي حساب ${m.name}؟ مش هيقدر يدخل تاني، بس شغله المسجّل هيفضل زي ما هو.`,
      confirmLabel: 'مسح',
      danger: true,
    })
    if (!ok) return
    setBusyId(m.id)
    try {
      await softDeleteAdmin(m.id)
      toast.success('تم المسح')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setBusyId(null)
    }
  }

  const addButton = <Button className="w-full sm:w-auto" onClick={openCreate}>+ إضافة حساب</Button>

  return (
    <div>
      <PageHeader title="الفريق" subtitle={`${team.length} حساب`} action={addButton} />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : team.length === 0 ? (
        <EmptyState icon="👩‍💼" title="مفيش حسابات لسه" description="ضيفي أول حساب للفريق" action={addButton} />
      ) : (
        <div className="space-y-3">
          {team.map(m => {
            const role = roleOf(m.role)
            const self = isSelf(m)
            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl p-4 border shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ borderColor: C.primarySoft }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ backgroundColor: `${role.color}18`, color: role.color }}
                >
                  {(m.name ?? '؟').trim().charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm" style={{ color: C.text }}>{m.name}</p>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${role.color}15`, color: role.color }}
                    >
                      {role.label}
                    </span>
                    {self && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">انتي</span>
                    )}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        m.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.is_active ? 'نشط' : 'معطّل'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1" dir="ltr">
                    {loginIdOf(m)}
                    {m.phone ? ` · ${m.phone}` : ''}
                    {m.working_hours ? ` · ${m.working_hours}` : ''}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)} disabled={busyId === m.id}>
                    تعديل
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleToggleActive(m)}
                    disabled={busyId === m.id || self}
                    style={m.is_active
                      ? { borderColor: '#FED7AA', color: '#C2410C' }
                      : { borderColor: '#BBF7D0', color: '#15803D' }}
                  >
                    {m.is_active ? 'تعطيل' : 'تفعيل'}
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleDelete(m)}
                    disabled={busyId === m.id || self}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'تعديل حساب' : 'إضافة حساب جديد'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="الصلاحية" required>
            <Select {...register('role', { required: true })}>
              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <div
              className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
              style={{ backgroundColor: `${selectedRole.color}12`, color: selectedRole.color }}
            >
              <strong>{selectedRole.label}</strong> هيشوف: {selectedRole.description}
            </div>
          </Field>

          <Field label="الاسم" required error={errors.name && 'اكتبي الاسم'}>
            <Input {...register('name', { required: true })} invalid={!!errors.name} placeholder="مثال: د. ريم" />
          </Field>

          {editTarget ? (
            <Field label="الإيميل" hint="الإيميل والباسورد مش بيتغيّروا بعد الإنشاء">
              <Input value={loginIdOf(editTarget)} disabled dir="ltr" />
            </Field>
          ) : (
            <>
              <Field
                label="الإيميل"
                required
                error={errors.email && 'اكتبي إيميل صحيح'}
                hint="ده اللي هيدخل بيه من صفحة تسجيل الدخول"
              >
                <Input
                  {...register('email', {
                    required: true,
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  })}
                  invalid={!!errors.email}
                  type="email"
                  dir="ltr"
                  placeholder="reem@example.com"
                  autoComplete="off"
                />
              </Field>
              <Field label="الباسورد" required error={errors.password && 'الباسورد لازم 6 حروف/أرقام على الأقل'}>
                <Input
                  {...register('password', { required: true, minLength: 6 })}
                  invalid={!!errors.password}
                  type="text"
                  dir="ltr"
                  placeholder="6 حروف/أرقام على الأقل"
                  autoComplete="new-password"
                />
              </Field>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="رقم التليفون">
              <Input {...register('phone')} dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" />
            </Field>
            <Field label="ساعات العمل">
              <Input {...register('working_hours')} placeholder="9 ص - 5 م" />
            </Field>
          </div>

          {!editTarget && (
            <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: C.bg, color: C.primary }}>
              💡 الباسورد بيتكتب مرة واحدة بس — احفظيه وابعتيه لصاحب الحساب، مش هتقدري تشوفيه تاني.
            </div>
          )}

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
