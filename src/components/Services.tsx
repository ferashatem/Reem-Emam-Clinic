import { useLang } from '../context/LangContext'

export default function Services() {
  const { tr } = useLang()
  const delays = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']

  return (
    <section id="services" className="services-section">
      <div className="container">
        <p className="section-label fi">{tr.services.label}</p>
        <h2 className="section-title fi d1">{tr.services.title}</h2>
        <div className="divider fi d2"><span>✦</span></div>

        <div className="services-grid">
          {tr.services.items.map((item, i) => (
            <div key={i} className={`scard fi ${delays[i]}`}>
              <span className="scard-icon">{item.icon}</span>
              <div className="scard-name">{item.name}</div>
              <div className="scard-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
