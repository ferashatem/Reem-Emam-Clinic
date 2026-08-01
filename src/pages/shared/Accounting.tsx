import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  getPayments, getExpenses, getReservations, getMonthlyClosings,
  createExpense, updateExpense, softDeleteExpense, saveMonthlyClosing,
  getClinicSettings, monthOf,
} from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import { useLoader, messageFor } from '../../hooks/useLoader'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import Tabs from '../../components/ui/Tabs'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea, Button } from '../../components/ui/Form'
import {
  formatDateShort, formatMoney, formatMonthAr, monthKey, recentMonths, toNumber, todayISO,
} from '../../utils/formatters'
import { C } from '../../theme'
import type { Expense, ExpenseCategory, MonthlyClosing } from '../../types'

const DEFAULT_PARTNERS = ['ريم', 'رانيا']

const categories: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'electricity', label: 'كهربا', icon: '💡' },
  { value: 'water', label: 'مياه', icon: '💧' },
  { value: 'rent', label: 'إيجار', icon: '🏠' },
  { value: 'salaries', label: 'مرتبات', icon: '👥' },
  { value: 'supplies', label: 'مستلزمات وخامات', icon: '🧴' },
  { value: 'maintenance', label: 'صيانة', icon: '🔧' },
  { value: 'marketing', label: 'دعاية وتسويق', icon: '📣' },
  { value: 'other', label: 'أخرى', icon: '📌' },
]

const categoryOf = (value?: string) => categories.find(c => c.value === value) ?? categories[7]

/** Bills that land every single month — worth showing on their own so the fixed nut is visible. */
const RECURRING: ExpenseCategory[] = ['rent', 'salaries', 'electricity', 'water']

const methodLabels: Record<string, string> = {
  cash: 'كاش', instapay: 'إنستا باي', wallet: 'محفظة', card: 'فيزا',
}

interface ExpenseForm {
  title: string
  category: ExpenseCategory
  amount: string
  date: string
  note: string
}

