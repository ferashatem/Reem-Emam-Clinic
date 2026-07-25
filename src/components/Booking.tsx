import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useLang } from '../context/LangContext'

export default function Booking() {
  const { tr } = useLang()
  const b = tr.booking
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setLoading(true)
    try {
      await addDoc(collection(db, 'contact_requests'), {
        name: data.get('name'),
        phone: data.get('phone'),
        service: data.get('service'),
        date: data.get('date'),
        created_at: Timestamp.now(),
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

  const services = tr.services.items.map(s => s.name)

  return (
    <section id="booking" className="section section--blush">
      <div className="wrap book__grid">
        <div className="book__aside">
          <span className="eyebrow reveal">{b.label}</span>
          <h2 className="title reveal d1">{b.title} <span className="soft">{b.titleB}</span></h2>
          <p className="sub reveal d2">{b.intro}</p>
          <ul className="book__perks reveal d2">
            {b.perks.map(p => <li key={p}><span className="chk">✓</span>{p}</li>)}
          </ul>
          <div className="book__contacts reveal d3">
            <a href="tel:+966500000000" className="book__contact">
              <span className="ico">📞</span>{b.contacts.phone.value}
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="book__contact">
              <span className="ico">📷</span>{b.contacts.instagram.value}
            </a>
          </div>
        </div>

        <div className="book__card reveal d2">
          {!success ? (
            <form className="form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label>{b.name}</label>
                  <input name="name" type="text" placeholder={b.namePh} required />
                </div>
                <div className="field">
                  <label>{b.phone}</label>
                  <input name="phone" type="tel" placeholder={b.phonePh} required />
                </div>
              </div>
              <div className="field">
                <label>{b.service}</label>
                <select name="service" required defaultValue="">
                  <option value="" disabled>{b.servicePh}</option>
                  {services.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{b.date}</label>
                <input name="date" type="date" required />
              </div>
              <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? '...' : b.submit}
              </button>
            </form>
          ) : (
            <div className="success">
              <div className="ico">🌸</div>
              <h3>{b.successTitle}</h3>
              <p>{b.successSub}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
