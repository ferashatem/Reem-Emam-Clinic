import { useLang } from '../context/LangContext'

export default function Testimonials() {
  const { tr } = useLang()
  const t = tr.testimonials
  const items = t.items.slice(0, 6)
  const delays = ['', 'd1', 'd2']

  return (
    <section id="testimonials" className="section">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{t.label}</span>
          <h2 className="title reveal d1">{t.title} <span className="soft">{t.titleB}</span></h2>
        </div>

        <div className="reviews__grid">
          {items.map((item, i) => (
            <div key={i} className={`review reveal ${delays[i % 3]}`}>
              <div className="review__mark">”</div>
              <p className="review__text">{item.text}</p>
              <div className="review__foot">
                <div className="review__avatar">{item.init}</div>
                <div>
                  <div className="review__name">{item.name}</div>
                  <div className="review__label">{item.label}</div>
                </div>
                <span className="review__rate">★ {item.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
