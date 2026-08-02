import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import BrandMark from './brand/BrandMark'

interface Props {
  /** True on the landing page, where the bar floats over the dark hero photo. */
  onDark?: boolean
}

export default function Navbar({ onDark = false }: Props) {
  const { tr, lang, toggle } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setOpen(false)

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}${onDark ? ' nav--onDark' : ''}`}>
      <a href="#hero" className="nav__brand" aria-label={tr.nav.brand}>
        <BrandMark />
        <span className="nav__brand-text">
          <b>{lang === 'ar' ? 'ريم غلو هاوس' : 'Reem Glow House'}</b>
          {/* the signage wordmark is English on the wall, in both languages */}
          <em>Beauty &amp; Glow Clinic</em>
        </span>
      </a>

      <ul className={`nav__links${open ? ' open' : ''}`}>
        <li><Link to="/services"    onClick={close}>{tr.nav.services}</Link></li>
        <li><a href="#testimonials" onClick={close}>{tr.nav.reviews}</a></li>
        <li><a href="#booking" className="btn btn--primary btn--sm nav__cta-m" onClick={close}><span>{tr.nav.cta}</span></a></li>
      </ul>

      <div className="nav__end">
        <button className="lang" onClick={toggle} aria-label="Switch language">
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>
        <a href="#booking" className="btn btn--primary btn--sm nav__book"><span>{tr.nav.cta}</span></a>
        <button className={`burger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} aria-label="Menu" aria-expanded={open}>
          <span /><span /><span />
        </button>
      </div>
    </nav>
  )
}
