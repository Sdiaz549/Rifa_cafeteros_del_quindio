import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop, parseCopInput } from '@shared/money'
import { formatDateCo } from '@shared/dates'
import type { ExpenseSummary, PaymentMethodSummary } from '@shared/types'

export function ExpensesPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ExpenseSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    concept: '',
    category: 'OPERACION',
    amount: '',
    paymentMethodId: '',
    notes: ''
  })

  async function load() {
    setLoading(true)
    const res = await window.api.expenses.list({
      from: from || undefined,
      to: to || undefined,
      category: category || undefined,
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
  }

  useEffect(() => {
    void (async () => {
      const [cats, meths] = await Promise.all([
        window.api.expenses.categories(),
        window.api.paymentMethods.listActive()
      ])
      if (cats.ok) {
        setCategories(cats.data)
        if (cats.data[0]) setForm((s) => ({ ...s, category: cats.data[0] }))
      }
      if (meths.ok) {
        setMethods(meths.data)
        if (meths.data[0]) setForm((s) => ({ ...s, paymentMethodId: meths.data[0].id }))
      }
      await load()
    })()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [from, to, category, query])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseCopInput(form.amount)
    if (amount <= 0) {
      toast.error('El valor debe ser mayor que cero')
      return
    }
    setSaving(true)
    const res = await window.api.expenses.create({
      expenseDate: form.expenseDate || undefined,
      concept: form.concept.trim(),
      category: form.category,
      amount,
      paymentMethodId: form.paymentMethodId || null,
      notes: form.notes.trim() || null
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Egreso registrado')
    setForm((s) => ({ ...s, concept: '', amount: '', notes: '' }))
    await load()
  }

  async function onVoid(id: string) {
    if (!window.confirm('¿Anular este egreso?')) return
    const res = await window.api.expenses.void(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Egreso anulado')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-900">Egresos</h1>
        <p className="text-sm text-ink-muted">Registro y consulta de egresos (ADMIN).</p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 sm:w-80">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Total egresos (filtro)</p>
        <p className="mt-1 font-display text-2xl font-bold text-brand-900">
          {formatCop(totalAmount)}
        </p>
        <p className="text-sm text-ink-muted">{total} registros activos</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <form onSubmit={onSubmit} className="h-fit space-y-3 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-brand-900">Nuevo egreso</h2>
          <input
            type="date"
            required
            value={form.expenseDate}
            onChange={(e) => setForm((s) => ({ ...s, expenseDate: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Concepto"
            value={form.concept}
            onChange={(e) => setForm((s) => ({ ...s, concept: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Valor"
            value={form.amount}
            onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <select
            value={form.paymentMethodId}
            onChange={(e) => setForm((s) => ({ ...s, paymentMethodId: e.target.value }))}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          >
            <option value="">Sin método</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Observaciones"
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            className="min-h-[70px] w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar egreso'}
          </button>
        </form>

        <div className="space-y-3">
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-line px-3 py-2 text-sm"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto…"
              className="min-w-[180px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {loading ? (
              <p className="p-6 text-sm text-ink-muted">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-sm text-ink-muted">No hay egresos con los filtros actuales.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-brand-50/60 text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-line/70">
                      <td className="px-4 py-3">{formatDateCo(row.expenseDate)}</td>
                      <td className="px-4 py-3">{row.concept}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{formatCop(row.amount)}</td>
                      <td className="px-4 py-3">{row.paymentMethodName ?? '—'}</td>
                      <td className="px-4 py-3">{row.userName}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void onVoid(row.id)}
                          className="text-sm font-medium text-red-700 hover:underline"
                        >
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
