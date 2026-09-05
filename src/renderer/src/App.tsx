import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { RequireAuth, RequirePermission } from './features/auth/guards'
import { LoginPage } from './features/auth/LoginPage'
import { AppShell } from './layouts/AppShell'
import { HomePage } from './features/home/HomePage'
import { TicketsPage } from './features/tickets/TicketsPage'
import { TicketDetailPage } from './features/tickets/TicketDetailPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
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
                  <PlaceholderPage
                    title="Boletas sin vender"
                    description="Agrupación por vendedor, filtros y export Excel."
                  />
                </RequirePermission>
              }
            />
            <Route
              path="nueva-venta"
              element={
                <RequirePermission permission="tickets:sell">
                  <PlaceholderPage
                    title="Nueva venta"
                    description="Formulario de venta con comprador, vendedor y pago inicial."
                  />
                </RequirePermission>
              }
            />
            <Route
              path="abonos"
              element={
                <RequirePermission permission="payments:create">
                  <PlaceholderPage
                    title="Abonos"
                    description="Registro de abonos con validación de saldo y origen MANUAL/VOZ."
                  />
                </RequirePermission>
              }
            />
            <Route
              path="compradores"
              element={
                <RequirePermission permission="buyers:manage">
                  <PlaceholderPage title="Compradores" description="CRUD y consulta de compradores." />
                </RequirePermission>
              }
            />
            <Route
              path="vendedores"
              element={
                <RequirePermission permission="sellers:manage">
                  <PlaceholderPage
                    title="Vendedores"
                    description="Perfiles, métricas y boletas asignadas."
                  />
                </RequirePermission>
              }
            />
            <Route
              path="reportes"
              element={
                <RequirePermission permission="reports:operational">
                  <PlaceholderPage title="Reportes" description="Reportes operativos y filtros." />
                </RequirePermission>
              }
            />
            <Route path="admin/dashboard" element={<DashboardPage />} />
            <Route
              path="admin/ingresos"
              element={
                <RequirePermission permission="incomes:view">
                  <PlaceholderPage title="Ingresos" description="Consulta de ingresos (ADMIN)." />
                </RequirePermission>
              }
            />
            <Route
              path="admin/egresos"
              element={
                <RequirePermission permission="expenses:manage">
                  <PlaceholderPage title="Egresos" description="Registro y consulta de egresos." />
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
                  <PlaceholderPage title="Auditoría" description="Historial append-only de operaciones." />
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
                  <PlaceholderPage title="Backups" description="Copias de seguridad y restauración." />
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
