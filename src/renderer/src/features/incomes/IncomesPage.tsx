import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import { formatDateTimeCo } from '@shared/dates'
import type { IncomeSummary } from '@shared/types'

export function IncomesPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<'TODOS' | 'VENTA_INICIAL' | 'ABONO'>('TODOS')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<IncomeSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalInitialSales, setTotalInitialSales] = useState(0)
  const [totalInstallments, setTotalInstallments] = useState(0)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await window.api.incomes.list({
      from: from || undefined,
      to: to || undefined,
      type,
      query: query || undefined,
      take: 400
    })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
    setTotalAmount(res.data.totalAmount)
    setTotalInitialSales(res.data.totalInitialSales)
    setTotalInstallments(res.data.totalInstallments)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [from, to, type, query])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Ingresos</h1>
        <p className="text-sm text-ink-muted">
          Derivados de pagos activos (venta inicial y abonos). Solo lectura ADMIN.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Total ingresos</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {formatCop(totalAmount)}
          </p>
          <p className="text-sm text-ink-muted">{total} movimientos</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Ventas iniciales</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {formatCop(totalInitialSales)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Abonos</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {formatCop(totalInstallments)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-xl border border-line px-3 py-2 text-sm"
        >
          <option value="TODOS">Todos los tipos</option>
          <option value="VENTA_INICIAL">Venta inicial</option>
          <option value="ABONO">Abonos</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar boleta, vendedor, comprador…"
          className="min-w-[220px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {loading ? (
          <p className="p-6 text-sm text-ink-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No hay ingresos con los filtros actuales.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Boleta</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Comprador</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-line/70">
                  <td className="px-4 py-3">{formatDateTimeCo(i.paidAt)}</td>
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/boletas/${i.ticketNumber}`} className="text-brand-800 hover:underline">
                      #{i.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {i.type === 'VENTA_INICIAL' ? 'Venta inicial' : 'Abono'}
                  </td>
                  <td className="px-4 py-3">{formatCop(i.amount)}</td>
                  <td className="px-4 py-3">{i.paymentMethodName}</td>
                  <td className="px-4 py-3">{i.sellerName ?? '—'}</td>
                  <td className="px-4 py-3">{i.buyerName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
