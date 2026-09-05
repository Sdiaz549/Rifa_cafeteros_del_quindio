import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { UnsoldBySellerSummary } from '@shared/types'

export function UnsoldTicketsPage() {
  const [query, setQuery] = useState('')
  const [onlyWithSeller, setOnlyWithSeller] = useState(false)
  const [groups, setGroups] = useState<UnsoldBySellerSummary[]>([])
  const [totals, setTotals] = useState({
    unsoldCount: 0,
    ticketCount: 0,
    unsoldPercent: 0,
    withoutSellerCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  async function load(q?: string, onlySeller?: boolean) {
    setLoading(true)
    const res = await window.api.unsold.listBySeller({
      query: q || undefined,
      onlyWithSeller: onlySeller
    })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setGroups(res.data.groups)
    setTotals(res.data.totals)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(query, onlyWithSeller), 250)
    return () => clearTimeout(t)
  }, [query, onlyWithSeller])

  function toggle(key: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Boletas sin vender</h1>
        <p className="text-sm text-ink-muted">
          Agrupación por vendedor de boletas en estado disponible (DISPONIBLE).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Sin vender</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">{totals.unsoldCount}</p>
          <p className="text-sm text-ink-muted">{totals.unsoldPercent}% del total</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Total rifa</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">{totals.ticketCount}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Sin vendedor</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-900">
            {totals.withoutSellerCount}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nombre de vendedor…"
          className="min-w-[240px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={onlyWithSeller}
            onChange={(e) => setOnlyWithSeller(e.target.checked)}
          />
          Solo con vendedor asignado
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-sm text-ink-muted">
            No hay boletas sin vender con los filtros actuales.
          </p>
        ) : (
          groups.map((g) => {
            const key = g.sellerId ?? 'none'
            const open = openIds.has(key)
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-line bg-white">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50/50"
                >
                  {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-900">{g.sellerName}</p>
                    <p className="text-xs text-ink-muted">
                      {g.unsoldCount} sin vender
                      {g.sellerId
                        ? ` · ${g.ticketCount} asignadas · ${g.unsoldPercent}% pendientes`
                        : ''}
                      {g.sellerStatus ? ` · ${g.sellerStatus}` : ''}
                    </p>
                  </div>
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {g.unsoldCount}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-line px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {g.tickets.map((t) => (
                        <Link
                          key={t.id}
                          to={`/boletas/${t.number}`}
                          className="rounded-lg border border-line bg-brand-50/40 px-2.5 py-1 text-sm font-medium text-brand-900 hover:bg-brand-100"
                        >
                          #{t.number}
                        </Link>
                      ))}
                    </div>
                    {g.tickets.length > 0 && (
                      <p className="mt-3 text-xs text-ink-muted">
                        <Link
                          to={`/nueva-venta?boleta=${g.tickets[0].number}`}
                          className="text-brand-800 hover:underline"
                        >
                          Ir a nueva venta
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
