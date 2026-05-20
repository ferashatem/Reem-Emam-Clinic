import { useEffect, useState } from 'react'
import { getReservations, getClients, getServices, getAdmins, updateReservation, softDeleteReservation, createSessionReport, getSessionReports, createReservation } from '../../services/firestore'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateAr, formatPrice } from '../../utils/formatters'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'قيد الانتظار', color: '#F59E0B' },
  { value: 'confirmed', label: 'مؤكد', color: '#3D9970' },
  { value: 'completed', label: 'مكتمل', color: '#8B3A52' },
  { value: 'cancelled', label: 'ملغي', color: '#EF4444' },
]

export default function SuperAdminReservations() {
  const [reservations, setReservations] = useState<any[]>([])
  const [clients, setClients] = useState<Record<string, any>>({})
  const [services, setServices] = useState<Record<string, any>>({})
  const [admins, setAdmins] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ date: '', status: '', adminId: '' })
  const [selected, setSelected] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ status: '', date: '', time: '', admin_id: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [existingReports, setExistingReports] = useState<Record<string, boolean>>({})
  const [report, setReport] = useState({ diagnosis: '', treatment: '', medicines: [{ name: '', dosage: '' }], prohibited_items: '', food_recommendations: '', next_steps: '' })
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ client_id: '', service_id: '', date: '', time: '', admin_id: '', notes: '' })
  const [addSaving, setAddSaving] = useState(false)

  async function load() {
    const [res, cls, svcs, adms, reps] = await Promise.all([
      getReservations(), getClients(), getServices(), getAdmins(), getSessionReports(),
    ])
    setReservations(res as any[])
    setClients(Object.fromEntries(cls.map((c: any) => [c.id, c])))
    setServices(Object.fromEntries(svcs.map((s: any) => [s.id, s])))
    setAdmins(Object.fromEntries(adms.map((a: any) => [a.id, a])))
    const repMap: Record<string, boolean> = {}
    ;(reps as any[]).forEach((r: any) => { if (r.reservation_id) repMap[r.reservation_id] = true })
    setExistingReports(repMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openModal(r: any) {
    setSelected(r)
    setEditForm({ status: r.status, date: r.date, time: r.time, admin_id: r.admin_id || '', notes: r.notes || '' })
    setReport({ diagnosis: '', treatment: '', medicines: [{ name: '', dosage: '' }], prohibited_items: '', food_recommendations: '', next_steps: '' })
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await updateReservation(selected.id, {
        status: editForm.status,
        date: editForm.date,
        time: editForm.time,
        admin_id: editForm.admin_id || null,
        notes: editForm.notes,
      })

      // Create report if status is completed and no report exists yet
      if (editForm.status === 'completed' && !existingReports[selected.id]) {
        const filledMedicines = report.medicines.filter(m => m.name.trim())
        const hasReportData = report.diagnosis.trim() || report.treatment.trim() || filledMedicines.length > 0
          || report.prohibited_items.trim() || report.food_recommendations.trim() || report.next_steps.trim()
        if (hasReportData) {
          await createSessionReport({
            reservation_id: selected.id,
            client_id: selected.client_id,
            admin_id: editForm.admin_id || selected.admin_id || null,
            service_name: selected.service_name,
            ...(report.diagnosis ? { diagnosis: report.diagnosis } : {}),
            ...(report.treatment ? { treatment: report.treatment } : {}),
            ...(filledMedicines.length > 0 ? { medicines: filledMedicines } : {}),
            ...(report.prohibited_items ? { prohibited_items: report.prohibited_items } : {}),
            ...(report.food_recommendations ? { food_recommendations: report.food_recommendations } : {}),
            ...(report.next_steps ? { next_steps: report.next_steps } : {}),
          })
        }
      }

      toast.success('تم التحديث')
      setSelected(null)
      await load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddReservation() {
    if (!addForm.client_id || !addForm.service_id || !addForm.date || !addForm.time) {
      toast.error('اختاري العميلة والخدمة والتاريخ والوقت')
      return
    }
    setAddSaving(true)
    try {
      const service = services[addForm.service_id]
      await createReservation({
        client_id: addForm.client_id,
        service_id: addForm.service_id,
        service_name: service?.name ?? '',
        price_at_booking: service?.price ?? 0,
        date: addForm.date,
        time: addForm.time,
        admin_id: addForm.admin_id || null,
        notes: addForm.notes,
        booked_by: 'admin',
        status: 'confirmed',
      })
      toast.success('تم إضافة الحجز')
      setAddModal(false)
      setAddForm({ client_id: '', service_id: '', date: '', time: '', admin_id: '', notes: '' })
      await load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setAddSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm('هتلغي الحجز ده؟')) return
    setSaving(true)
    try {
      await softDeleteReservation(selected.id)
      toast.success('تم الحذف')
      setSelected(null)
      await load()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  const filtered = reservations.filter(r => {
    if (filters.date && r.date !== filters.date) return false
    if (filters.status && r.status !== filters.status) return false
    if (filters.adminId && r.admin_id !== filters.adminId) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="الحجوزات"
        subtitle="إدارة ومتابعة حجوزات العيادة"
        action={
          <button
            onClick={() => setAddModal(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#8B3A52' }}
          >
            + إضافة حجز
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex gap-4 flex-wrap border" style={{ borderColor: '#F2C4CE' }}>
        <input type="date" value={filters.date}
          onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: '#F2C4CE' }} />
        <select value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: '#F2C4CE' }}>
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.adminId}
          onChange={e => setFilters(f => ({ ...f, adminId: e.target.value }))}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: '#F2C4CE' }}>
          <option value="">كل الأدمنز</option>
          {Object.values(admins).map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button onClick={() => setFilters({ date: '', status: '', adminId: '' })}
          className="text-sm px-4 py-2 rounded-xl border"
          style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>
          مسح الفلاتر
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📅" title="مفيش حجوزات" description="مفيش حجوزات تطابق الفلتر" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                {['العميلة', 'الخدمة', 'الأدمن', 'التاريخ', 'الوقت', 'الحالة', 'السعر', ''].map(h => (
                  <th key={h} className="text-right text-xs font-semibold px-4 py-3" style={{ color: '#8B3A52' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-[#FDF6F0]/50 transition-colors cursor-pointer"
                  style={{ borderColor: '#F2C4CE30' }}
                  onClick={() => openModal(r)}>
                  <td className="px-4 py-3 text-sm font-medium">{clients[r.client_id]?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{services[r.service_id]?.name ?? r.service_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{admins[r.admin_id]?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateAr(r.date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.time}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#8B3A52' }}>{formatPrice(r.price_at_booking)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F2C4CE', color: '#8B3A52' }}>
                      تعديل
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Reservation Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ color: '#8B3A52' }}>إضافة حجز جديد</h3>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">العميلة</label>
              <select value={addForm.client_id} onChange={e => setAddForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#F2C4CE' }}>
                <option value="">اختاري عميلة</option>
                {Object.values(clients).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">الخدمة</label>
              <select value={addForm.service_id} onChange={e => setAddForm(f => ({ ...f, service_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#F2C4CE' }}>
                <option value="">اختاري خدمة</option>
                {Object.values(services).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">التاريخ</label>
                <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#F2C4CE' }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الوقت</label>
                <input type="time" value={addForm.time} onChange={e => setAddForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#F2C4CE' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">تعيين أدمن (اختياري)</label>
              <select value={addForm.admin_id} onChange={e => setAddForm(f => ({ ...f, admin_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#F2C4CE' }}>
                <option value="">غير محدد</option>
                {Object.values(admins).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات (اختياري)</label>
              <textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="أي ملاحظات..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" style={{ borderColor: '#F2C4CE' }} />
            </div>

            <button onClick={handleAddReservation} disabled={addSaving}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: '#8B3A52' }}>
              {addSaving ? 'جارٍ الحفظ...' : 'إضافة الحجز'}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg" style={{ color: '#8B3A52' }}>إدارة الحجز</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="text-sm text-gray-500 bg-[#FDF6F0] rounded-xl p-3 space-y-1">
              <p><span className="font-medium text-gray-700">العميلة: </span>{clients[selected.client_id]?.name}</p>
              <p><span className="font-medium text-gray-700">الخدمة: </span>{services[selected.service_id]?.name ?? selected.service_name}</p>
              <p><span className="font-medium text-gray-700">السعر: </span>{formatPrice(selected.price_at_booking)}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">الحالة</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setEditForm(f => ({ ...f, status: s.value }))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={editForm.status === s.value
                      ? { backgroundColor: s.color, color: '#fff', borderColor: s.color }
                      : { borderColor: '#F2C4CE', color: '#6b7280' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">التاريخ</label>
                <input type="date" value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#F2C4CE' }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">الوقت</label>
                <input type="time" value={editForm.time}
                  onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: '#F2C4CE' }} />
              </div>
            </div>

            {/* Assign Admin */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">تعيين أدمن</label>
              <select value={editForm.admin_id}
                onChange={e => setEditForm(f => ({ ...f, admin_id: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#F2C4CE' }}>
                <option value="">غير محدد</option>
                {Object.values(admins).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
              <textarea value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="أي ملاحظات..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ borderColor: '#F2C4CE' }} />
            </div>

            {/* Report section — shown when completed */}
            {editForm.status === 'completed' && !existingReports[selected.id] && (
              <div className="border-t pt-4 space-y-3" style={{ borderColor: '#F2C4CE' }}>
                <p className="text-sm font-bold" style={{ color: '#8B3A52' }}>تقرير الجلسة <span className="text-gray-400 font-normal text-xs">(كل الخانات اختيارية)</span></p>

                {[
                  { key: 'diagnosis', label: 'التشخيص / ملاحظات الجلسة' },
                  { key: 'treatment', label: 'العلاج المستخدم' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                    <textarea
                      value={(report as any)[field.key]}
                      onChange={e => setReport(r => ({ ...r, [field.key]: e.target.value }))}
                      rows={2} placeholder="اكتبي هنا..."
                      className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                      style={{ borderColor: '#F2C4CE' }} />
                  </div>
                ))}

                {/* Medicines dynamic list */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2">💊 الأدوية الموصوفة</label>
                  <div className="space-y-2">
                    {(Array.isArray(report.medicines) ? report.medicines : []).map((med, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          value={med.name}
                          onChange={e => setReport(r => {
                            const meds = [...r.medicines]
                            meds[idx] = { ...meds[idx], name: e.target.value }
                            return { ...r, medicines: meds }
                          })}
                          placeholder="اسم الدواء"
                          className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none"
                          style={{ borderColor: '#F2C4CE' }}
                        />
                        <input
                          value={med.dosage}
                          onChange={e => setReport(r => {
                            const meds = [...r.medicines]
                            meds[idx] = { ...meds[idx], dosage: e.target.value }
                            return { ...r, medicines: meds }
                          })}
                          placeholder="الجرعة"
                          className="w-28 border rounded-xl px-3 py-2 text-sm focus:outline-none"
                          style={{ borderColor: '#F2C4CE' }}
                        />
                        {report.medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setReport(r => ({ ...r, medicines: r.medicines.filter((_, i) => i !== idx) }))}
                            className="text-red-400 hover:text-red-600 text-lg leading-none"
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReport(r => ({ ...r, medicines: [...r.medicines, { name: '', dosage: '' }] }))}
                    className="mt-2 text-xs px-3 py-1.5 rounded-xl border"
                    style={{ borderColor: '#8B3A52', color: '#8B3A52' }}
                  >+ إضافة دواء</button>
                </div>

                {[
                  { key: 'prohibited_items', label: '🚫 الأشياء المحظورة' },
                  { key: 'food_recommendations', label: '🥗 توصيات الأكل' },
                  { key: 'next_steps', label: 'الخطوات القادمة' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                    <textarea
                      value={(report as any)[field.key]}
                      onChange={e => setReport(r => ({ ...r, [field.key]: e.target.value }))}
                      rows={2} placeholder="اكتبي هنا..."
                      className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                      style={{ borderColor: '#F2C4CE' }} />
                  </div>
                ))}
              </div>
            )}

            {editForm.status === 'completed' && existingReports[selected.id] && (
              <div className="text-xs text-center text-gray-400 py-2">
                ✅ تم كتابة تقرير لهذه الجلسة مسبقاً
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#8B3A52' }}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 disabled:opacity-50">
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
