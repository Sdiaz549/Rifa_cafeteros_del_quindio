import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { formatCop } from '@shared/money'
import { formatDateTimeCo } from '@shared/dates'
import { ticketStatusLabel } from '@shared/domain/ticketStatus'
import type { SettlementSummary, TicketSummary } from '@shared/types'

type Tab = 'pendientes' | 'historial'

export function SettlementsPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('pendientes')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [pending, setPending] = useState<TicketSummary[]>([])
  const [history, setHistory] = useState<SettlementSummary[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyAmount, setHistoryAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedNumber, setSelectedNumber] = useState<number | null>(
    params.get('boleta') ? Number(params.get('boleta')) : null
  )

  async function loadPending(q?: string) {
    setLoading(true)
    const res = await window.api.settlements.listPending({ query: q || undefined, take: 300 })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setPending(res.data.items)
    setPendingTotal(res.data.total)
    setPendingAmount(res.data.totalAmount)
  }

  async function loadHistory(q?: string) {
    setLoading(true)
    const res = await window.api.settlements.list({ query: q || undefined, take: 300 })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setHistory(res.data.items)
    setHistoryTotal(res.data.total)
    setHistoryAmount(res.data.totalAmount)
  }

  useEffect(() => {
    void (async () => {
      const [p, h] = await Promise.all([
        window.api.settlements.listPending({ take: 1 }),
        window.api.settlements.list({ take: 1 })
      ])
      if (p.ok) {
        setPendingTotal(p.data.total)
        setPendingAmount(p.data.totalAmount)
      }
      if (h.ok) {
        setHistoryTotal(h.data.total)
        setHistoryAmount(h.data.totalAmount)
      }
    })()
  }, [])

  useEffect(() => {
    if (tab === 'pendientes') void loadPending(query)
    else void loadHistory(query)
  }, [tab])

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === 'pendientes') void loadPending(query)
      else void loadHistory(query)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  async function onSettle(e: FormEvent) {
    e.preventDefault()
    if (!selectedNumber) {
      toast.error('Seleccione una boleta pendiente')
      return
    }
    setSettling(selectedNumber)
    const res = await window.api.settlements.create({
      ticketNumber: selectedNumber,
      notes: notes.trim() || undefined
    })
    setSettling(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Boleta ${selectedNumber} liquidada`)
    setNotes('')
    setSelectedNumber(null)
    await loadPending(query)
    if (tab === 'historial') await loadHistory(query)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Liquidaciones</h1>
        <p className="text-sm text-ink-muted">
          Registrar entrega de dinero del vendedor a la empresa. Solo boletas canceladas (pagadas).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setTab('pendientes')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === 'pendientes' ? 'bg-brand-800 text-white' : 'border border-line bg-white'
          }`}
        >
          Pendientes ({pendingTotal})
        </button>
        <button
          type="button"
          onClick={() => setTab('historial')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            tab === 'historial' ? 'bg-brand-800 text-white' : 'border border-line bg-white'
          }`}
        >
          Historial ({historyTotal})
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar boleta, vendedor o comprador…"
          className="min-w-[240px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Pendiente de liquidar</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {formatCop(pendingAmount)}
          </p>
          <p className="text-sm text-ink-muted">{pendingTotal} boletas</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Ya liquidado (vista)</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {formatCop(historyAmount)}
          </p>
          <p className="text-sm text-ink-muted">{historyTotal} registros</p>
        </div>
      </div>

      {tab === 'pendientes' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {loading ? (
              <p className="p-6 text-sm text-ink-muted">Cargando…</p>
            ) : pending.length === 0 ? (
              <p className="p-6 text-sm text-ink-muted">No hay boletas pendientes de liquidación.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Boleta</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Comprador</th>
                    <th className="px-4 py-3">Pagado</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedNumber(t.number)}
                      className={`cursor-pointer border-b border-line/70 hover:bg-brand-50/40 ${
                        selectedNumber === t.number ? 'bg-brand-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold">
                        <Link
                          to={`/boletas/${t.number}`}
                          className="text-brand-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{t.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{t.sellerName ?? '—'}</td>
                      <td className="px-4 py-3">{t.buyerName ?? '—'}</td>
                      <td className="px-4 py-3">{formatCop(t.totalPaid)}</td>
                      <td className="px-4 py-3">{ticketStatusLabel(t.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <form onSubmit={onSettle} className="h-fit space-y-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold text-brand-900">Liquidar boleta</h2>
            <p className="text-sm text-ink-muted">
              {selectedNumber
                ? `Seleccionada: #${selectedNumber}`
                : 'Seleccione una fila de la tabla.'}
            </p>
            <textarea
              className="min-h-[90px] w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Observaciones (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              type="submit"
              disabled={!selectedNumber || settling !== null}
              className="w-full rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {settling ? 'Liquidando…' : 'Confirmar liquidación'}
            </button>
          </form>
        </div>
      )}

      {tab === 'historial' && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {loading ? (
            <p className="p-6 text-sm text-ink-muted">Cargando…</p>
          ) : history.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">Aún no hay liquidaciones registradas.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Boleta</th>
                  <th className="px-4 py-3">Vendedor</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Notas</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-line/70">
                    <td className="px-4 py-3">{formatDateTimeCo(s.settledAt)}</td>
                    <td className="px-4 py-3 font-semibold">
                      <Link to={`/boletas/${s.ticketNumber}`} className="text-brand-800 hover:underline">
                        #{s.ticketNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{s.sellerName}</td>
                    <td className="px-4 py-3">{formatCop(s.amount)}</td>
                    <td className="px-4 py-3">{s.userName}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
