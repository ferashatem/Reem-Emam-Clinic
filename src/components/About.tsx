import { useLang } from '../context/LangContext'

export default function About() {
  const { tr } = useLang()
  const a = tr.about
  return (
    <section id="about" className="section">
      <div className="wrap about__grid">
        <div className="about__art reveal">
          <div className="about__arch">🌸</div>
          <div className="about__badge">
            <div className="v">{tr.hero.stats[2].v}</div>
            <div className="l">{tr.hero.stats[2].l}</div>
          </div>
        </div>

        <div className="about__body">
          <span className="eyebrow reveal">{a.label}</span>
          <h2 className="title reveal d1">{a.title} <span className="soft">{a.titleB}</span></h2>
          <div className="reveal d2" style={{ marginTop: '1.6rem' }}>
            <p>{a.p1}</p>
            <p>{a.p2}</p>
          </div>
          <blockquote className="quote reveal d2">{a.quote}</blockquote>
          <div className="tags reveal d3">
            {a.badges.map(b => <span key={b} className="tag">{b}</span>)}
          </div>
        </div>
      </div>
    </section>
  )
}
