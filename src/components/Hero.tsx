import { useLang } from '../context/LangContext'

const BrandMark = () => (
  <svg viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden>
    <defs>
      <radialGradient id="skin" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#FDE9EE" />
        <stop offset="100%" stopColor="#E7A9B8" />
      </radialGradient>
      <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D98BA0" />
        <stop offset="100%" stopColor="#7A2038" />
      </linearGradient>
    </defs>
    <ellipse cx="115" cy="86" rx="30" ry="35" fill="url(#skin)" opacity="0.95" />
    <path d="M82 74 Q82 44 115 42 Q148 44 148 74 Q145 59 137 53 Q123 47 115 50 Q107 47 93 53 Q85 59 82 74Z" fill="#7A2038" opacity="0.7" />
    <path d="M82 74 Q73 96 76 118 Q82 100 89 94" fill="#7A2038" opacity="0.5" />
    <path d="M148 74 Q157 96 154 118 Q148 100 141 94" fill="#7A2038" opacity="0.5" />
    <ellipse cx="105" cy="86" rx="3.2" ry="2.5" fill="#5C1728" opacity="0.7" />
    <ellipse cx="125" cy="86" rx="3.2" ry="2.5" fill="#5C1728" opacity="0.7" />
    <path d="M107 98 Q115 104 123 98" stroke="#7A2038" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <path d="M74 176 Q78 138 92 128 Q104 118 115 116 Q126 118 138 128 Q152 138 156 176Z" fill="url(#lg)" opacity="0.3" />
    <circle cx="115" cy="150" r="9" stroke="url(#lg)" strokeWidth="1.4" opacity="0.6" />
    <circle cx="115" cy="150" r="4.5" fill="#E7A9B8" opacity="0.65" />
  </svg>
)

export default function Hero() {
  const { tr } = useLang()
  const h = tr.hero

  return (
    <section id="hero" className="hero">
      <div className="hero__grid">
        <div className="hero__copy">
          <span className="hero__chip reveal"><span className="dot" /> {h.sub}</span>
          <h1 className="hero__title reveal d1">
            {h.headline} <span className="soft">{h.headlineB}</span>
          </h1>
          <p className="hero__text reveal d2">{h.tag}</p>
          <div className="hero__actions reveal d3">
            <a href="#booking" className="btn btn--primary">{h.cta}</a>
            <a href="#services" className="btn btn--ghost">{h.ctaGhost}</a>
          </div>
          <div className="hero__stats reveal d4">
            {h.stats.map((s, i) => (
              <div key={i} className="hero__stat">
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__art reveal d2">
          <div className="hero__arch"><BrandMark /></div>
          <div className="hero__badge">
            <span className="ico">💗</span>
            <div>
              <div className="v">{h.stats[0].v}</div>
              <div className="l">{h.stats[0].l}</div>
            </div>
          </div>
          <div className="hero__badge hero__badge--top">
            <span className="ico">⭐</span>
            <div>
              <div className="v">{h.stats[1].v}</div>
              <div className="l">{h.stats[1].l}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
