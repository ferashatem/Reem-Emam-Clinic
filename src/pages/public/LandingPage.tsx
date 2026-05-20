import { useLayoutEffect } from 'react'
import '../../App.css'
import Cursor from '../../components/Cursor'
import { Particles } from '../../components/Particles'
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
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.fi').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Cursor />
      <Particles />
      <Navbar />
      <main>
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
