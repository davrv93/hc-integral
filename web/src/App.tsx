import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Login } from '@/pages/Login'
import { Callback } from '@/pages/Callback'
import { Dashboard } from '@/pages/Dashboard'
import { Historias } from '@/pages/Historias'
import { HistoriaDetalle } from '@/pages/HistoriaDetalle'
import { Reportes } from '@/pages/Reportes'
import { Pacientes } from '@/pages/Pacientes'
import { MedicosUsuarios } from '@/pages/MedicosUsuarios'
import { NotFound } from '@/pages/NotFound'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/historias" element={<Historias />} />
        <Route path="/historias/:id" element={<HistoriaDetalle />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/pacientes" element={<Pacientes />} />
        <Route path="/medicos-usuarios" element={<MedicosUsuarios />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
