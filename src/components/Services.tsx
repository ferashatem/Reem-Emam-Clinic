import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

/** Feeds the card its cursor position so the gold glow follows the pointer. */
function trackGlow(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

export default function Services() {
  const { tr } = useLang()
  const s = tr.services
  const delays = ['', 'd1', 'd2']

  return (
    <section id="services" className="section section--wine">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{s.label}</span>
          <h2 className="title reveal d1">{s.title} <span className="soft">{s.titleB}</span></h2>
          <p className="sub reveal d2">{s.sub}</p>
        </div>

        <div className="cards">
          {s.items.map((item, i) => (
            <div key={i} className={`card reveal reveal--scale ${delays[i % 3]}`} onMouseMove={trackGlow}>
              <span className="card__num">{String(i + 1).padStart(2, '0')}</span>
              <div className="card__icon">{item.icon}</div>
              <div className="card__tag">{item.tag}</div>
              <h3 className="card__title">{item.name}</h3>
              <p className="card__text">{item.desc}</p>
              <a href="#booking" className="card__link">
                {s.cta} <span aria-hidden>{tr.dir === 'rtl' ? '←' : '→'}</span>
              </a>
            </div>
          ))}
        </div>

        <div className="services__more reveal d2">
          <Link to="/services" className="btn btn--outline-gold"><span>{s.all}</span></Link>
        </div>
      </div>
    </section>
  )
}
