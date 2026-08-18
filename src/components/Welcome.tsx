import { useLang } from '../context/LangContext'

/**
 * The reception section — it stands where the reviews used to.
 *
 * A brand-new clinic has no reviews to show, and inventing them is the one
 * thing that would cost it the trust it is trying to earn. So this says the
 * honest version instead: we have just opened, here is what your first visit
 * looks like, come and judge for yourself. It gets swapped back for
 * `<Testimonials />` once there are real ones to show.
 */
export default function Welcome() {
  const { tr } = useLang()
  const w = tr.welcome

  return (
    <section id="welcome" className="section section--blush wel">
      <div className="wrap">
        <div className="head">
          <span className="eyebrow reveal">{w.label}</span>
          <h2 className="title reveal d1">
            {w.title} <span className="soft">{w.titleB}</span>
          </h2>
          <p className="sub reveal d2">{w.sub}</p>
        </div>

        <div className="wel__cards">
          {w.cards.map((c, i) => (
            <article key={c.title} className={`wel__card reveal d${i + 1}`}>
              <span className="wel__ico" aria-hidden>{c.icon}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </article>
          ))}
        </div>

        {/* What actually happens if she says yes — the unknown is most of what
            keeps a first-time visitor from booking. */}
        <div className="wel__steps reveal d2">
          <h3 className="wel__steps-title">{w.stepsTitle}</h3>
          <ol>
            {w.steps.map(s => (
              <li key={s.num}>
                <span className="wel__num" aria-hidden>{s.num}</span>
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="wel__cta reveal d3">
          <a href="#booking" className="btn btn--primary"><span>{w.cta}</span></a>
          <p className="wel__note">{w.note}</p>
        </div>
      </div>
    </section>
  )
}
