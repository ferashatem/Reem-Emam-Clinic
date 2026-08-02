import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { photos } from '../assets/clinic'

/**
 * Splits a line into words so each one can rise out of its own mask.
 * `from` keeps the stagger counting across both lines of the headline.
 */
function Words({ text, from }: { text: string; from: number }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, i) => (
        // the space lives outside `.w`, which clips its overflow to form the mask
        <span key={i}>
          <span className="w"><span style={{ '--i': from + i } as CSSProperties}>{word}</span></span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

export default function Hero() {
  const { tr } = useLang()
  const h = tr.hero
  const firstCount = h.headline.split(' ').length

  return (
    <section id="hero" className="hero">
      <div className="hero__media">
        <img src={photos.reception} alt="" fetchPriority="high" />
      </div>
      <div className="hero__grain" />
      <div className="hero__frame" />

      <div className="hero__inner">
        <div className="hero__copy">
          <span className="hero__chip"><span className="dot" /> {h.sub}</span>

          <h1 className="hero__title">
            <span className="ln"><Words text={h.headline} from={0} /></span>
            <span className="ln ln--gold"><Words text={h.headlineB} from={firstCount} /></span>
          </h1>

          <p className="hero__text">{h.tag}</p>

          <div className="hero__actions">
            <a href="#booking" className="btn btn--gold"><span>{h.cta}</span></a>
            <Link to="/services" className="btn btn--outline-gold"><span>{tr.nav.services}</span></Link>
          </div>

          <div className="hero__stats">
            {h.stats.map((s, i) => (
              <div key={i} className="hero__stat">
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <a href="#gallery" className="hero__scroll" aria-label={h.scroll}>
        <span>{h.scroll}</span>
        <span className="track" />
      </a>
    </section>
  )
}
