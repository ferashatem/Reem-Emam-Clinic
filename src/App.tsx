import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import AdminLayout from './components/layout/AdminLayout'
import StaffLayout from './components/layout/StaffLayout'

// Public pages
import LandingPage from './pages/public/LandingPage'
import ServicesPage from './pages/public/ServicesPage'

// Login
import LoginPage from './pages/login/LoginPage'

// Shared internal pages — same screens for the partners and the assistant
import Dashboard from './pages/shared/Dashboard'
import ClinicDay from './pages/shared/ClinicDay'
import Reservations from './pages/shared/Reservations'
import Patients from './pages/shared/Patients'
import PatientFile from './pages/shared/PatientFile'
import Accounting from './pages/shared/Accounting'
import Payments from './pages/shared/Payments'

// Admin-only pages
import Timetable from './pages/admin/Timetable'
import SessionReports from './pages/admin/SessionReports'
import WhatsApp from './pages/admin/WhatsApp'

// Super admin pages
import Admins from './pages/super-admin/Admins'
import Services from './pages/super-admin/Services'
import Reports from './pages/super-admin/Reports'
import Reviews from './pages/super-admin/Reviews'
import ContactRequests from './pages/super-admin/ContactRequests'

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
        </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  )
}
