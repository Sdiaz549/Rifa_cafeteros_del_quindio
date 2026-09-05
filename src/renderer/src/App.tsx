import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth, RequirePermission } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { AppShell } from './layouts/AppShell'
import { HomePage } from './features/home/HomePage'
import { TicketsPage } from './features/tickets/TicketsPage'
import { TicketDetailPage } from './features/tickets/TicketDetailPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { NewSalePage } from './features/sales/NewSalePage'
import { PaymentsPage } from './features/payments/PaymentsPage'
import { BuyersPage } from './features/buyers/BuyersPage'
import { SellersPage } from './features/sellers/SellersPage'
import { SettlementsPage } from './features/settlements/SettlementsPage'
import { UnsoldTicketsPage } from './features/unsold/UnsoldTicketsPage'
import { IncomesPage } from './features/incomes/IncomesPage'
import { ExpensesPage } from './features/expenses/ExpensesPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { BackupsPage } from './features/backups/BackupsPage'
import { AuditPage } from './features/audit/AuditPage'
import { PlaceholderPage } from './features/common/PlaceholderPage'
import { Toaster } from 'sonner'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
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
            <Route
              path="nueva-venta"
              element={
                <RequirePermission permission="tickets:sell">
                  <NewSalePage />
                </RequirePermission>
              }
            />
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
            <Route path="admin/dashboard" element={<DashboardPage />} />
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
                  <PlaceholderPage title="Usuarios" description="Administración de usuarios y roles." />
                </RequirePermission>
              }
            />
            <Route
              path="admin/metodos-pago"
              element={
                <RequirePermission permission="payment_methods:manage">
                  <PlaceholderPage title="Métodos de pago" description="Catálogo de métodos de pago." />
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
                  <PlaceholderPage title="Configuración" description="Parámetros de la rifa y backups." />
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
      </HashRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
