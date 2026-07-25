import { useLang } from '../context/LangContext'

export default function WhyUs() {
  const { tr } = useLang()
  const w = tr.why
  const delays = ['', 'd1', 'd2']

  return (
    <section id="why-us" className="section section--wine">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{w.label}</span>
          <h2 className="title reveal d1">{w.title} <span className="soft">{w.titleB}</span></h2>
        </div>

        <div className="why__grid">
          {w.items.map((item, i) => (
            <div key={i} className={`why__item reveal ${delays[i]}`}>
              <span className="why__num">{item.num}</span>
              <div className="why__icon">{item.icon}</div>
              <h3 className="why__title">{item.title}</h3>
              <p className="why__text">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
