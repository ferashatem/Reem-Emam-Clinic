import { useEffect, useRef } from 'react'

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const mx = useRef(0)
  const my = useRef(0)
  const rx = useRef(0)
  const ry = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.current = e.clientX
      my.current = e.clientY
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx.current - 5}px, ${my.current - 5}px)`
      }
    }
    document.addEventListener('mousemove', onMove)

    const animRing = () => {
      rx.current += (mx.current - rx.current - 18) * 0.11
      ry.current += (my.current - ry.current - 18) * 0.11
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx.current}px, ${ry.current}px)`
      }
      rafRef.current = requestAnimationFrame(animRing)
    }
    rafRef.current = requestAnimationFrame(animRing)

    const grow = () => {
      if (ringRef.current) { ringRef.current.style.width = '56px'; ringRef.current.style.height = '56px' }
    }
    const shrink = () => {
      if (ringRef.current) { ringRef.current.style.width = '36px'; ringRef.current.style.height = '36px' }
    }

    const targets = document.querySelectorAll('a, button, .scard, .wblock, .tcard')
    targets.forEach(el => { el.addEventListener('mouseenter', grow); el.addEventListener('mouseleave', shrink) })

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
      targets.forEach(el => { el.removeEventListener('mouseenter', grow); el.removeEventListener('mouseleave', shrink) })
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  )
}
