import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReporteSerieMensual } from '@/lib/types'

export function SerieMensualChart({ data }: { data: ReporteSerieMensual[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#EEF2F1" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#5A6B6F' }} axisLine={{ stroke: '#DCE4E2' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#5A6B6F' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 10, borderColor: '#DCE4E2', fontSize: 13 }}
          labelStyle={{ color: '#1C2B2E', fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line type="monotone" dataKey="creadas" name="Creadas" stroke="#3E6FC2" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="completadas" name="Completadas" stroke="#0A8F80" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
