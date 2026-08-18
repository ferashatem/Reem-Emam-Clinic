import { useMemo, useState } from 'react'
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
import { ErrorState } from '../../components/ui/Feedback'
import DataTable, { type Column } from '../../components/ui/DataTable'
import RowMenu, { type RowAction } from '../../components/ui/RowMenu'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import EditRounded from '@mui/icons-material/EditRounded'
import BlockRounded from '@mui/icons-material/BlockRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
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

  const columns = useMemo<Column<TeamMember>[]>(() => [
    {
      id: 'name',
      label: 'الاسم',
      sortValue: m => m.name ?? '',
      render: m => {
        const role = roleOf(m.role)
        return (
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: `${role.color}18`, color: role.color, fontWeight: 700, fontSize: '0.9rem' }}>
              {(m.name ?? '؟').trim().charAt(0)}
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: C.text }}>
                {m.name}
                {isSelf(m) && <span className="text-xs text-gray-400 me-2">(انتي)</span>}
              </p>
              <p className="text-xs text-gray-400" dir="ltr">{loginIdOf(m)}</p>
            </div>
          </Stack>
        )
      },
    },
    {
      id: 'role',
      label: 'الصلاحية',
      sortValue: m => roleOf(m.role).label,
      width: 150,
      render: m => {
        const role = roleOf(m.role)
        return (
          <Chip
            size="small"
            label={role.label}
            sx={{ bgcolor: `${role.color}15`, color: role.color }}
          />
        )
      },
    },
    {
      id: 'contact',
      label: 'التليفون',
      hideBelow: 'md',
      width: 150,
      render: m => <span className="text-gray-500 text-xs" dir="ltr">{m.phone || '—'}</span>,
    },
    {
      id: 'hours',
      label: 'مواعيد العمل',
      hideBelow: 'lg',
      render: m => <span className="text-gray-500 text-xs">{m.working_hours || '—'}</span>,
    },
    {
      id: 'state',
      label: 'الحالة',
      sortValue: m => (m.is_active ? 0 : 1),
      width: 110,
      render: m => (
        <Chip
          size="small"
          variant="outlined"
          color={m.is_active ? 'success' : 'default'}
          label={m.is_active ? 'نشط' : 'معطّل'}
        />
      ),
    },
    {
      id: 'actions',
      label: '',
      align: 'left',
      width: 60,
      render: m => {
        const self = isSelf(m)
        const actions: RowAction[] = [
          { label: 'تعديل', icon: <EditRounded fontSize="small" />, onClick: () => openEdit(m) },
          {
            label: m.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب',
            icon: m.is_active
              ? <BlockRounded fontSize="small" />
              : <CheckCircleOutlineRounded fontSize="small" />,
            onClick: () => handleToggleActive(m),
            // Locking yourself out is the one mistake nobody can undo from here
            disabled: self,
          },
          {
            label: 'مسح الحساب',
            icon: <DeleteOutlineRounded fontSize="small" />,
            onClick: () => handleDelete(m),
            disabled: self,
            danger: true,
          },
        ]
        return <RowMenu actions={actions} disabled={busyId === m.id} />
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId, userProfile])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <PageHeader title="الفريق" subtitle={`${team.length} حساب`} action={addButton} />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="flex-1 min-h-0">
        <DataTable
          fill
          columns={columns}
          rows={team}
          getRowId={m => m.id}
          loading={loading}
          paginated={false}
          rowSx={m => (m.is_active ? undefined : { opacity: 0.62 })}
          empty={
            <EmptyState
              icon="👩‍💼"
              title="مفيش حسابات لسه"
              description="ضيفي أول حساب للفريق"
              action={addButton}
            />
          }
        />
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
