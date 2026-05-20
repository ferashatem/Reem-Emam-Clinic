import { useLang } from '../context/LangContext'

export default function Testimonials() {
  const { tr } = useLang()
  const doubled = [...tr.testimonials.items, ...tr.testimonials.items]

  return (
    <section id="testimonials" className="testimonials-section">
      <div className="container">
        <p className="section-label fi">{tr.testimonials.label}</p>
        <h2 className="section-title fi d1">{tr.testimonials.title}</h2>
        <div className="divider fi d2"><span>✦</span></div>
      </div>

      <div className="marquee-wrap fi d3">
        <div className="marquee-track">
          {doubled.map((item, i) => (
            <div key={i} className="tcard">
              <div className="t-stars">★★★★★</div>
              <div className="t-text">{item.text}</div>
              <div className="t-author">
                <div className="t-avatar">{item.init}</div>
                <div>
                  <div className="t-name">{item.name}</div>
                  <div className="t-label">{item.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
