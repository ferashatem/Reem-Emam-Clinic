import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getClients, getPayments, getReservations } from '../../services/firestore'
import { useLoader } from '../../hooks/useLoader'
import { useBasePath } from '../../hooks/useBasePath'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/Feedback'
import DataTable, { type Column } from '../../components/ui/DataTable'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchRounded from '@mui/icons-material/SearchRounded'
import { daysAgo, formatDateShort, formatMoney, toNumber } from '../../utils/formatters'
import { C } from '../../theme'

/** How far back the per-patient numbers on this screen are counted. */
const STATS_WINDOW_DAYS = 365

/** A patient row: the file plus the numbers the doctors ask about first. */
type PatientRow = {
  id: string
  name?: string
  phone?: string
  visits: number
  last: string
  paid: number
  due: number
}

export default function Patients() {
  const base = useBasePath()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  /**
   * A year's worth of visits, not the whole archive — what the desk reads off
   * this screen is "how often does she come and does she owe us anything",
   * both of which are answered by the last year. Her full history is on her own
   * file, which is fetched by client id and costs the same however old the
   * clinic gets.
   */
  const { data, loading, error, reload } = useLoader(async () => {
    const from = daysAgo(STATS_WINDOW_DAYS)
    const [clients, reservations, payments] = await Promise.all([
      getClients(), getReservations({ from }), getPayments({ from }),
    ])
    return { clients, reservations, payments }
  }, [])

  /** One row per patient with the numbers the doctors ask about first. */
  const rows = useMemo(() => {
    if (!data) return []
    const visitsBy = new Map<string, { visits: number; last: string; billed: number }>()
    for (const r of data.reservations) {
      // Unconfirmed website requests have no patient file yet
      if (!r.client_id || r.status === 'cancelled') continue
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

  const columns = useMemo<Column<PatientRow>[]>(() => [
    {
      id: 'name',
      label: 'المريضة',
      sortValue: c => c.name ?? '',
      render: c => (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: C.primarySoft, color: C.primary, fontWeight: 700, fontSize: '0.9rem' }}>
            {(c.name ?? '؟').trim().charAt(0)}
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: C.text }}>{c.name}</p>
            <p className="text-xs text-gray-400" dir="ltr">{c.phone}</p>
          </div>
        </Stack>
      ),
    },
    {
      id: 'visits',
      label: 'زيارات السنة',
      sortValue: c => c.visits,
      width: 110,
      render: c => <span className="font-semibold">{c.visits}</span>,
    },
    {
      id: 'last',
      label: 'آخر زيارة',
      sortValue: c => c.last || '',
      width: 140,
      hideBelow: 'sm',
      render: c => (
        <span className={c.last ? 'text-gray-600' : 'text-gray-400 text-xs'}>
          {c.last ? formatDateShort(c.last) : 'لسه مجتش'}
        </span>
      ),
    },
    {
      id: 'paid',
      label: 'المدفوع',
      sortValue: c => c.paid,
      width: 130,
      hideBelow: 'md',
      render: c => <span style={{ color: C.green, fontWeight: 600 }}>{formatMoney(c.paid)}</span>,
    },
    {
      id: 'due',
      label: 'المستحق',
      sortValue: c => c.due,
      width: 140,
      render: c => (c.due > 0
        ? <Chip size="small" color="warning" variant="outlined" label={formatMoney(c.due)} />
        : <span className="text-gray-400 text-xs">—</span>),
    },
    {
      id: 'open',
      label: '',
      align: 'left',
      width: 90,
      render: c => (
        <Link
          to={`${base}/patients/${c.id}`}
          className="text-xs font-semibold"
          style={{ color: C.primary }}
          onClick={e => e.stopPropagation()}
        >
          فتح الملف ←
        </Link>
      ),
    },
  ], [base])

  const tableHeader = (
    <Box
      sx={{
        px: 2, py: 1.5, display: 'flex', gap: 1.5, alignItems: 'center',
        flexWrap: 'wrap', borderBottom: `1px solid ${C.primarySoft}`,
      }}
    >
      <TextField
        size="small"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="بحث بالاسم أو التليفون"
        sx={{ flex: '1 1 260px', maxWidth: 380 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" sx={{ color: C.primary, opacity: 0.6 }} />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ marginInlineStart: 'auto', fontSize: '0.8rem', color: 'text.secondary' }}>
        {visible.length} من {rows.length}
      </Box>
    </Box>
  )

  return (
    <div className="h-full min-h-0 flex flex-col">
      <PageHeader title="المرضى" subtitle={`${rows.length} ملف مريض`} />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="flex-1 min-h-0">
        <DataTable
          fill
          header={tableHeader}
          columns={columns}
          rows={visible}
          getRowId={c => c.id}
          loading={loading}
          onRowClick={c => navigate(`${base}/patients/${c.id}`)}
          empty={
            <EmptyState
              icon={search ? '🔍' : '👤'}
              title={search ? 'مفيش نتائج' : 'مفيش مرضى مسجلين'}
              description={search ? 'جربي اسم أو رقم تاني' : 'المرضى بيتسجلوا من الموقع أو من الأسيستانت'}
            />
          }
        />
        </div>
      )}
    </div>
  )
}
