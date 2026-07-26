import { useLayoutEffect, useEffect, useRef } from 'react'
import '../../App.css'
import Navbar from '../../components/Navbar'
import Hero from '../../components/Hero'
import Ribbon from '../../components/Ribbon'
import About from '../../components/About'
import Services from '../../components/Services'
import Gallery from '../../components/Gallery'
import WhyUs from '../../components/WhyUs'
import Testimonials from '../../components/Testimonials'
import Booking from '../../components/Booking'
import Footer from '../../components/Footer'

export default function LandingPage() {
  const bar = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  // Reveal-on-scroll. Re-runs after paint so the sections mounted below are caught.
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('show'); observer.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
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
        <About />
        <Services />
        <Gallery />
        <WhyUs />
        <Testimonials />
        <Booking />
      </main>
      <Footer />
    </>
  )
}
