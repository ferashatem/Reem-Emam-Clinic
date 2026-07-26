/**
 * The clinic's signage logo, redrawn as line art:
 * a crescent ring around a woman's profile, with a leaf sprig and sparkles.
 * Stroked in metal-leaf gold so it sits on both wine and cream backgrounds.
 */

let seq = 0

interface Props {
  /** `gold` = metal gradient (default) · `mono` = inherits currentColor */
  tone?: 'gold' | 'mono'
  className?: string
}

/** four-point star, drawn as a filled diamond with pinched waist */
function sparkle(x: number, y: number, s: number) {
  const w = s * 0.24
  return `M${x} ${y - s}L${x + w} ${y - w}L${x + s} ${y}L${x + w} ${y + w}L${x} ${y + s}L${x - w} ${y + w}L${x - s} ${y}L${x - w} ${y - w}Z`
}

export default function BrandMark({ tone = 'gold', className }: Props) {
  // Gradient ids must stay unique — the mark renders several times per page.
  const id = `bm${seq++}`
  const stroke = tone === 'gold' ? `url(#${id})` : 'currentColor'

  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="8%" y1="4%" x2="92%" y2="96%">
          <stop offset="0%" stopColor="#A6803F" />
          <stop offset="34%" stopColor="#E8D3A8" />
          <stop offset="52%" stopColor="#F7EDD9" />
          <stop offset="72%" stopColor="#D9B87C" />
          <stop offset="100%" stopColor="#A6803F" />
        </linearGradient>
      </defs>

      <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* crescent ring — an open circle, gap toward the lower right */}
        <circle
          cx="60" cy="60" r="45"
          strokeDasharray="196 87"
          transform="rotate(-52 60 60)"
        />

        {/* profile: forehead · nose · lips · chin */}
        <path d="M50 33 C62 34 68.5 42.5 67.5 49.5 C67 51.5 70.5 53.5 70.5 55.5 C70.5 57.5 66.5 58 65.5 59 C67.5 60.5 68 62.5 66 64.5 C64.5 66 64.5 68.5 62.5 70.5 C60.5 72.5 56.5 73.5 52.5 73.5" />

        {/* hair — flowing strands sweeping over the crown and down the left */}
        <path d="M50 33 C46 24.5 52.5 17.5 61 17.5 C71.5 17.5 78 24.5 75.5 33.5" strokeWidth="1.7" />
        <path d="M50 33 C38.5 35 32.5 47 34.5 59 C35.5 67 40 73.5 46 78" strokeWidth="1.7" />
        <path d="M45 26.5 C33 31.5 25.5 45.5 28.5 60.5 C30 68.5 34 75 39.5 79.5" strokeWidth="1.4" opacity="0.72" />
        <path d="M56 20 C43.5 22.5 34 33 31.5 46" strokeWidth="1.3" opacity="0.55" />

        {/* shoulder line, closing the composition */}
        <path d="M52.5 73.5 C56 78.5 58 84 58 89.5" strokeWidth="1.5" opacity="0.7" />

        {/* leaf sprig at the crown */}
        <g strokeWidth="1.5">
          <path d="M75.5 33.5 C81 28 87 22.5 93 19" />
          <path d="M79 30 C79.5 25.5 82.5 22.5 86.5 22 C86 26.5 83 29.5 79 30Z" />
          <path d="M84.5 25 C85.5 20.5 88.5 17.5 92.5 17 C92 21.5 89 24.5 84.5 25Z" />
          <path d="M76.5 35.5 C72.5 34.5 70 31 70 27 C74 27.5 76.5 31 76.5 35.5Z" opacity="0.8" />
        </g>
      </g>

      {/* sparkles */}
      <g fill={stroke}>
        <path d={sparkle(41, 42, 6.5)} />
        <path d={sparkle(82, 47, 4.6)} opacity="0.85" />
        <path d={sparkle(88, 60, 3)} opacity="0.6" />
        <path d={sparkle(35, 30, 3.4)} opacity="0.7" />
      </g>
    </svg>
  )
}
