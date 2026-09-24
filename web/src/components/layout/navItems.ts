import { BarChart3, FileText, Home, Stethoscope, Users } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: 'Inicio', shortLabel: 'Inicio', icon: Home, end: true },
  { to: '/historias', label: 'Historias clínicas', shortLabel: 'Historias', icon: FileText },
  { to: '/pacientes', label: 'Pacientes', shortLabel: 'Pacientes', icon: Users },
  { to: '/reportes', label: 'Reportes', shortLabel: 'Reportes', icon: BarChart3 },
  { to: '/medicos-usuarios', label: 'Médicos y usuarios', shortLabel: 'Equipo', icon: Stethoscope },
] as const
