import { useLang } from '../context/LangContext'

export default function WhyUs() {
  const { tr } = useLang()
  const delays = ['d1', 'd2', 'd3']

  return (
    <section id="why-us" className="why-section">
      <div className="container">
        <p className="section-label fi">{tr.why.label}</p>
        <h2 className="section-title fi d1">{tr.why.title}</h2>
        <div className="divider fi d2"><span>✦</span></div>

        <div className="why-grid">
          {tr.why.items.map((item, i) => (
            <div key={i} className={`wblock fi ${delays[i]}`}>
              <span className="w-num">{item.num}</span>
              <div className="w-icon">{item.icon}</div>
              <div className="w-title">{item.title}</div>
              <div className="w-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
