import { useLang } from '../context/LangContext'

/**
 * Gold marquee that separates the hero from the story.
 * The word list is rendered twice so the -50% slide loops seamlessly.
 */
export default function Ribbon() {
  const { tr } = useLang()

  const run = (
    <span>
      {tr.ribbon.map(word => (
        <span key={word} style={{ display: 'inline-flex', alignItems: 'center', gap: '2.2rem' }}>
          {word} <i>✦</i>
        </span>
      ))}
    </span>
  )

  return (
    <div className="ribbon" aria-hidden>
      <div className="ribbon__row">{run}{run}</div>
    </div>
  )
}
