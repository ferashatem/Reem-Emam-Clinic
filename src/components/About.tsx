import { useLang } from '../context/LangContext'

export default function About() {
  const { tr } = useLang()
  return (
    <section id="about" className="about-section">
      <div className="container">
        <p className="section-label fi">{tr.about.label}</p>
        <h2 className="section-title fi d1">{tr.about.title}</h2>
        <div className="divider fi d2"><span>✦</span></div>

        <div className="about-grid">
          <div className="about-text fi d1">
            <p>{tr.about.p1}</p>
            <p>{tr.about.p2}</p>
            <p>{tr.about.p3}</p>
            <blockquote className="about-quote">{tr.about.quote}</blockquote>
          </div>

          <div className="about-art fi d3">
            <div className="orb-rings">
              <div className="oring" /><div className="oring" /><div className="oring" />
            </div>
            <div className="orb" />
          </div>
        </div>
      </div>
    </section>
  )
}
