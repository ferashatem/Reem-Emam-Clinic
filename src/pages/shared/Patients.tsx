import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClients, getPayments, getReservations } from '../../services/firestore'
import { useLoader } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { LoadingBlock, ErrorState } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Form'
import { formatDateShort, formatMoney, toNumber } from '../../utils/formatters'
import { C } from '../../theme'

export default function Patients() {
  const base = useBasePath()
  const [search, setSearch] = useState('')

  const { data, loading, error, reload } = useLoader(async () => {
    const [clients, reservations, payments] = await Promise.all([
      getClients(), getReservations(), getPayments(),
    ])
    return { clients, reservations, payments }
  }, [])

  /** One row per patient with the numbers the doctors ask about first. */
  const rows = useMemo(() => {
    if (!data) return []
    const visitsBy = new Map<string, { visits: number; last: string; billed: number }>()
    for (const r of data.reservations) {
      if (r.status === 'cancelled') continue
      const entry = visitsBy.get(r.client_id) ?? { visits: 0, last: '', billed: 0 }
      entry.visits += 1
      entry.billed += toNumber(r.price_at_booking)
      if (r.date > entry.last) entry.last = r.date
      visitsBy.set(r.client_id, entry)
    }

    const paidBy = new Map<string, number>()
    for (const p of data.payments) {
      paidBy.set(p.client_id, (paidBy.get(p.client_id) ?? 0) + toNumber(p.amount))
    }

    return data.clients
      .map(c => {
        const stats = visitsBy.get(c.id) ?? { visits: 0, last: '', billed: 0 }
        const paid = paidBy.get(c.id) ?? 0
        return { ...c, visits: stats.visits, last: stats.last, paid, due: Math.max(0, stats.billed - paid) }
      })
      .sort((a, b) => (b.last || '').localeCompare(a.last || ''))
  }, [data])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.name ?? '').toLowerCase().includes(q) || (r.phone ?? '').includes(q)
    )
  }, [rows, search])

  return (
    <div>
      <PageHeader title="المرضى" subtitle={`${rows.length} ملف مريض`} />

      <div className="mb-5">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحثي بالاسم أو رقم التليفون..."
          aria-label="بحث عن مريضة"
        />
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={search ? '🔍' : '👤'}
          title={search ? 'مفيش نتائج' : 'مفيش مرضى مسجلين'}
          description={search ? 'جربي اسم أو رقم تاني' : 'المرضى بيتسجلوا من الموقع أو من الأسيستانت'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {visible.map(c => (
            <Link
              key={c.id}
              to={`${base}/patients/${c.id}`}
              className="bg-white rounded-2xl p-4 border shadow-sm hover:shadow-md transition-shadow block"
              style={{ borderColor: C.primarySoft }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ backgroundColor: C.primarySoft, color: C.primary }}
                >
                  {(c.name ?? '؟').trim().charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: C.text }}>{c.name}</p>
                  <p className="text-xs text-gray-400 truncate" dir="ltr">{c.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="زيارة" value={String(c.visits)} />
                <Metric label="مدفوع" value={formatMoney(c.paid)} color={C.green} />
                <Metric label="مستحق" value={formatMoney(c.due)} color={c.due > 0 ? C.amber : undefined} />
              </div>

              <p className="text-xs text-gray-400 mt-3">
                آخر زيارة: {c.last ? formatDateShort(c.last) : 'لسه مجتش'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl py-2" style={{ backgroundColor: C.bg }}>
      <p className="text-sm font-bold wrap-break-word" style={{ color: color ?? C.primary }}>{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  )
}
