import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../context/LangContext'
import { galleryOrder } from '../assets/clinic'

/** The clinic's real interiors, in an asymmetric editorial grid + a lightbox. */
export default function Gallery() {
  const { tr } = useLang()
  const g = tr.gallery
  const [open, setOpen] = useState<number | null>(null)
  const count = galleryOrder.length

  const step = useCallback((d: number) => {
    setOpen(i => (i === null ? null : (i + d + count) % count))
  }, [count])

  // Arrow keys and Esc drive the lightbox; the page must not scroll behind it.
  useEffect(() => {
    if (open === null) return
    document.body.classList.add('is-locked')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-locked')
    }
  }, [open, step])

  const delays = ['', 'd1', 'd2', 'd3']

  return (
    <section id="gallery" className="section section--cream">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{g.label}</span>
          <h2 className="title reveal d1">{g.title} <span className="soft">{g.titleB}</span></h2>
          <p className="sub reveal d2">{g.sub}</p>
        </div>

        <div className="gal">
          {g.items.map((item, i) => (
            <button
              type="button"
              key={item.title}
              className={`gal__item reveal reveal--curtain ${delays[i]}`}
              onClick={() => setOpen(i)}
              aria-label={item.title}
            >
              <img src={galleryOrder[i]} alt={item.title} loading="lazy" />
              <span className="gal__zoom" aria-hidden>⤢</span>
              <span className="gal__cap">
                <b>{item.title}</b>
                <i>{item.sub}</i>
              </span>
            </button>
          ))}
        </div>

        <p className="sub reveal d3" style={{ textAlign: 'center', marginTop: '1.6rem', fontSize: '0.86rem' }}>
          {g.hint}
        </p>
      </div>

      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={g.items[open].title} onClick={() => setOpen(null)}>
          <button className="lightbox__x" onClick={() => setOpen(null)} aria-label="Close">✕</button>
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={e => { e.stopPropagation(); step(-1) }}
            aria-label="Previous"
          >‹</button>
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={e => { e.stopPropagation(); step(1) }}
            aria-label="Next"
          >›</button>
          <div onClick={e => e.stopPropagation()}>
            <img src={galleryOrder[open]} alt={g.items[open].title} />
            <div className="lightbox__cap">{g.items[open].title} — <i>{g.items[open].sub}</i></div>
          </div>
        </div>
      )}
    </section>
  )
}
