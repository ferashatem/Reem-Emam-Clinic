import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTimetable, createTimetableSlot, updateTimetableSlot } from '../../services/firestore'
import { getReservations } from '../../services/firestore'
import { getClients, getServices } from '../../services/firestore'
import PageHeader from '../../components/ui/PageHeader'
import { format, addDays, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'

const HOURS = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

function getWeekDays(base: Date) {
  const start = startOfWeek(base, { weekStartsOn: 6 }) // Saturday
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export default function Timetable() {
  const { userProfile } = useAuth()
  const [baseDate, setBaseDate] = useState(new Date())
  const [slots, setSlots] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [clientMap, setClientMap] = useState<Record<string, any>>({})
  const [serviceMap, setServiceMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  const weekDays = getWeekDays(baseDate)
  const startDay = format(weekDays[0], 'yyyy-MM-dd')
  const endDay = format(weekDays[6], 'yyyy-MM-dd')

  useEffect(() => {
    if (!userProfile) return
    async function load() {
      setLoading(true)
      const [tSlots, res, cls, svcs] = await Promise.all([
        getTimetable(userProfile!.uid, startDay, endDay),
        getReservations({ adminId: userProfile!.uid }),
        getClients(),
        getServices(),
      ])
      setSlots(tSlots as any[])
      setReservations(res as any[])
      setClientMap(Object.fromEntries(cls.map((c: any) => [c.id, c])))
      setServiceMap(Object.fromEntries(svcs.map((s: any) => [s.id, s])))
      setLoading(false)
    }
    load()
  }, [userProfile, startDay])

  async function toggleSlot(day: string, hour: string) {
    const existing = slots.find(s => s.day === day && s.slot_start === hour)
    if (existing) {
      await updateTimetableSlot(existing.id, { is_available: !existing.is_available })
      toast.success(existing.is_available ? 'Slot disabled' : 'Slot enabled')
    } else {
      const [h, m] = hour.split(':').map(Number)
      const endHour = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      await createTimetableSlot({
        admin_id: userProfile!.uid,
        day,
        slot_start: hour,
        slot_end: endHour,
        break_time: 0,
        is_available: true,
        reservation_id: null,
      })
      toast.success('Slot added')
    }
    // Reload
    const updated = await getTimetable(userProfile!.uid, startDay, endDay)
    setSlots(updated as any[])
  }

  function getSlotForCell(day: string, hour: string) {
    return slots.find(s => s.day === day && s.slot_start === hour)
  }

  function getReservationForSlot(day: string, hour: string) {
    return reservations.find(r => r.date === day && r.time === hour && r.status !== 'cancelled')
  }

  const dayNames = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Week: ${format(weekDays[0], 'dd MMM')} – ${format(weekDays[6], 'dd MMM yyyy')}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setBaseDate(d => addDays(d, -7))} className="px-4 py-2 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>← Prev week</button>
            <button onClick={() => setBaseDate(new Date())} className="px-4 py-2 rounded-xl border text-sm" style={{ borderColor: '#8B3A52', color: '#8B3A52' }}>Today</button>
            <button onClick={() => setBaseDate(d => addDays(d, 7))} className="px-4 py-2 rounded-xl border text-sm" style={{ borderColor: '#F2C4CE', color: '#8B3A52' }}>Next week →</button>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex gap-4 mb-5 text-xs">
        {[
          { color: '#D1FAE5', label: 'Available' },
          { color: '#FBBF24', label: 'Booked' },
          { color: '#F3F4F6', label: 'Unavailable' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
            <span className="text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4 border-[#8B3A52] border-t-transparent" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-auto" style={{ borderColor: '#F2C4CE' }}>
          <table className="w-full min-w-[700px]">
            <thead style={{ backgroundColor: '#FDF6F0' }}>
              <tr>
                <th className="text-left text-xs font-semibold px-4 py-3 w-20" style={{ color: '#8B3A52' }}>Time</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="text-center text-xs font-semibold px-2 py-3" style={{ color: format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? '#8B3A52' : '#6B7280' }}>
                    <div>{dayNames[i]}</div>
                    <div className={`text-base font-bold mt-1 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-[#8B3A52] text-white' : ''}`}>
                      {format(d, 'd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour} className="border-t" style={{ borderColor: '#F2C4CE20' }}>
                  <td className="px-4 py-2 text-xs text-gray-400 font-medium">{hour}</td>
                  {weekDays.map((d, i) => {
                    const dayStr = format(d, 'yyyy-MM-dd')
                    const slot = getSlotForCell(dayStr, hour)
                    const reservation = getReservationForSlot(dayStr, hour)

                    let bg = '#F9FAFB'
                    let content = null

                    if (reservation) {
                      bg = '#FEF3C7'
                      content = (
                        <div className="text-xs leading-tight">
                          <p className="font-medium" style={{ color: '#92400E' }}>{clientMap[reservation.client_id]?.name ?? '-'}</p>
                          <p className="text-gray-500">{serviceMap[reservation.service_id]?.name ?? '-'}</p>
                        </div>
                      )
                    } else if (slot?.is_available) {
                      bg = '#D1FAE5'
                    }

                    return (
                      <td key={i} className="px-1 py-1">
                        <div
                          onClick={() => !reservation && toggleSlot(dayStr, hour)}
                          className={`rounded-lg min-h-[44px] p-1.5 text-center transition-all ${!reservation ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          style={{ backgroundColor: bg }}
                        >
                          {content}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
