import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import AdminLayout from './components/layout/AdminLayout'
import StaffLayout from './components/layout/StaffLayout'
import ClientLayout from './components/layout/ClientLayout'

// Public pages
import LandingPage from './pages/public/LandingPage'
import ServicesPage from './pages/public/ServicesPage'

// Login
import LoginPage from './pages/login/LoginPage'

// Super Admin pages
import SuperAdminDashboard from './pages/super-admin/Dashboard'
import Admins from './pages/super-admin/Admins'
import Services from './pages/super-admin/Services'
import SuperAdminClients from './pages/super-admin/Clients'
import SuperAdminReservations from './pages/super-admin/Reservations'
import Reports from './pages/super-admin/Reports'
import Reviews from './pages/super-admin/Reviews'
import Settings from './pages/super-admin/Settings'
import ContactRequests from './pages/super-admin/ContactRequests'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import Clients from './pages/admin/Clients'
import AdminReservations from './pages/admin/Reservations'
import Timetable from './pages/admin/Timetable'
import SessionReports from './pages/admin/SessionReports'
import WhatsApp from './pages/admin/WhatsApp'

// Staff pages
import StaffReservations from './pages/staff/Reservations'
import StaffClients from './pages/staff/Clients'
import StaffCollections from './pages/staff/Collections'

// Client pages
import ClientOnboarding from './pages/client/Onboarding'
import ClientHome from './pages/client/Home'
import ClientBook from './pages/client/Book'
import ClientSessions from './pages/client/Sessions'
import ClientReports from './pages/client/Reports'
import ClientProfile from './pages/client/Profile'
import ClientReview from './pages/client/Review'

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

            {/* Client Portal */}
            <Route
              path="/client"
              element={
                <ProtectedRoute role="client">
                  <ClientLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="home" replace />} />
              <Route path="onboarding" element={<ClientOnboarding />} />
              <Route path="home" element={<ClientHome />} />
              <Route path="book" element={<ClientBook />} />
              <Route path="sessions" element={<ClientSessions />} />
              <Route path="reports" element={<ClientReports />} />
              <Route path="profile" element={<ClientProfile />} />
              <Route path="review/:reservationId" element={<ClientReview />} />
            </Route>

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
              <Route path="dashboard" element={<SuperAdminDashboard />} />
              <Route path="admins" element={<Admins />} />
              <Route path="clients" element={<SuperAdminClients />} />
              <Route path="services" element={<Services />} />
              <Route path="reservations" element={<SuperAdminReservations />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="contact-requests" element={<ContactRequests />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="reservations" element={<AdminReservations />} />
              <Route path="timetable" element={<Timetable />} />
              <Route path="session-reports" element={<SessionReports />} />
              <Route path="whatsapp" element={<WhatsApp />} />
            </Route>

            {/* Staff */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute role="staff">
                  <StaffLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="reservations" replace />} />
              <Route path="reservations" element={<StaffReservations />} />
              <Route path="clients" element={<StaffClients />} />
              <Route path="collections" element={<StaffCollections />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  )
}
