import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { createReservation, getActiveServices } from '../services/firestore'
import { normalizePhone } from '../utils/validators'
import { toNumber, todayISO } from '../utils/formatters'
import { useLang } from '../context/LangContext'
import { AtIcon, PhoneIcon } from './brand/SocialIcons'
import type { Service } from '../types'

export default function Booking() {
  const { tr } = useLang()
  const b = tr.booking
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])

  // The select must offer real services so the request lands on a priced booking.
  useEffect(() => {
    getActiveServices()
      .then(setServices)
      .catch(() => setServices([]))
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const service = services.find(s => s.id === data.get('service'))
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
        date: String(data.get('date') ?? ''),
        time: String(data.get('time') ?? ''),
        notes: '',
        status: 'pending',
        booked_by: 'client',
        admin_id: null,
      })
      setSuccess(true)
      form.reset()
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
                    <input id="bk-date" name="date" type="date" required min={todayISO()} />
                    <span className="field__ph" aria-hidden>{b.datePh}</span>
                  </div>
                  <div className="field field--picker">
                    <label htmlFor="bk-time">{b.time}</label>
                    <input id="bk-time" name="time" type="time" required />
                    <span className="field__ph" aria-hidden>{b.timePh}</span>
                  </div>
                </div>
                <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
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
