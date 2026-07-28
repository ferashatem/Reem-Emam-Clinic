import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import BrandMark from './brand/BrandMark'
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from './brand/SocialIcons'

export default function Footer() {
  const { tr, lang } = useLang()
  const f = tr.footer

  return (
    <footer className="foot">
      <div className="foot__watermark" aria-hidden>Reem Glow House</div>

      <div className="foot__grid">
        <div className="foot__col">
          <div className="foot__brand">
            <BrandMark />
            <span className="foot__brand-text">
              <b>{lang === 'ar' ? 'ريم غلو هاوس' : 'Reem Glow House'}</b>
              <em>Believe in your Glow ♡</em>
            </span>
          </div>
          <p className="foot__tag">{f.tag}</p>
          <a href="#booking" className="btn btn--gold btn--sm"><span>{f.getStarted}</span></a>
          <div className="foot__socials">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="foot__s" aria-label="Facebook"><FacebookIcon /></a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="foot__s" aria-label="Instagram"><InstagramIcon /></a>
            <a href="https://wa.me/201019191995" target="_blank" rel="noreferrer" className="foot__s" aria-label="WhatsApp"><WhatsAppIcon /></a>
          </div>
        </div>

        <div className="foot__col">
          <h4>{f.linksTitle}</h4>
          <ul>
            <li><a href="#about">{tr.nav.about}</a></li>
            <li><Link to="/services">{tr.nav.services}</Link></li>
            <li><a href="#gallery">{tr.nav.gallery}</a></li>
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
          <h4>{f.contactTitle}</h4>
          <ul>
            <li><a href="tel:+966500000000">{tr.booking.contacts.phone.value}</a></li>
            <li><a href="https://instagram.com" target="_blank" rel="noreferrer">{tr.booking.contacts.instagram.value}</a></li>
          </ul>
          <p className="foot__tag" style={{ marginTop: '0.9rem' }}>{tr.booking.contacts.location.value}</p>

          <h4 style={{ marginTop: '1.6rem' }}>{f.newsTitle}</h4>
          <form className="foot__news" onSubmit={e => e.preventDefault()}>
            <input type="email" placeholder={f.newsPh} aria-label={f.newsPh} />
            <button type="submit" className="btn btn--light btn--sm"><span>{f.subscribe}</span></button>
          </form>
        </div>
      </div>

      <div className="foot__copy">
        <span>{f.copy}</span>
      </div>
    </footer>
  )
}
