import { useLayoutEffect } from 'react'
import '../../App.css'
import Navbar from '../../components/Navbar'
import Hero from '../../components/Hero'
import About from '../../components/About'
import Services from '../../components/Services'
import WhyUs from '../../components/WhyUs'
import Testimonials from '../../components/Testimonials'
import Booking from '../../components/Booking'
import Footer from '../../components/Footer'

export default function LandingPage() {
  useLayoutEffect(() => {
    document.body.classList.add('landing-page')
    return () => document.body.classList.remove('landing-page')
  }, [])

  useLayoutEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('show'); observer.unobserve(e.target) } }),
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Navbar />
      <main className="lp-main">
        <Hero />
        <About />
        <Services />
        <WhyUs />
        <Testimonials />
        <Booking />
      </main>
      <Footer />
    </>
  )
}
