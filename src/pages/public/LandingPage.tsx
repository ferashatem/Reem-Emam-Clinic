import { useLayoutEffect, useEffect, useRef } from 'react'
import '../../App.css'
import Navbar from '../../components/Navbar'
import Hero from '../../components/Hero'
import Ribbon from '../../components/Ribbon'
import Gallery from '../../components/Gallery'
import Testimonials from '../../components/Testimonials'
import Booking from '../../components/Booking'
import Footer from '../../components/Footer'

export default function LandingPage() {
  const bar = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  // Reveal-on-scroll. A hidden section is worse than an un-animated one, so the
  // slightest sliver counts as "in view", and anything the page has already
  // scrolled past (a #hash landing, a tall card on a phone) reveals outright.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('show'))
      return
    }
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (!e.isIntersecting && e.boundingClientRect.top > 0) return
        e.target.classList.add('show')
        observer.unobserve(e.target)
      }),
      { threshold: 0, rootMargin: '0px 0px -8% 0px' }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Scroll progress bar — one rAF-throttled write of a CSS variable.
  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const max = document.documentElement.scrollHeight - window.innerHeight
        bar.current?.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div className="progress" ref={bar} aria-hidden />
      <Navbar onDark />
      <main className="lp-main">
        <Hero />
        <Ribbon />
        <Gallery />
        <Testimonials />
        <Booking />
      </main>
      <Footer />
    </>
  )
}
