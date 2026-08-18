import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ProtectedRoute from './components/layout/ProtectedRoute'

// The landing page is what a visitor asks for by name, so it ships in the
// first download. Everything else — the whole dashboard, MUI, the admin
// screens — is fetched only by the person who actually opens it.
import LandingPage from './pages/public/LandingPage'

const ServicesPage = lazy(() => import('./pages/public/ServicesPage'))
const LoginPage = lazy(() => import('./pages/login/LoginPage'))

const SuperAdminLayout = lazy(() => import('./components/layout/SuperAdminLayout'))
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'))
const StaffLayout = lazy(() => import('./components/layout/StaffLayout'))

const Dashboard = lazy(() => import('./pages/shared/Dashboard'))
const ClinicDay = lazy(() => import('./pages/shared/ClinicDay'))
const Reservations = lazy(() => import('./pages/shared/Reservations'))
const Patients = lazy(() => import('./pages/shared/Patients'))
const PatientFile = lazy(() => import('./pages/shared/PatientFile'))
const Accounting = lazy(() => import('./pages/shared/Accounting'))
const Payments = lazy(() => import('./pages/shared/Payments'))

const Timetable = lazy(() => import('./pages/admin/Timetable'))
const SessionReports = lazy(() => import('./pages/admin/SessionReports'))
const WhatsApp = lazy(() => import('./pages/admin/WhatsApp'))

const Admins = lazy(() => import('./pages/super-admin/Admins'))
const Services = lazy(() => import('./pages/super-admin/Services'))
const Reports = lazy(() => import('./pages/super-admin/Reports'))
const Reviews = lazy(() => import('./pages/super-admin/Reviews'))
const ContactRequests = lazy(() => import('./pages/super-admin/ContactRequests'))

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
          <BrowserRouter>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  fontFamily: 'Tajawal, sans-serif',
                  direction: 'rtl',
                  borderRadius: '12px',
                  border: '1px solid #F2C4CE',
                },
                success: { iconTheme: { primary: '#8B3A52', secondary: '#FDF6F0' } },
              }}
            />
            <Suspense fallback={<RouteFallback />}>
          <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Super Admin */}
              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute role="super_admin">
                    <SuperAdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clinic-day" element={<ClinicDay />} />
                <Route path="reservations" element={<Reservations />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:clientId" element={<PatientFile />} />
                <Route path="payments" element={<Payments />} />
                <Route path="accounting" element={<Accounting />} />
                <Route path="admins" element={<Admins />} />
                <Route path="services" element={<Services />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="contact-requests" element={<ContactRequests />} />
                {/* Old links kept working */}
                <Route path="clients" element={<Navigate to="/super-admin/patients" replace />} />
                <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
              </Route>

              {/* Admin — Reem & Rania, the partners */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute role="admin">
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="clinic-day" element={<ClinicDay />} />
                <Route path="reservations" element={<Reservations />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:clientId" element={<PatientFile />} />
                <Route path="payments" element={<Payments />} />
                <Route path="accounting" element={<Accounting />} />
                <Route path="session-reports" element={<SessionReports />} />
                <Route path="timetable" element={<Timetable />} />
                <Route path="whatsapp" element={<WhatsApp />} />
                <Route path="clients" element={<Navigate to="/admin/patients" replace />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>

              {/* Staff — the assistant */}
              <Route
                path="/staff"
                element={
                  <ProtectedRoute role="staff">
                    <StaffLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="clinic-day" replace />} />
                <Route path="clinic-day" element={<ClinicDay />} />
                <Route path="reservations" element={<Reservations />} />
                {/* The assistant takes money from the close-session sheet on
                    «يوم العيادة», so there is no payments screen here — old
                    bookmarks fall through to the catch-all below. */}
                <Route path="*" element={<Navigate to="/staff/clinic-day" replace />} />
              </Route>

              {/* The client portal is gone — anything pointing at it lands on the site */}
              <Route path="/client/*" element={<Navigate to="/" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  )
}

/** Shown while a route's chunk is on its way — a beat, not a blank page. */
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDF6F0' }}>
      <div
        className="w-9 h-9 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: '#F2C4CE', borderTopColor: 'transparent' }}
      />
    </div>
  )
}
