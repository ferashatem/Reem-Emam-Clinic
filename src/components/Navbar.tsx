import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function Navbar() {
  const { tr, lang, toggle } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setOpen(false)

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <a href="#hero" className="nav__brand">
        {lang === 'ar' ? (<>ريم <em>غلو</em> هاوس</>) : (<>Reem <em>Glow</em> House</>)}
      </a>

      <ul className={`nav__links${open ? ' open' : ''}`}>
        <li><a href="#about"        onClick={close}>{tr.nav.about}</a></li>
        <li><Link to="/services"    onClick={close}>{tr.nav.services}</Link></li>
        <li><a href="#why-us"       onClick={close}>{tr.nav.why}</a></li>
        <li><a href="#testimonials" onClick={close}>{tr.nav.reviews}</a></li>
        <li><a href="#booking" className="btn btn--primary btn--sm nav__cta-m" onClick={close}>{tr.nav.cta}</a></li>
      </ul>

      <div className="nav__end">
        <Link to="/login" className="nav__login">{tr.nav.login}</Link>
        <button className="lang" onClick={toggle} aria-label="Switch language">
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>
        <a href="#booking" className="btn btn--primary btn--sm nav__book">{tr.nav.cta}</a>
        <button className={`burger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