export default function Accounting() {
  const { userProfile } = useAuth()
  const { confirm, dialog } = useConfirm()

  const [month, setMonth] = useState(monthKey())
  const [tab, setTab] = useState<'overview' | 'expenses' | 'closings'>('overview')

  const { data, loading, error, reload } = useLoader(async () => {
    const [payments, expenses, reservations, closings, settings] = await Promise.all([
      getPayments(), getExpenses(), getReservations(), getMonthlyClosings(), getClinicSettings(),
    ])
    const partners = Array.isArray(settings?.partners) && settings.partners.length > 0
      ? (settings.partners as string[])
      : DEFAULT_PARTNERS
    return { payments, expenses, reservations, closings, partners }
  }, [])

  const partners = data?.partners ?? DEFAULT_PARTNERS

  // ─── The month's numbers ──────────────────────────────────────────────────
  const book = useMemo(() => {
    const payments = (data?.payments ?? []).filter(p => monthOf(p) === month)
    const expenses = (data?.expenses ?? []).filter(e => monthOf(e) === month)
    const sessions = (data?.reservations ?? []).filter(
      r => (r.date ?? '').startsWith(month) && r.status !== 'cancelled'
    )

    const revenue = payments.reduce((s, p) => s + toNumber(p.amount), 0)
    const totalExpenses = expenses.reduce((s, e) => s + toNumber(e.amount), 0)
    const netProfit = revenue - totalExpenses
    const billed = sessions.reduce((s, r) => s + toNumber(r.price_at_booking), 0)

    const byCategory = categories
      .map(c => ({
        ...c,
        total: expenses.filter(e => e.category === c.value).reduce((s, e) => s + toNumber(e.amount), 0),
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)

    const byMethod = Object.entries(
      payments.reduce<Record<string, number>>((acc, p) => {
        const key = p.method ?? 'cash'
        acc[key] = (acc[key] ?? 0) + toNumber(p.amount)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1])

    // The partners split whatever is left after expenses, equally.
    const share = partners.length > 0 ? netProfit / partners.length : 0

    const biggest = byCategory[0] ?? null
    const recurring = expenses
      .filter(e => RECURRING.includes(e.category as ExpenseCategory))
      .reduce((s, e) => s + toNumber(e.amount), 0)

    return {
      payments, expenses, sessions, revenue, totalExpenses, netProfit,
      billed, outstanding: Math.max(0, billed - revenue),
      byCategory, byMethod, share, biggest, recurring,
    }
  }, [data, month, partners])

  const closing = useMemo(
    () => (data?.closings ?? []).find(c => c.month === month) ?? null,
    [data, month]
  )

  /** Recent months plus any older month that actually has data to look at. */
  const monthOptions = useMemo(() => {
    const months = new Set(recentMonths(18))
    for (const p of data?.payments ?? []) months.add(monthOf(p))
    for (const e of data?.expenses ?? []) months.add(monthOf(e))
    for (const c of data?.closings ?? []) months.add(c.month)
    months.add(month)
    return [...months].filter(Boolean).sort((a, b) => b.localeCompare(a))
  }, [data, month])

  // ─── Expense form ─────────────────────────────────────────────────────────
  const [expenseModal, setExpenseModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseForm>()

  function openExpense(e?: Expense) {
    setEditTarget(e ?? null)
    reset({
      title: e?.title ?? '',
      category: e?.category ?? 'other',
      amount: e ? String(toNumber(e.amount)) : '',
      // New expenses default to today when we're on the current month,
      // otherwise to the 1st of the month being reviewed.
      date: e?.date ?? (month === monthKey() ? todayISO() : `${month}-01`),
      note: e?.note ?? '',
    })
    setExpenseModal(true)
  }

  async function onSubmitExpense(values: ExpenseForm) {
    setSaving(true)
    try {
      const payload = {
        title: values.title.trim(),
        category: values.category,
        amount: toNumber(values.amount),
        date: values.date,
        note: values.note?.trim() ?? '',
      }
      if (editTarget) {
        await updateExpense(editTarget.id, payload)
        toast.success('تم تعديل المصروف')
      } else {
        await createExpense({
          ...payload,
          created_by: userProfile?.uid ?? '',
          created_by_name: userProfile?.name ?? '',
        })
        toast.success('تم إضافة المصروف')
      }
      setExpenseModal(false)
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteExpense(e: Expense) {
    const ok = await confirm({
      title: 'مسح المصروف',
      message: `هتمسحي "${e.title}" بمبلغ ${formatMoney(e.amount)}؟`,
      confirmLabel: 'مسح',
      danger: true,
    })
    if (!ok) return
    try {
      await softDeleteExpense(e.id)
      toast.success('تم المسح')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    }
  }

  // ─── Monthly closing ──────────────────────────────────────────────────────
  const [closingBusy, setClosingBusy] = useState(false)

  async function handleClose() {
    const ok = await confirm({
      title: closing ? 'إعادة الجرد' : 'إقفال الشهر',
      message: closing
        ? `الجرد المحفوظ لشهر ${formatMonthAr(month)} هيتحدّث بالأرقام الحالية.`
        : `هيتسجل جرد لشهر ${formatMonthAr(month)} بصافي ربح ${formatMoney(book.netProfit)}، ونصيب كل شريكة ${formatMoney(book.share)}.`,
      confirmLabel: closing ? 'تحديث الجرد' : 'إقفال الشهر',
    })
    if (!ok) return

    setClosingBusy(true)
    try {
      await saveMonthlyClosing(month, {
        total_revenue: book.revenue,
        total_expenses: book.totalExpenses,
        net_profit: book.netProfit,
        partners: partners.map(name => ({ name, amount: book.share })),
        payments_count: book.payments.length,
        sessions_count: book.sessions.length,
        closed_by: userProfile?.uid ?? '',
        closed_by_name: userProfile?.name ?? '',
      })
      toast.success('تم حفظ الجرد ✅')
      reload()
    } catch (err) {
      toast.error(messageFor(err))
    } finally {
      setClosingBusy(false)
    }
  }

  const profitable = book.netProfit >= 0

  return (
    <div>
      <PageHeader
        title="الحسابات والجرد الشهري"
        subtitle="التحصيلات والمصاريف وصافي الربح بين الشريكتين"
        action={
          <Select
            value={month}
            onChange={e => setMonth(e.target.value)}
            aria-label="اختيار الشهر"
            className="w-full sm:w-48"
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{formatMonthAr(m)}</option>
            ))}
          </Select>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {closing && (
            <div
              className="rounded-2xl px-4 py-3 mb-5 text-sm border"
              style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}
            >
              ✅ الشهر ده متقفل — الجرد اتحفظ بواسطة {closing.closed_by_name || '—'}
              {' '}بصافي ربح {formatMoney(closing.net_profit)}
            </div>
          )}

          <div className="mb-5">
            <Tabs
              tabs={[
                { value: 'overview' as const, label: 'نظرة عامة' },
                { value: 'expenses' as const, label: 'المصاريف', count: book.expenses.length },
                { value: 'closings' as const, label: 'الجرد المحفوظ', count: data?.closings.length ?? 0 },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>

          {/* ─── Overview ─────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  label="إجمالي التحصيلات"
                  value={formatMoney(book.revenue)}
                  icon="💰" color={C.green}
                  hint={`${book.payments.length} عملية دفع`}
                />
                <StatCard
                  label="إجمالي المصاريف"
                  value={formatMoney(book.totalExpenses)}
                  icon="🧾" color={C.red}
                  hint={`${book.expenses.length} مصروف`}
                />
                <StatCard
                  label={profitable ? 'صافي الربح' : 'صافي الخسارة'}
                  value={formatMoney(Math.abs(book.netProfit))}
                  icon={profitable ? '📈' : '📉'}
                  color={profitable ? C.green : C.red}
                />
                <StatCard
                  label="عدد الجلسات"
                  value={book.sessions.length}
                  icon="📅"
                  hint={`فواتير بـ ${formatMoney(book.billed)}`}
                />
              </div>

              {/* Partner split */}
              <section>
                <h2 className="text-sm font-bold mb-3" style={{ color: C.primary }}>
                  توزيع صافي الربح (بالتساوي بين {partners.length} شريكات)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {partners.map(name => (
                    <div
                      key={name}
                      className="bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4"
                      style={{ borderColor: C.primarySoft }}
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                        style={{ backgroundColor: C.primarySoft, color: C.primary }}
                      >
                        {name.trim().charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">نصيب {name}</p>
                        <p className="text-xl font-bold" style={{ color: profitable ? C.green : C.red }}>
                          {profitable ? '' : '−'}{formatMoney(Math.abs(book.share))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Breakdown
                  title="التحصيلات حسب طريقة الدفع"
                  empty="مفيش تحصيلات الشهر ده"
                  total={book.revenue}
                  rows={book.byMethod.map(([method, total]) => ({
                    key: method,
                    label: methodLabels[method] ?? method,
                    total,
                  }))}
                  color={C.green}
                />
                <Breakdown
                  title="المصاريف حسب النوع"
                  empty="مفيش مصاريف مسجلة الشهر ده"
                  total={book.totalExpenses}
                  rows={book.byCategory.map(c => ({
                    key: c.value,
                    label: `${c.icon} ${c.label}`,
                    total: c.total,
                  }))}
                  color={C.red}
                />
              </div>

              {book.outstanding > 0 && (
                <p className="text-sm text-gray-500">
                  ملحوظة: في {formatMoney(book.outstanding)} فواتير جلسات الشهر ده لسه متحصلتش —
                  الأرقام فوق محسوبة على الفلوس اللي دخلت فعلاً.
                </p>
              )}

              <Button onClick={handleClose} loading={closingBusy} className="w-full sm:w-auto">
                {closing ? 'تحديث جرد الشهر' : `إقفال شهر ${formatMonthAr(month)}`}
              </Button>
            </div>
          )}

          {/* ─── Expenses ─────────────────────────────────────────────────── */}
          {tab === 'expenses' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <KpiCard
                  label="إجمالي مصاريف الشهر"
                  value={formatMoney(book.totalExpenses)}
                  hint={`${book.expenses.length} بند`}
                  color={C.red}
                />
                <KpiCard
                  label="أكبر بند"
                  value={book.biggest ? `${book.biggest.icon} ${book.biggest.label}` : '—'}
                  hint={book.biggest ? formatMoney(book.biggest.total) : 'مفيش مصاريف'}
                />
                <KpiCard
                  label="مصاريف متكررة شهريًا"
                  value={formatMoney(book.recurring)}
                  hint="إيجار + مرتبات + كهربا ومياه"
                  color={C.gold}
                />
              </div>

              <Panel
                title={`مصاريف ${formatMonthAr(month)}`}
                action={<Button size="sm" onClick={() => openExpense()}>+ إضافة مصروف</Button>}
              >
                {book.expenses.length === 0 ? (
                  <EmptyState
                    icon="🧾"
                    title="مفيش مصاريف مسجلة الشهر ده"
                    description="سجّلي الكهربا والمياه والإيجار وأي مصروف عشان الجرد يطلع صح"
                    action={<Button onClick={() => openExpense()}>+ إضافة مصروف</Button>}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-140">
                      <thead>
                        <tr className="text-xs text-gray-400">
                          <Th>البند</Th>
                          <Th>النوع</Th>
                          <Th>التاريخ</Th>
                          <Th align="end">المبلغ</Th>
                          <Th align="end"> </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {book.expenses.map(e => {
                          const cat = categoryOf(e.category)
                          return (
                            <tr key={e.id} className="border-t" style={{ borderColor: C.bg }}>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                                    style={{ backgroundColor: C.bg }}
                                  >
                                    {cat.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate">{e.title}</p>
                                    {e.note && <p className="text-xs text-gray-400 truncate">{e.note}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
                                  style={{ backgroundColor: C.bg, color: C.primary }}
                                >
                                  {cat.label}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                                {formatDateShort(e.date)}
                                {e.created_by_name && (
                                  <span className="block text-[11px] text-gray-400">{e.created_by_name}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-end font-bold whitespace-nowrap" style={{ color: C.red }}>
                                {formatMoney(e.amount)}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex gap-1.5 justify-end">
                                  <Button size="sm" variant="outline" onClick={() => openExpense(e)}>تعديل</Button>
                                  <Button
                                    size="sm" variant="outline"
                                    onClick={() => handleDeleteExpense(e)}
                                    style={{ borderColor: '#FECACA', color: C.red }}
                                  >
                                    مسح
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* ─── Saved closings ───────────────────────────────────────────── */}
          {tab === 'closings' && <ClosingsList closings={data?.closings ?? []} onPick={setMonth} />}
        </>
      )}

      <Modal
        open={expenseModal}
        onClose={() => setExpenseModal(false)}
        title={editTarget ? 'تعديل مصروف' : 'إضافة مصروف'}
      >
        <form onSubmit={handleSubmit(onSubmitExpense)} className="space-y-4">
          <Field label="المصروف إيه؟" required error={errors.title?.message}>
            <Input
              {...register('title', { required: 'اكتبي اسم المصروف' })}
              invalid={!!errors.title}
              placeholder="مثال: فاتورة كهربا شهر يوليو"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="النوع" required>
              <Select {...register('category', { required: true })}>
                {categories.map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="المبلغ (جنيه)" required error={errors.amount?.message}>
              <Input
                {...register('amount', {
                  required: 'اكتبي المبلغ',
                  validate: v => toNumber(v) > 0 || 'المبلغ لازم يكون أكبر من صفر',
                })}
                invalid={!!errors.amount}
                type="number" inputMode="numeric" min={1} dir="ltr"
                className="font-semibold"
              />
            </Field>
          </div>
          <Field label="التاريخ" required error={errors.date?.message}>
            <Input {...register('date', { required: 'اختاري التاريخ' })} invalid={!!errors.date} type="date" />
          </Field>
          <Field label="ملاحظة">
            <Textarea {...register('note')} rows={2} placeholder="اختياري" />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">حفظ</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setExpenseModal(false)}>رجوع</Button>
          </div>
        </form>
      </Modal>

      {dialog}
    </div>
  )
}

function Breakdown({
  title, rows, total, empty, color,
}: {
  title: string
  rows: { key: string; label: string; total: number }[]
  total: number
  empty: string
  color: string
}) {
  return (
    <section className="bg-white rounded-2xl p-5 border shadow-sm" style={{ borderColor: C.primarySoft }}>
      <h3 className="text-sm font-bold mb-4" style={{ color: C.primary }}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const pct = total > 0 ? Math.round((row.total / total) * 100) : 0
            return (
              <div key={row.key}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold" style={{ color }}>{formatMoney(row.total)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.bg }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ClosingsList({ closings, onPick }: { closings: MonthlyClosing[]; onPick: (month: string) => void }) {
  // Oldest first reads like a timeline; the bars share one scale so months compare.
  const months = [...closings].sort((a, b) => a.month.localeCompare(b.month))
  const scale = Math.max(1, ...months.map(c => Math.max(toNumber(c.total_revenue), toNumber(c.total_expenses))))

  const totals = months.reduce(
    (s, c) => ({
      revenue: s.revenue + toNumber(c.total_revenue),
      expenses: s.expenses + toNumber(c.total_expenses),
      net: s.net + toNumber(c.net_profit),
      sessions: s.sessions + toNumber(c.sessions_count),
    }),
    { revenue: 0, expenses: 0, net: 0, sessions: 0 }
  )

  if (closings.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="مفيش جرد محفوظ لسه"
        description="من تبويب «نظرة عامة» اضغطي «إقفال الشهر» عشان تحفظي أرقام الشهر"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="شهور متقفلة" value={String(months.length)} hint={`${totals.sessions} جلسة`} />
        <KpiCard label="إجمالي التحصيلات" value={formatMoney(totals.revenue)} color={C.green} />
        <KpiCard label="إجمالي المصاريف" value={formatMoney(totals.expenses)} color={C.red} />
        <KpiCard
          label={totals.net >= 0 ? 'إجمالي صافي الربح' : 'إجمالي الخسارة'}
          value={formatMoney(Math.abs(totals.net))}
          color={totals.net >= 0 ? C.green : C.red}
        />
      </div>

      <Panel
        title="أداء الشهور — تحصيلات مقابل مصاريف"
        action={
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <i className="w-3 h-3 rounded-full" style={{ backgroundColor: C.green }} /> تحصيلات
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-3 h-3 rounded-full" style={{ backgroundColor: C.primarySoft }} /> مصاريف
            </span>
          </div>
        }
      >
        <div className="space-y-3 px-3 py-1">
          {months.map(c => (
            <div key={c.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-xs text-gray-500 truncate">{formatMonthAr(c.month)}</span>
              <div className="space-y-1">
                <Bar value={toNumber(c.total_revenue)} scale={scale} color={C.green} />
                <Bar value={toNumber(c.total_expenses)} scale={scale} color={C.primarySoft} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="أرشيف الشهور"
        action={<span className="text-xs text-gray-400">اضغطي على الشهر لتفاصيله</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-160">
            <thead>
              <tr className="text-xs text-gray-400">
                <Th>الشهر</Th>
                <Th align="end">جلسات</Th>
                <Th align="end">تحصيلات</Th>
                <Th align="end">مصاريف</Th>
                <Th align="end">صافي</Th>
                <Th align="end">نصيب كل شريكة</Th>
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map(c => {
                const net = toNumber(c.net_profit)
                const profitable = net >= 0
                return (
                  <tr
                    key={c.id}
                    onClick={() => onPick(c.month)}
                    className="border-t cursor-pointer hover:bg-black/2"
                    style={{ borderColor: C.bg }}
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold whitespace-nowrap" style={{ color: C.primary }}>
                        {formatMonthAr(c.month)}
                      </p>
                      <p className="text-[11px] text-gray-400">{c.payments_count ?? 0} عملية دفع</p>
                    </td>
                    <td className="px-3 py-3 text-end text-gray-600">{c.sessions_count ?? 0}</td>
                    <td className="px-3 py-3 text-end whitespace-nowrap" style={{ color: C.green }}>
                      {formatMoney(c.total_revenue)}
                    </td>
                    <td className="px-3 py-3 text-end text-gray-500 whitespace-nowrap">
                      {formatMoney(c.total_expenses)}
                    </td>
                    <td
                      className="px-3 py-3 text-end font-bold whitespace-nowrap"
                      style={{ color: profitable ? C.green : C.red }}
                    >
                      {profitable ? '' : '−'}{formatMoney(Math.abs(net))}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {c.partners?.length > 0
                          ? c.partners.map(p => (
                              <span
                                key={p.name}
                                className="text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap"
                                style={{ backgroundColor: C.bg, color: C.primary }}
                              >
                                {p.name}: {formatMoney(p.amount)}
                              </span>
                            ))
                          : <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function Bar({ value, scale, color }: { value: number; scale: number; color: string }) {
  return (
    <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: C.bg }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, (value / scale) * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

/** A titled white card with an optional action in its header — the page's one container shape. */
function Panel({ title, action, children }: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: C.primarySoft }}>
      <div
        className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b"
        style={{ borderColor: C.bg }}
      >
        <h3 className="text-sm font-bold" style={{ color: C.primary }}>{title}</h3>
        <div className="ms-auto">{action}</div>
      </div>
      <div className="p-2 sm:p-3">{children}</div>
    </section>
  )
}

function KpiCard({ label, value, hint, color = C.primary }: {
  label: string
  value: string
  hint?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border shadow-sm" style={{ borderColor: C.primarySoft }}>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className="text-xl sm:text-2xl font-bold wrap-break-word" style={{ color }}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Th({ children, align = 'start' }: { children: ReactNode; align?: 'start' | 'end' }) {
  return (
    <th className={`px-3 pb-2 pt-1 font-medium ${align === 'end' ? 'text-end' : 'text-start'}`}>
      {children}
    </th>
  )
}
