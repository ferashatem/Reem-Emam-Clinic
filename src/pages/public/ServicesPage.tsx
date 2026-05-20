import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveServices } from '../../services/firestore'
import { useAuth } from '../../context/AuthContext'
import PublicBookingModal from '../../components/PublicBookingModal'
import Navbar from '../../components/Navbar'
import '../../App.css'

interface Service {
  id: string
  name: string
  description?: string
  duration_minutes?: number
  price?: number
  is_active: boolean
}

const C = {
  deepRose: '#7B2D45',
  roseGold: '#C4876A',
  cream: '#FEF7F5',
  blush: '#F5D0DC',
  textMid: '#785060',
  textLight: '#A8788A',
  glassBg: 'rgba(255,248,246,0.72)',
  glassBorder: 'rgba(196,135,106,0.22)',
}

function SkeletonCard() {
  return (
    <div style={{
      background: C.glassBg,
      border: `1px solid ${C.glassBorder}`,
      borderRadius: '22px',
      padding: '2.4rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {[80, 55, 40, 120, 44].map((w, i) => (
        <div key={i} style={{
          height: i === 3 ? '60px' : '16px',
          width: `${w}%`,
          borderRadius: '8px',
          background: 'linear-gradient(90deg, #f0dde5 25%, #fae8ed 50%, #f0dde5 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
          margin: i === 0 ? '0 auto' : undefined,
        }} />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  )
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const { role, loading: authLoading } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    getActiveServices()
      .then(data => setServices(data as Service[]))
      .catch(() => setServices([]))
      .finally(() => setLoading(false))
  }, [])

  function handleBookClick(service: Service) {
    if (!authLoading && role === 'client') {
      navigate(`/client/book?service=${service.id}`)
    } else {
      setSelectedService(service)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <Navbar />

      {/* Page Hero */}
      <div style={{
        paddingTop: '8rem',
        paddingBottom: '4rem',
        textAlign: 'center',
        background: `radial-gradient(ellipse at 50% 0%, rgba(242,196,206,0.28), transparent 65%)`,
      }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.roseGold, marginBottom: '0.8rem' }}>
          SERVICES
        </p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
          fontWeight: 600,
          color: C.deepRose,
          marginBottom: '1rem',
        }}>
          خدماتنا
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1, maxWidth: 100, height: 1, background: `linear-gradient(90deg, transparent, ${C.roseGold})` }} />
          <span style={{ color: C.roseGold }}>✦</span>
          <div style={{ flex: 1, maxWidth: 100, height: 1, background: `linear-gradient(90deg, ${C.roseGold}, transparent)` }} />
        </div>
        <p style={{ fontSize: '1.05rem', color: C.textMid, maxWidth: '520px', margin: '0 auto', lineHeight: 1.8, fontWeight: 300 }}>
          اختاري الخدمة المناسبة ليكي واحجزي موعدك بكل سهولة
        </p>
      </div>

      {/* Services Grid */}
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 2rem 6rem' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.8rem' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🌸</span>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', color: C.deepRose, marginBottom: '0.5rem' }}>
              قريباً...
            </h3>
            <p style={{ color: C.textLight, fontSize: '0.95rem' }}>
              الخدمات قيد الإعداد، تواصلي معنا للحجز المباشر
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.8rem' }}>
            {services.map(service => (
              <ServiceCard key={service.id} service={service} onBook={handleBookClick} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        background: '#3A1B26',
        color: 'rgba(253,246,240,0.65)',
        textAlign: 'center',
        padding: '3rem 2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', background: `linear-gradient(90deg, ${C.deepRose}, ${C.roseGold}, #F5D0DC, ${C.roseGold}, ${C.deepRose})` }} />
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 600, color: C.roseGold, marginBottom: '0.4rem' }}>
          ريم غلو هاوس
        </div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', fontStyle: 'italic', color: C.blush, marginBottom: '1.5rem' }}>
          Beauty & Glow Clinic
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.45, letterSpacing: '0.1em' }}>
          © {new Date().getFullYear()} ريم غلو هاوس — جميع الحقوق محفوظة
        </div>
      </footer>

      {/* Booking Modal */}
      {selectedService && (
        <PublicBookingModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  )
}

function ServiceCard({ service, onBook }: { service: Service; onBook: (s: Service) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.glassBg,
        backdropFilter: 'blur(18px) saturate(1.35)',
        border: `1px solid ${hovered ? 'rgba(196,135,106,0.52)' : C.glassBorder}`,
        borderRadius: '22px',
        padding: '2.4rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.45s cubic-bezier(0.23,1,0.32,1)',
        transform: hovered ? 'translateY(-10px) scale(1.015)' : 'none',
        boxShadow: hovered ? '0 22px 65px rgba(123,45,69,0.16)' : '0 4px 20px rgba(123,45,69,0.06)',
        cursor: 'default',
      }}
    >
      {/* Glass highlight */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.42), transparent 55%)',
        borderRadius: '22px',
      }} />

      {/* Name */}
      <h3 style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '1.4rem',
        fontWeight: 600,
        color: C.deepRose,
        margin: 0,
        lineHeight: 1.3,
      }}>
        {service.name}
      </h3>

      {/* Description */}
      {service.description && (
        <p style={{
          fontSize: '0.9rem',
          color: C.textLight,
          lineHeight: 1.75,
          fontWeight: 300,
          margin: 0,
          flexGrow: 1,
        }}>
          {service.description}
        </p>
      )}

      {/* Badges */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: 'auto' }}>
        {service.duration_minutes != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.3rem 0.75rem',
            background: 'rgba(242,196,206,0.4)',
            border: '1px solid rgba(196,135,106,0.28)',
            borderRadius: '50px',
            fontSize: '0.8rem',
            color: C.deepRose,
            fontWeight: 500,
          }}>
            ⏱ {service.duration_minutes} دقيقة
          </span>
        )}
        {service.price != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.3rem 0.75rem',
            background: `linear-gradient(135deg, rgba(196,135,106,0.15), rgba(123,45,69,0.12))`,
            border: `1px solid rgba(196,135,106,0.35)`,
            borderRadius: '50px',
            fontSize: '0.8rem',
            color: C.deepRose,
            fontWeight: 600,
          }}>
            💰 {service.price} جنيه
          </span>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => onBook(service)}
        style={{
          width: '100%',
          padding: '0.8rem',
          background: hovered
            ? 'linear-gradient(135deg, #C4876A, #7B2D45)'
            : 'linear-gradient(135deg, rgba(196,135,106,0.18), rgba(123,45,69,0.12))',
          color: hovered ? 'white' : C.deepRose,
          border: `1.5px solid ${hovered ? 'transparent' : 'rgba(196,135,106,0.4)'}`,
          borderRadius: '12px',
          fontSize: '0.95rem',
          fontWeight: 700,
          fontFamily: 'Tajawal, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.35s ease',
          marginTop: '0.5rem',
          letterSpacing: '0.03em',
        }}
      >
        احجزي دلوقتي 🌸
      </button>
    </div>
  )
}
