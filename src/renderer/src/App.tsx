import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth, RequirePermission } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { AppShell } from './layouts/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from 'sonner'

const HomePage = lazy(() => import('./features/home/HomePage').then((m) => ({ default: m.HomePage })))
const TicketsPage = lazy(() =>
  import('./features/tickets/TicketsPage').then((m) => ({ default: m.TicketsPage }))
)
const TicketDetailPage = lazy(() =>
  import('./features/tickets/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage }))
)
const PaymentsPage = lazy(() =>
  import('./features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage }))
)
const BuyersPage = lazy(() =>
  import('./features/buyers/BuyersPage').then((m) => ({ default: m.BuyersPage }))
)
const SellersPage = lazy(() =>
  import('./features/sellers/SellersPage').then((m) => ({ default: m.SellersPage }))
)
const SettlementsPage = lazy(() =>
  import('./features/settlements/SettlementsPage').then((m) => ({ default: m.SettlementsPage }))
)
const UnsoldTicketsPage = lazy(() =>
  import('./features/unsold/UnsoldTicketsPage').then((m) => ({ default: m.UnsoldTicketsPage }))
)
const IncomesPage = lazy(() =>
  import('./features/incomes/IncomesPage').then((m) => ({ default: m.IncomesPage }))
)
const ExpensesPage = lazy(() =>
  import('./features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage }))
)
const ReportsPage = lazy(() =>
  import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))
)
const BackupsPage = lazy(() =>
  import('./features/backups/BackupsPage').then((m) => ({ default: m.BackupsPage }))
)
const AuditPage = lazy(() =>
  import('./features/audit/AuditPage').then((m) => ({ default: m.AuditPage }))
)
const UsersPage = lazy(() =>
  import('./features/users/UsersPage').then((m) => ({ default: m.UsersPage }))
)
const PaymentMethodsPage = lazy(() =>
  import('./features/paymentMethods/PaymentMethodsPage').then((m) => ({
    default: m.PaymentMethodsPage
  }))
)
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Cargando…</p>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="boletas" element={<TicketsPage />} />
            <Route path="boletas/:number" element={<TicketDetailPage />} />
            <Route
              path="boletas-sin-vender"
              element={
                <RequirePermission permission="unsold:view">
                  <UnsoldTicketsPage />
                </RequirePermission>
              }
            />
            <Route path="nueva-venta" element={<Navigate to="/boletas" replace />} />
            <Route
              path="abonos"
              element={
                <RequirePermission permission="payments:create">
                  <PaymentsPage />
                </RequirePermission>
              }
            />
            <Route
              path="liquidaciones"
              element={
                <RequirePermission permission="settlements:manage">
                  <SettlementsPage />
                </RequirePermission>
              }
            />
            <Route
              path="compradores"
              element={
                <RequirePermission permission="buyers:manage">
                  <BuyersPage />
                </RequirePermission>
              }
            />
            <Route
              path="vendedores"
              element={
                <RequirePermission permission="sellers:manage">
                  <SellersPage />
                </RequirePermission>
              }
            />
            <Route
              path="reportes"
              element={
                <RequirePermission permission="reports:operational">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route path="admin/dashboard" element={<Navigate to="/" replace />} />
            <Route
              path="admin/ingresos"
              element={
                <RequirePermission permission="incomes:view">
                  <IncomesPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/egresos"
              element={
                <RequirePermission permission="expenses:manage">
                  <ExpensesPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/usuarios"
              element={
                <RequirePermission permission="users:manage">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/metodos-pago"
              element={
                <RequirePermission permission="payment_methods:manage">
                  <PaymentMethodsPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/auditoria"
              element={
                <RequirePermission permission="audit:view">
                  <AuditPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/configuracion"
              element={
                <RequirePermission permission="settings:manage">
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="admin/backups"
              element={
                <RequirePermission permission="backups:manage">
                  <BackupsPage />
                </RequirePermission>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
      </ErrorBoundary>
      <Toaster richColors position="top-right" toastOptions={{ className: 'font-sans' }} />
    </AuthProvider>
  )
}
