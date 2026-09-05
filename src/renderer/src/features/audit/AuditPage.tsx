import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatDateTimeCo } from '@shared/dates'
import type { AuditLogSummary } from '@shared/types'
import { cn } from '../../lib/cn'

function previewJson(value: string | null, max = 80): string {
  if (!value) return '—'
  const compact = value.replace(/\s+/g, ' ')
  return compact.length > max ? `${compact.slice(0, max)}…` : compact
}

export function AuditPage() {
  const [items, setItems] = useState<AuditLogSummary[]>([])
  const [total, setTotal] = useState(0)
  const [modules, setModules] = useState<string[]>([])
  const [module, setModule] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AuditLogSummary | null>(null)

  async function load() {
    setLoading(true)
    const res = await window.api.audit.list({
      from: from || undefined,
      to: to || undefined,
      module: module || undefined,
      query: query || undefined,
      take: 300
    })
    setLoading(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    void (async () => {
      const mods = await window.api.audit.listModules()
      if (mods.ok) setModules(mods.data)
      await load()
    })()
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(t)
  }, [from, to, module, query])

  return (
    <div className="space-y-5">
      <div className="app-card p-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-900">Auditoría</h1>
          <p className="text-sm text-ink-muted">
            Historial append-only de operaciones sensibles. Solo lectura.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
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
          <label className="text-sm">
            <span className="mb-1 block text-ink-muted">Módulo</span>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="rounded-xl border border-line px-3 py-2"
            >
              <option value="">Todos</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block text-ink-muted">Buscar</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Acción, entidad, usuario…"
              className="w-full rounded-xl border border-line px-3 py-2"
            />
          </label>
          <button type="button" onClick={() => void load()} className="btn-primary">
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="app-card overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-ink-muted">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No hay eventos con los filtros actuales.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Módulo</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'cursor-pointer border-t border-line/70 hover:bg-brand-50/50',
                      selected?.id === row.id && 'bg-brand-50'
                    )}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDateTimeCo(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{row.module}</td>
                    <td className="px-4 py-2.5">{row.action}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{row.userName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {row.entity}
                      {row.entityId ? (
                        <span className="text-ink-muted"> · {row.entityId.slice(0, 8)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="border-t border-line px-4 py-2 text-xs text-ink-muted">
            Mostrando {items.length} de {total.toLocaleString('es-CO')} eventos
          </div>
        </div>

        <aside className="app-card h-fit p-5">
          <h2 className="font-display text-xl font-bold text-brand-900">Detalle</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-ink-muted">Seleccione un evento de la lista.</p>
          ) : (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-ink-muted">Fecha</dt>
                <dd className="font-medium">{formatDateTimeCo(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Usuario</dt>
                <dd className="font-medium">{selected.userName ?? 'Sistema / sin sesión'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Módulo / Acción</dt>
                <dd className="font-medium">
                  {selected.module} · {selected.action}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Entidad</dt>
                <dd className="font-medium break-all">
                  {selected.entity}
                  {selected.entityId ? ` (${selected.entityId})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Origen</dt>
                <dd className="font-medium">{selected.origin}</dd>
              </div>
              {selected.notes && (
                <div>
                  <dt className="text-ink-muted">Notas</dt>
                  <dd className="font-medium">{selected.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-ink-muted">Valor anterior</dt>
                <dd className="rounded-lg bg-surface px-2 py-1 font-mono text-xs break-all">
                  {previewJson(selected.previousValue, 400)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Valor nuevo</dt>
                <dd className="rounded-lg bg-surface px-2 py-1 font-mono text-xs break-all">
                  {previewJson(selected.newValue, 400)}
                </dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </div>
  )
}
