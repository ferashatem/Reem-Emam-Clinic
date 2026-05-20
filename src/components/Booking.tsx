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
    <section id="booking" className="booking-section">
      <div className="container">
        <p className="section-label fi">{b.label}</p>
        <h2 className="section-title fi d1">{b.title}</h2>
        <div className="divider fi d2"><span>✦</span></div>

        <div className="booking-box fi d3">
          {!success ? (
            <form className="bform" onSubmit={handleSubmit}>
              <div className="frow">
                <div className="fg">
                  <label>{b.name}</label>
                  <input name="name" type="text" placeholder={b.namePh} required />
                  <span className="fl" />
                </div>
                <div className="fg">
                  <label>{b.phone}</label>
                  <input name="phone" type="tel" placeholder={b.phonePh} required />
                  <span className="fl" />
                </div>
              </div>
              <div className="fg">
                <label>{b.service}</label>
                <select name="service" required defaultValue="">
                  <option value="" disabled>{b.servicePh}</option>
                  {services.map(s => <option key={s}>{s}</option>)}
                </select>
                <span className="fl" />
              </div>
              <div className="fg">
                <label>{b.date}</label>
                <input name="date" type="date" required />
                <span className="fl" />
              </div>
              <button type="submit" className="sbtn" disabled={loading}>
                {loading ? '...' : b.submit}
              </button>
            </form>
          ) : (
            <div className="success-msg">
              <div className="success-ico">🌸</div>
              <div className="success-h">{b.successTitle}</div>
              <div className="success-p">{b.successSub}</div>
            </div>
          )}
        </div>

        <div className="contacts">
          <a href="tel:+966500000000" className="ci fi d1">
            <div className="ci-icon">📞</div>
            <div className="ci-label">{b.contacts.phone.label}</div>
            <div className="ci-val">{b.contacts.phone.value}</div>
          </a>
          <a href="#" className="ci fi d2">
            <div className="ci-icon">📍</div>
            <div className="ci-label">{b.contacts.location.label}</div>
            <div className="ci-val">{b.contacts.location.value}</div>
          </a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="ci fi d3">
            <div className="ci-icon">📷</div>
            <div className="ci-label">{b.contacts.instagram.label}</div>
            <div className="ci-val">{b.contacts.instagram.value}</div>
          </a>
        </div>
      </div>
    </section>
  )
}
