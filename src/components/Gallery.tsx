import { useLang } from '../context/LangContext'
import { galleryOrder } from '../assets/clinic'

/**
 * The clinic's four interior shots on a single drifting rail. Like the ribbon
 * and the reviews, the list renders twice so the -50% slide loops without a
 * seam; hovering (or a finger held on the rail) pauses it.
 */
export default function Gallery() {
  const { tr } = useLang()
  const g = tr.gallery
  const shots = g.items.map((item, i) => ({ ...item, src: galleryOrder[i] }))

  return (
    <section id="gallery" className="section section--blush gallery">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{g.label}</span>
          <h2 className="title reveal d1">{g.title} <span className="soft">{g.titleB}</span></h2>
          <p className="sub reveal d2">{g.sub}</p>
        </div>
      </div>

      <div className="gmq reveal d3">
        <div className="gmq__row">
          {[...shots, ...shots].map((shot, i) => (
            <figure className="gal__item" key={i}>
              {/* the second run is decoration — only the first is announced */}
              <img src={shot.src} alt={i < shots.length ? shot.title : ''} loading="lazy" />
              <figcaption className="gal__cap">
                <b>{shot.title}</b>
                <i>{shot.sub}</i>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
