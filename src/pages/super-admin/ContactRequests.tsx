import { useEffect, useMemo, useState } from 'react'
import { getDocs, collection, orderBy, query } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import DataTable, { type Column } from '../../components/ui/DataTable'
import MuiButton from '@mui/material/Button'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import { formatDateAr } from '../../utils/formatters'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import { C } from '../../theme'

/** A «كلمني» request off the landing page — name, phone, and what she asked for. */
interface ContactRequest {
  id: string
  name?: string
  phone?: string
  service?: string
  date?: string
  created_at?: Timestamp
}

/** 'YYYY-MM-DD' out of a Firestore stamp, for the "sent at" column. */
function sentOn(r: ContactRequest): string {
  const d = r.created_at?.toDate?.()
  return d ? d.toISOString().slice(0, 10) : ''
}

export default function ContactRequests() {
  const [requests, setRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'contact_requests'), orderBy('created_at', 'desc')))
      .then(snap => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ContactRequest))
      })
      .finally(() => setLoading(false))
  }, [])

  const columns = useMemo<Column<ContactRequest>[]>(() => [
    {
      id: 'name',
      label: 'الاسم',
      sortValue: r => r.name ?? '',
      render: r => <span className="font-semibold" style={{ color: C.text }}>{r.name || '—'}</span>,
    },
    {
      id: 'phone',
      label: 'التليفون',
      sortValue: r => r.phone ?? '',
      width: 150,
      render: r => <span className="text-gray-500" dir="ltr">{r.phone || '—'}</span>,
    },
    {
      id: 'service',
      label: 'الخدمة',
      sortValue: r => r.service ?? '',
      hideBelow: 'sm',
      render: r => <span className="text-gray-600">{r.service || '—'}</span>,
    },
    {
      id: 'date',
      label: 'التاريخ المطلوب',
      sortValue: r => r.date ?? '',
      hideBelow: 'md',
      width: 150,
      render: r => (
        <span className="text-gray-600 whitespace-nowrap">{r.date ? formatDateAr(r.date) : '—'}</span>
      ),
    },
    {
      id: 'sent',
      label: 'وقت الإرسال',
      sortValue: sentOn,
      hideBelow: 'md',
      width: 150,
      render: r => {
        const on = sentOn(r)
        return <span className="text-xs text-gray-400 whitespace-nowrap">{on ? formatDateAr(on) : '—'}</span>
      },
    },
    {
      id: 'actions',
      label: '',
      align: 'left',
      width: 140,
      render: r => {
        if (!r.phone) return null
        const href = buildWhatsAppLink(
          r.phone,
          `مرحباً ${r.name ?? ''}، شكراً لتواصلك مع ريم غلو هاوس 🌸`
        )
        return (
          <MuiButton
            size="small"
            variant="outlined"
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<WhatsAppIcon fontSize="small" />}
            sx={{ color: '#128C4A', borderColor: '#25D36680', whiteSpace: 'nowrap' }}
          >
            واتساب
          </MuiButton>
        )
      },
    },
  ], [])

  return (
    <div className="h-full min-h-0 flex flex-col">
      <PageHeader
        title="طلبات التواصل"
        subtitle={`${requests.length} طلب من صفحة الموقع`}
      />

      <div className="flex-1 min-h-0">
        <DataTable
          fill
          columns={columns}
          rows={requests}
          getRowId={r => r.id}
          loading={loading}
          empty={
            <EmptyState
              icon="📬"
              title="مفيش طلبات لسه"
              description="أي طلب تواصل من الموقع هيظهر هنا"
            />
          }
        />
      </div>
    </div>
  )
}
