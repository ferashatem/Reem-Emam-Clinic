import { useMemo, useEffect, useRef } from 'react'
import { useLang } from '../context/LangContext'

const STAR_CHARS = ['✦', '✧', '⋆', '✺', '❋']

export default function Hero() {
  const { tr } = useLang()
  const innerRef = useRef<HTMLDivElement>(null)

  const stars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      char: STAR_CHARS[i % STAR_CHARS.length],
      top: 8 + Math.random() * 84,
      left: Math.random() * 100,
      sz: 0.55 + Math.random() * 1.1,
      dur: 3 + Math.random() * 5,
      dl: Math.random() * 7,
    })), [])

  useEffect(() => {
    const onScroll = () => {
      const sc = window.scrollY
      if (innerRef.current && sc < window.innerHeight) {
        innerRef.current.style.transform = `translateY(${sc * 0.28}px)`
        innerRef.current.style.opacity = String(Math.max(0, 1 - sc / (window.innerHeight * 0.72)))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section id="hero" className="hero-section">
      {/* twinkling stars */}
      <div className="hero-stars" aria-hidden>
        {stars.map(s => (
          <span
            key={s.id}
            className="hs"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              '--sz': `${s.sz}rem`,
              '--dur': `${s.dur}s`,
              '--dl': `${s.dl}s`,
            } as React.CSSProperties}
          >
            {s.char}
          </span>
        ))}
      </div>

      <div className="hero-inner" ref={innerRef}>
        {/* SVG logo */}
        <div className="logo-wrap fi">
          <div className="logo-orbit" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="orbit-dot" />)}
          </div>
          <svg viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden>
            <defs>
              <radialGradient id="bg" cx="50%" cy="42%" r="55%">
                <stop offset="0%" stopColor="#FDF6F0" />
                <stop offset="100%" stopColor="#F2C4CE" />
              </radialGradient>
              <radialGradient id="skin" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#FDDCC4" />
                <stop offset="100%" stopColor="#E8A882" />
              </radialGradient>
              <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C9956C" />
                <stop offset="100%" stopColor="#8B3A52" />
              </linearGradient>
            </defs>
            <circle cx="115" cy="115" r="110" stroke="url(#lg)" strokeWidth="0.9" strokeDasharray="7 5" opacity="0.45" />
            <circle cx="115" cy="115" r="96" fill="url(#bg)" opacity="0.88" />
            <ellipse cx="115" cy="76" rx="23" ry="27" fill="url(#skin)" opacity="0.92" />
            <path d="M92 68 Q92 46 115 44 Q138 46 138 68 Q136 57 130 53 Q120 49 115 51 Q110 49 100 53 Q94 57 92 68Z" fill="#8B3A52" opacity="0.72" />
            <path d="M92 68 Q85 84 87 100 Q91 88 96 84" fill="#8B3A52" opacity="0.58" />
            <path d="M138 68 Q145 84 143 100 Q139 88 134 84" fill="#8B3A52" opacity="0.58" />
            <rect x="108" y="99" width="14" height="14" rx="5" fill="url(#skin)" opacity="0.88" />
            <path d="M76 178 Q79 135 92 122 Q103 111 115 109 Q127 111 138 122 Q151 135 154 178Z" fill="#C9956C" opacity="0.32" />
            <path d="M105 116 Q115 124 125 116" stroke="url(#lg)" strokeWidth="1.2" opacity="0.45" />
            <ellipse cx="107" cy="76" rx="2.8" ry="2.2" fill="#6B3045" opacity="0.65" />
            <ellipse cx="123" cy="76" rx="2.8" ry="2.2" fill="#6B3045" opacity="0.65" />
            <path d="M109 85 Q115 90 121 85" stroke="#8B3A52" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
            <path d="M58 105 Q44 92 52 75 Q61 88 58 105Z" fill="#C9956C" opacity="0.48" />
            <path d="M52 105 Q36 100 40 82 Q51 92 52 105Z" fill="#8B3A52" opacity="0.28" />
            <path d="M60 116 Q44 114 47 96 Q57 105 60 116Z" fill="#C9956C" opacity="0.38" />
            <path d="M172 105 Q186 92 178 75 Q169 88 172 105Z" fill="#C9956C" opacity="0.48" />
            <path d="M178 105 Q194 100 190 82 Q179 92 178 105Z" fill="#8B3A52" opacity="0.28" />
            <path d="M170 116 Q186 114 183 96 Q173 105 170 116Z" fill="#C9956C" opacity="0.38" />
            <text x="62" y="62" fontSize="16" fill="#C9956C" opacity="0.78" textAnchor="middle">✦</text>
            <text x="168" y="62" fontSize="16" fill="#C9956C" opacity="0.78" textAnchor="middle">✦</text>
            <text x="115" y="205" fontSize="11" fill="#C9956C" opacity="0.65" textAnchor="middle">✦ ✦ ✦</text>
            <circle cx="115" cy="182" r="9" stroke="#C9956C" strokeWidth="1.2" opacity="0.55" />
            <circle cx="115" cy="182" r="5" fill="#E8A882" opacity="0.48" />
          </svg>
        </div>

        <h1 className="hero-title fi d1">{tr.hero.title}</h1>
        <p className="hero-sub fi d2">{tr.hero.sub}</p>
        <p className="hero-tag fi d3">{tr.hero.tag}</p>
        <a href="#booking" className="cta fi d4">{tr.hero.cta}</a>
      </div>

      <div className="scroll-hint" aria-hidden>
        <span>{tr.hero.scroll}</span>
      </div>
    </section>
  )
}
