import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import type { ReportKind, ReportResult } from '@shared/types'
import { useAuth } from '../auth/AuthContext'

const MONEY_KINDS: ReportKind[] = [
  'ingresos_por_dia',
  'ventas_por_vendedor',
  'recaudo_por_vendedor',
  'metodos_de_pago',
  'egresos_por_categoria',
  'pendientes_liquidacion',
]

export function ReportsPage() {
  const { can } = useAuth()
  const canExport = can('export:full')
  const [kinds, setKinds] = useState<Array<{ kind: ReportKind; title: string }>>([])
  const [kind, setKind] = useState<ReportKind | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [result, setResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await window.api.reports.listKinds()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setKinds(res.data)
      if (res.data[0]) setKind(res.data[0].kind)
    })()
  }, [])

  async function run() {
    if (!kind) {
      toast.error('Seleccione un reporte')
      return
    }
    setLoading(true)
    const res = await window.api.reports.run({
      kind,
      from: from || undefined,
      to: to || undefined
    })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setResult(res.data)
  }

  async function exportExcel() {
    setExporting(true)
    const res = await window.api.export.excel({
      from: from || undefined,
      to: to || undefined
    })
    setExporting(false)
    if (!res.ok) {
      if (res.error !== 'Exportación cancelada.') toast.error(res.error)
      return
    }
    toast.success(`Excel exportado (${res.data.sheetCount} hojas)`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Reportes</h1>
          <p className="text-sm text-ink-muted">
            Consultas operativas y financieras con filtros de fecha.
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50 disabled:opacity-50"
          >
            {exporting ? 'Exportando…' : 'Exportar Excel completo'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Reporte</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ReportKind)}
            className="rounded-xl border border-line px-3 py-2"
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-muted">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-line px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || !kind}
          className="rounded-xl bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Generando…' : 'Generar'}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-brand-900">{result.title}</h2>
              <p className="text-sm text-ink-muted">{result.rows.length} filas</p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Total</p>
              <p className="font-display text-xl font-bold text-brand-900">
                {MONEY_KINDS.includes(result.kind)
                  ? formatCop(result.total)
                  : result.total.toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {result.rows.length === 0 ? (
              <p className="p-6 text-sm text-ink-muted">Sin datos para el rango seleccionado.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={`${row.label}-${row.value}-${row.meta ?? ''}`} className="border-b border-line/70">
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3">
                        {MONEY_KINDS.includes(result.kind)
                          ? formatCop(row.value)
                          : row.value.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.meta ?? (row.secondary != null ? String(row.secondary) : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
