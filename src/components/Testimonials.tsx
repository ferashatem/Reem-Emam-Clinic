import { useLang } from '../context/LangContext'

type Item = ReturnType<typeof useLang>['tr']['testimonials']['items'][number]

function Card({ item }: { item: Item }) {
  return (
    <article className="review">
      <div className="review__stars" aria-hidden>★★★★★</div>
      <p className="review__text">{item.text}</p>
      <div className="review__foot">
        <div className="review__avatar" aria-hidden>{item.init}</div>
        <div>
          <div className="review__name">{item.name}</div>
          <div className="review__label">{item.label}</div>
        </div>
        <span className="review__rate">{item.rating}</span>
      </div>
    </article>
  )
}

/**
 * Two marquees drifting in opposite directions. Each row renders its list
 * twice so the -50% slide loops without a seam; hovering pauses both.
 */
export default function Testimonials() {
  const { tr } = useLang()
  const t = tr.testimonials
  const top = t.items.slice(0, 3)
  const bottom = t.items.slice(3, 6)

  return (
    <section id="testimonials" className="section section--cream reviews">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{t.label}</span>
          <h2 className="title reveal d1">{t.title} <span className="soft">{t.titleB}</span></h2>
        </div>
      </div>

      <div className="rmq reveal d2">
        <div className="rmq__row">
          {[...top, ...top].map((item, i) => <Card key={i} item={item} />)}
        </div>
        <div className="rmq__row rmq__row--rev">
          {[...bottom, ...bottom].map((item, i) => <Card key={i} item={item} />)}
        </div>
      </div>
    </section>
  )
}
