import { useLang } from '../context/LangContext'
import { photos } from '../assets/clinic'

export default function About() {
  const { tr } = useLang()
  const a = tr.about

  return (
    <section id="about" className="section section--cream about">
      <div className="wrap about__grid">
        <div className="about__art reveal reveal--left">
          <div className="about__photo">
            <img src={photos.lounge} alt={tr.gallery.items[1].title} loading="lazy" />
          </div>
          <div className="about__seal">
            <div>
              <div className="v">{tr.hero.stats[2].v}</div>
              <div className="l">{tr.hero.stats[2].l}</div>
            </div>
          </div>
        </div>

        <div className="about__body">
          <span className="eyebrow reveal">{a.label}</span>
          <h2 className="title reveal d1">{a.title} <span className="soft">{a.titleB}</span></h2>
          <div className="reveal d2" style={{ marginTop: '1.7rem' }}>
            <p className="lead">{a.p1}</p>
            <p>{a.p2}</p>
          </div>
          <blockquote className="quote reveal d3">{a.quote}</blockquote>
          <div className="tags reveal d4">
            {a.badges.map(b => <span key={b} className="tag">{b}</span>)}
          </div>
          <div className="sig reveal d5">{a.sign}</div>
        </div>
      </div>
    </section>
  )
}
