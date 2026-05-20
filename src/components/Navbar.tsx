import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function Navbar() {
  const { tr, lang, toggle } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setOpen(false)

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <a href="/" className="nav-brand">
        {lang === 'ar' ? (
          <>ريم <em>غلو</em> هاوس</>
        ) : (
          <>Reem <em>Glow</em> House</>
        )}
      </a>

      <ul className={`nav-links${open ? ' open' : ''}`}>
        <li><a href="/#about"        onClick={close}>{tr.nav.about}</a></li>
        <li><Link to="/services"     onClick={close}>{tr.nav.services}</Link></li>
        <li><a href="/#why-us"       onClick={close}>{tr.nav.why}</a></li>
        <li><a href="/#testimonials" onClick={close}>{tr.nav.reviews}</a></li>
        <li><a href="/#booking"      onClick={close}>{tr.nav.cta}</a></li>
        <li><Link to="/login" className="nav-cta" onClick={close}>دخول</Link></li>
      </ul>

      <div className="nav-end">
        <button className="lang-toggle" onClick={toggle} aria-label="Switch language">
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>
        <button
          className={`hamburger${open ? ' active' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
