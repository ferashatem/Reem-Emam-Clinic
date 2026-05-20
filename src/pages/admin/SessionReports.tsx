import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getSessionReports, createSessionReport } from '../../services/firestore'
import { getClients, getReservations } from '../../services/firestore'
import { uploadSessionPhotos } from '../../services/storage'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { format } from 'date-fns'

interface ReportForm {
  reservation_id: string
  client_id: string
  diagnosis: string
  treatment: string
  products_used: string
  next_steps: string
}

export default function SessionReports() {
  const { userProfile } = useAuth()
  const [reports, setReports] = useState<any[]>([])
  const [_clients, setClients] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ReportForm>()

  const watchedResId = watch('reservation_id')

  useEffect(() => {
    const res = reservations.find(r => r.id === watchedResId)
    if (res) setValue('client_id', res.client_id)
  }, [watchedResId, reservations])

  async function load() {
    if (!userProfile) return
    setLoading(true)
    const [reps, cls, res] = await Promise.all([
      getSessionReports({ adminId: userProfile.uid }),
      getClients(),
      getReservations({ adminId: userProfile.uid }),
    ])
    setReports(reps as any[])
    setClients(cls as any[])
    setReservations((res as any[]).filter(r => r.status === 'completed'))
    setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setLoading(false)
  }

  useEffect(() => { load() }, [userProfile])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviewUrls(files.map(f => URL.createObjectURL(f)))
  }

  async function onSubmit(data: ReportForm) {
    setSaving(true)
    try {
      let photoUrls: string[] = []
      if (photos.length > 0) {
        const id = `${Date.now()}`
        photoUrls = await uploadSessionPhotos(photos, id)
      }
      await createSessionReport({
        ...data,
        admin_id: userProfile?.uid,
        photos: photoUrls,
      })
      toast.success('Session report saved')
      setModalOpen(false)
      setPhotos([])
      setPreviewUrls([])
      reset()
      load()
    } catch {
      toast.error('An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Session Reports"
        subtitle="Document each session's results"
        action={<button onClick={() => { reset(); setPhotos([]); setPreviewUrls([]); setModalOpen(true) }} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Report</button>}
      />

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : reports.length === 0 ? (
        <EmptyState icon="📋" title="No reports yet" description="Add a report after each session" action={<button onClick={() => setModalOpen(true)} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#8B3A52' }}>+ New Report</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-6 shadow-sm border cursor-pointer hover:border-[#8B3A52]/30 transition-colors" style={{ borderColor: '#F2C4CE' }} onClick={() => setSelected(r)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: '#F2C4CE' }}>👩</div>
                <div>
                  <p className="font-medium text-sm">{clientMap[r.client_id]?.name ?? '-'}</p>
                  <p className="text-xs text-gray-400">
                    {r.session_date?.toDate ? format(r.session_date.toDate(), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{r.diagnosis}</p>
              {r.photos?.length > 0 && (
                <div className="flex gap-1.5">
                  {r.photos.slice(0, 3).map((url: string, i: number) => (
                    <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                  ))}
                  {r.photos.length > 3 && <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">+{r.photos.length - 3}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Session Report" width="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Reservation</label>
            <select {...register('reservation_id', { required: true })} className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52]" style={{ borderColor: errors.reservation_id ? '#ef4444' : '#F2C4CE' }}>
              <option value="">Select reservation...</option>
              {reservations.map(r => (
                <option key={r.id} value={r.id}>
                  {clientMap[r.client_id]?.name ?? r.client_id} — {r.date} {r.time}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" {...register('client_id')} />
          {[
            { name: 'diagnosis' as const, label: 'Diagnosis', required: true },
            { name: 'treatment' as const, label: 'Treatment Given', required: false },
            { name: 'products_used' as const, label: 'Products Used', required: false },
            { name: 'next_steps' as const, label: 'Next Steps', required: false },
          ].map(({ name, label, required }) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1.5">{label}</label>
              <textarea
                {...register(name, { required })}
                rows={3}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#8B3A52] resize-none"
                style={{ borderColor: errors[name] ? '#ef4444' : '#F2C4CE' }}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1.5">Session Photos</label>
            <input ref={fileRef} type="file" multiple accept="image/*" onChange={handlePhotoChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-xl border-2 border-dashed text-sm transition-colors" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>
              📷 Select photos ({photos.length} selected)
            </button>
            {previewUrls.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {previewUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded-xl" />
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-white font-medium disabled:opacity-50" style={{ backgroundColor: '#8B3A52' }}>
              {saving ? 'Saving...' : 'Save Report'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border font-medium" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Report Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Client</p>
              <p className="font-medium">{clientMap[selected.client_id]?.name ?? '-'}</p>
            </div>
            {[
              { label: 'Diagnosis', value: selected.diagnosis },
              { label: 'Treatment', value: selected.treatment },
              { label: 'Products Used', value: selected.products_used },
              { label: 'Next Steps', value: selected.next_steps },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm bg-gray-50 rounded-xl p-3 leading-relaxed">{value}</p>
              </div>
            ) : null)}
            {selected.photos?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {selected.photos.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="w-full h-28 object-cover rounded-xl" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
