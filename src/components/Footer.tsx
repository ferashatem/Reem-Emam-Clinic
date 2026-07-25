import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function Footer() {
  const { tr, lang } = useLang()
  const f = tr.footer

  return (
    <footer className="foot">
      <div className="foot__grid">
        <div className="foot__col">
          <div className="foot__brand">
            {lang === 'ar' ? (<>ريم <em>غلو</em> هاوس</>) : (<>Reem <em>Glow</em> House</>)}
          </div>
          <p className="foot__tag">{f.tag}</p>
          <a href="#booking" className="btn btn--light btn--sm">{f.getStarted}</a>
          <div className="foot__socials">
            <a href="#" className="foot__s" aria-label="Instagram">📸</a>
            <a href="#" className="foot__s" aria-label="TikTok">🎵</a>
            <a href="#" className="foot__s" aria-label="WhatsApp">💬</a>
            <a href="#" className="foot__s" aria-label="Snapchat">👻</a>
          </div>
        </div>

        <div className="foot__col">
          <h4>{f.linksTitle}</h4>
          <ul>
            <li><a href="#about">{tr.nav.about}</a></li>
            <li><Link to="/services">{tr.nav.services}</Link></li>
            <li><a href="#why-us">{tr.nav.why}</a></li>
            <li><a href="#testimonials">{tr.nav.reviews}</a></li>
            <li><a href="#booking">{tr.nav.cta}</a></li>
          </ul>
        </div>

        <div className="foot__col">
          <h4>{f.servicesTitle}</h4>
          <ul>
            {tr.services.items.slice(0, 5).map(s => (
              <li key={s.name}><a href="#services">{s.name}</a></li>
            ))}
          </ul>
        </div>

        <div className="foot__col">
          <h4>{f.newsTitle}</h4>
          <p className="foot__tag">{tr.booking.contacts.location.value}</p>
          <form className="foot__news" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder={f.newsPh} aria-label={f.newsPh} />
            <button type="submit" className="btn btn--light btn--sm">{f.subscribe}</button>
          </form>
          <h4 style={{ marginTop: '1.4rem' }}>{f.contactTitle}</h4>
          <ul>
            <li><a href="tel:+966500000000">{tr.booking.contacts.phone.value}</a></li>
            <li><a href="https://instagram.com" target="_blank" rel="noreferrer">{tr.booking.contacts.instagram.value}</a></li>
          </ul>
        </div>
      </div>

      <div className="foot__copy">{f.copy}</div>
    </footer>
  )
}
