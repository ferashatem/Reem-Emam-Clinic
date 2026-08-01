import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { createReservation, getActiveServices } from '../services/firestore'
import { getBusySlots } from '../services/availability'
import { normalizePhone } from '../utils/validators'
import { toNumber, todayISO } from '../utils/formatters'
import { CLINIC_SLOTS, isSlotPast, slotOf } from '../utils/slots'
import { useLang } from '../context/LangContext'
import { AtIcon, PhoneIcon } from './brand/SocialIcons'
import type { Lang } from '../lang'
import type { Service } from '../types'

/** '14:00' → '٢:٠٠ م' / '2:00 PM'. */
function clockLabel(slot: string, lang: Lang): string {
  const [h, m] = slot.split(':')
  const hour = Number(h)
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const period = lang === 'ar' ? (hour >= 12 ? 'م' : 'ص') : hour >= 12 ? 'PM' : 'AM'
  return `${h12}:${m} ${period}`
}

export default function Booking() {
  const { tr, lang } = useLang()
  const b = tr.booking
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState<string[]>([])
  const [checking, setChecking] = useState(false)

  // The select must offer real services so the request lands on a priced booking.
  useEffect(() => {
    getActiveServices()
      .then(setServices)
      .catch(() => setServices([]))
  }, [])

  // Which hours are gone on the chosen day. This reads the name-free mirror,
  // never the bookings themselves — the visitor sees *that* an hour is taken,
  // never who took it.
  useEffect(() => {
    if (!date) return
    let live = true
    getBusySlots(date)
      .then(slots => {
        if (!live) return
        setBusy(slots)
        // The day can fill up while she is still typing her name.
        setTime(t => (t && slots.includes(slotOf(t)) ? '' : t))
      })
      .catch(() => { if (live) setBusy([]) })
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [date])

  /** A new day means a fresh set of hours — never carry the old pick over. */
  function pickDate(value: string) {
    setDate(value)
    setTime('')
    setBusy([])
    // The lookup starts in the effect below; flag it here so the field doesn't
    // flash "all hours free" for the frame before the answer lands.
    setChecking(!!value)
  }

  const slots = useMemo(
    () => CLINIC_SLOTS.map(slot => ({
      slot,
      taken: busy.includes(slot),
      past: isSlotPast(date, slot),
    })),
    [busy, date]
  )

  const freeCount = slots.filter(s => !s.taken && !s.past).length
  const dayFull = !!date && !checking && freeCount === 0

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const service = services.find(s => s.id === data.get('service'))

    // Someone may have claimed this hour since the page loaded.
    const fresh = await getBusySlots(date).catch(() => busy)
    if (fresh.includes(slotOf(time))) {
      setBusy(fresh)
      setTime('')
      toast.error(b.timeTakenErr)
      return
    }

    setLoading(true)
    try {
      // Same shape the booking modal writes, so it shows up in «طلبات من الموقع».
      await createReservation({
        client_id: null,
        client_name: String(data.get('name') ?? '').trim(),
        client_phone: normalizePhone(String(data.get('phone') ?? '')),
        service_id: service?.id ?? null,
        service_name: service?.name ?? null,
        pulses: null,
        price_per_pulse: null,
        price_at_booking: toNumber(service?.price),
        paid_amount: 0,
        payment_status: 'unpaid',
        date,
        time,
        notes: '',
        status: 'pending',
        booked_by: 'client',
        admin_id: null,
      })
      setSuccess(true)
      form.reset()
      setDate('')
      setTime('')
      setTimeout(() => setSuccess(false), 5500)
    } catch {
      toast.error('حدث خطأ، حاولي مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="booking" className="section section--wine book">
      <div className="wrap book__grid">
        <div className="book__aside">
          <span className="eyebrow reveal">{b.label}</span>
          <h2 className="title reveal d1">{b.title} <span className="soft">{b.titleB}</span></h2>
          <p className="sub reveal d2">{b.intro}</p>
          <ul className="book__perks reveal d3">
            {b.perks.map(p => <li key={p}><span className="chk" aria-hidden>✓</span>{p}</li>)}
          </ul>
          <div className="book__contacts reveal d4">
            <a href="tel:+201019191995" className="book__contact">
              <span className="ico"><PhoneIcon /></span>{b.contacts.phone.value}
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="book__contact">
              <span className="ico"><AtIcon /></span>{b.contacts.instagram.value}
            </a>
          </div>
        </div>

        <div className="book__card reveal reveal--right d2">
          {!success ? (
            <>
              <h3>{b.formTitle}</h3>
              <p className="hint">{b.formHint}</p>
              <form className="form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="bk-name">{b.name}</label>
                    <input id="bk-name" name="name" type="text" placeholder={b.namePh} autoComplete="name" required />
                  </div>
                  <div className="field">
                    <label htmlFor="bk-phone">{b.phone}</label>
                    {/* the numeric pad is the whole point of tel on a phone */}
                    <input id="bk-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={b.phonePh} required />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="bk-service">{b.service}</label>
                  <select id="bk-service" name="service" required defaultValue="">
                    <option value="" disabled>{b.servicePh}</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  {/* The native empty-state hint renders its Arabic segments
                      reversed («ةنس/رهش/موي»), so we blank it out and lay our
                      own placeholder over the field until a date is picked. */}
                  <div className="field field--picker">
                    <label htmlFor="bk-date">{b.date}</label>
                    <input
                      id="bk-date" name="date" type="date" required min={todayISO()}
                      value={date} onChange={e => pickDate(e.target.value)}
                    />
                    <span className="field__ph" aria-hidden>{b.datePh}</span>
                  </div>
                  {/* Fixed hourly slots rather than a free time input — she can
                      only ask for an hour the clinic can actually give her. */}
                  <div className="field">
                    <label htmlFor="bk-time">{b.time}</label>
                    <select
                      id="bk-time" name="time" required
                      value={time} onChange={e => setTime(e.target.value)}
                      disabled={!date || checking}
                    >
                      <option value="" disabled>{b.timePh}</option>
                      {slots.map(({ slot, taken, past }) => (
                        <option key={slot} value={slot} disabled={taken || past}>
                          {clockLabel(slot, lang)}
                          {taken ? ` — ${b.timeBooked}` : past ? ` — ${b.timePast}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className={`slot-note${dayFull ? ' slot-note--full' : ''}`} role="status">
                  <span className="slot-note__ico" aria-hidden>{dayFull ? '✕' : 'ⓘ'}</span>
                  {!date
                    ? b.timePickDate
                    : checking
                      ? b.timeChecking
                      : dayFull
                        ? b.timeFull
                        : `${freeCount} ${b.timeFree} — ${b.timeNotice}`}
                </p>

                <button type="submit" className="btn btn--primary btn--block" disabled={loading || dayFull}>
                  <span>{loading ? '…' : b.submit}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="success">
              <div className="ico" aria-hidden>✦</div>
              <h3>{b.successTitle}</h3>
              <p>{b.successSub}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
