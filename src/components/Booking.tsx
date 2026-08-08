import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { createReservation, getActiveServices } from '../services/firestore'
import { getSlotUsage } from '../services/availability'
import { normalizePhone } from '../utils/validators'
import { todayISO } from '../utils/formatters'
import { messageFor } from '../hooks/useLoader'
import { CLINIC_SLOTS, fitsInSlot, isSlotPast, slotOf } from '../utils/slots'
import { useLang } from '../context/LangContext'
import { groupServices, optionsOf, serviceLabel, sessionMinutes } from '../utils/services'
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
  // Two-step pick: the service first, then — only when it has any — the type
  // inside it (the device under «ليزر», the area under «شعر»).
  const [mainId, setMainId] = useState('')
  const [optionId, setOptionId] = useState('')
  const [date, setDate] = useState('')
  const [pickedTime, setTime] = useState('')
  /** Minutes already committed in each hour of the chosen day. */
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [checking, setChecking] = useState(false)

  // The select must offer real services so the request lands on a priced booking.
  useEffect(() => {
    getActiveServices()
      .then(setServices)
      .catch(() => setServices([]))
  }, [])

  // How full each hour of the chosen day is. This reads the name-free mirror,
  // never the bookings themselves — the visitor sees *how much* of an hour is
  // spoken for, never who spoke for it.
  useEffect(() => {
    if (!date) return
    let live = true
    getSlotUsage(date)
      .then(next => { if (live) setUsage(next) })
      .catch(() => { if (live) setUsage({}) })
      .finally(() => { if (live) setChecking(false) })
    return () => { live = false }
  }, [date])

  /** A new day means a fresh set of hours — never carry the old pick over. */
  function pickDate(value: string) {
    setDate(value)
    setTime('')
    setUsage({})
    // The lookup starts in the effect below; flag it here so the field doesn't
    // flash "all hours free" for the frame before the answer lands.
    setChecking(!!value)
  }

  const mainServices = useMemo(
    () => groupServices(services).map(g => g.service),
    [services]
  )
  const options = useMemo(() => optionsOf(services, mainId), [services, mainId])
  /** What actually gets booked: the chosen type, or the service itself. */
  const picked = options.length > 0
    ? services.find(s => s.id === optionId)
    : services.find(s => s.id === mainId)

  /**
   * A new service means a fresh set of types — never carry the old pick over.
   * The hour goes with it: a longer session may not fit where the last one did.
   */
  function pickService(value: string) {
    setMainId(value)
    setOptionId('')
    setTime('')
  }

  function pickOption(value: string) {
    setOptionId(value)
    setTime('')
  }

  /** How much of an hour this booking will take. */
  const minutes = sessionMinutes(picked, services)

  // An hour holds 60 minutes. A half-hour session sitting in it leaves room for
  // a shorter one, so what counts as "taken" depends on the service she picked.
  const slots = useMemo(
    () => CLINIC_SLOTS.map(slot => {
      const used = usage[slot] ?? 0
      return {
        slot,
        used,
        taken: !fitsInSlot(used, minutes),
        past: isSlotPast(date, slot),
      }
    }),
    [usage, minutes, date]
  )

  const freeCount = slots.filter(s => !s.taken && !s.past).length
  const dayFull = !!date && !checking && freeCount === 0

  // The day can fill up while she is still typing her name, and a longer
  // session can shut an hour that was open when she picked it. Rather than
  // quietly keeping a slot that no longer works, the field falls back to its
  // placeholder — the option is disabled below, so there is nothing to select.
  const time = slots.some(s => s.slot === pickedTime && !s.taken && !s.past) ? pickedTime : ''

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const service = picked

    // Someone may have claimed the rest of this hour since the page loaded.
    const fresh = await getSlotUsage(date).catch(() => usage)
    if (!fitsInSlot(fresh[slotOf(time)] ?? 0, minutes)) {
      setUsage(fresh)
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
        // «ليزر — كانديلا»: every screen reads this one field, so the two
        // levels have to arrive already joined.
        service_name: service ? serviceLabel(service, services) : null,
        // What the hour has to keep free for her.
        duration_minutes: minutes,
        pulses: null,
        price_per_pulse: null,
        // Priced after the session, once the pulse count is known. Sending the
        // service's list price here is also refused outright by the security
        // rules — a request from the public site may never carry a total.
        price_at_booking: 0,
        priced_at: null,
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
      setMainId('')
      setOptionId('')
      setDate('')
      setTime('')
      setTimeout(() => setSuccess(false), 5500)
    } catch (err) {
      // The bare "something went wrong" hid a rules rejection for good; this
      // reports what actually failed, same as every other form in the app.
      toast.error(messageFor(err))
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
                  <select
                    id="bk-service" name="service" required
                    value={mainId} onChange={e => pickService(e.target.value)}
                  >
                    <option value="" disabled>{b.servicePh}</option>
                    {mainServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {/* Only services that actually branch ask a second question —
                    «كشف» stays one click, «ليزر» asks which device. */}
                {options.length > 0 && (
                  <div className="field">
                    <label htmlFor="bk-option">{b.serviceType}</label>
                    <select
                      id="bk-option" name="serviceType" required
                      value={optionId} onChange={e => pickOption(e.target.value)}
                    >
                      <option value="" disabled>{b.serviceTypePh}</option>
                      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                )}
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
                      {/* An hour is either open for this session or it isn't —
                          how much of it is left is the clinic's business. */}
                      {slots.map(({ slot, taken, past }) => (
                        <option
                          key={slot}
                          value={slot}
                          disabled={taken || past}
                          style={taken ? { color: '#C0392B' } : undefined}
                        >
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
                        : `${b.sessionLength} ${minutes} ${b.minShort} — ${freeCount} ${b.timeFree}`}
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
