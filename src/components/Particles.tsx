import { useMemo } from 'react'

const CHARS = ['✦', '✧', '⋆', '✺', '❋', '⁕']

export function Particles() {
  const items = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      char: CHARS[i % CHARS.length],
      left: Math.random() * 100,
      sz: 10 + Math.random() * 14,
      dur: 10 + Math.random() * 15,
      dl: Math.random() * 14,
      drift: (Math.random() - 0.5) * 130,
    })), [])

  return (
    <div className="particles" aria-hidden>
      {items.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            '--sz': `${p.sz}px`,
            '--dur': `${p.dur}s`,
            '--dl': `${p.dl}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        >
          {p.char}
        </div>
      ))}
    </div>
  )
}

export function Petals() {
  const items = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 110 - 5,
      sz: 8 + Math.random() * 16,
      dur: 8 + Math.random() * 14,
      dl: Math.random() * 16,
      sw: (Math.random() - 0.4) * 130,
    })), [])

  return (
    <div className="petals" aria-hidden>
      {items.map(p => (
        <div
          key={p.id}
          className="petal"
          style={{
            left: `${p.left}%`,
            '--sz': `${p.sz}px`,
            '--dur': `${p.dur}s`,
            '--dl': `${p.dl}s`,
            '--sw': `${p.sw}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
