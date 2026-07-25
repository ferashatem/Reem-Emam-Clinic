import { useLang } from '../context/LangContext'

export default function Services() {
  const { tr } = useLang()
  const s = tr.services
  const delays = ['', 'd1', 'd2', 'd3', 'd4', 'd5']

  return (
    <section id="services" className="section section--blush">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{s.label}</span>
          <h2 className="title reveal d1">{s.title} <span className="soft">{s.titleB}</span></h2>
          <p className="sub reveal d2">{s.sub}</p>
        </div>

        <div className="cards">
          {s.items.map((item, i) => (
            <div key={i} className={`card reveal ${delays[i % 3]}`}>
              <div className="card__icon">{item.icon}</div>
              <div className="card__tag">{item.tag}</div>
              <h3 className="card__title">{item.name}</h3>
              <p className="card__text">{item.desc}</p>
              <a href="#booking" className="card__link">
                {s.cta} <span>{tr.dir === 'rtl' ? '←' : '→'}</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
