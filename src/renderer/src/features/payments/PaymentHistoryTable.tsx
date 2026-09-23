import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatCop, formatCopInputValue, parseCopInput } from '@shared/money'
import { formatDateCo } from '@shared/dates'
import type { PaymentMethodSummary, PaymentSummary } from '@shared/types'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../../lib/cn'

export async function voidPaymentById(id: string, amount?: number): Promise<boolean> {
  const label = amount != null ? ` de ${formatCop(amount)}` : ''
  if (!window.confirm(`¿Quitar el abono${label}?`)) return false
  const res = await window.api.payments.void(id)
  if (!res.ok) {
    toast.error(res.error)
    return false
  }
  toast.success('Abono quitado')
  return true
}

export function PaymentHistoryTable({
  payments,
  ticketNumber,
  onChanged
}: {
  payments: PaymentSummary[]
  ticketNumber: number
  onChanged?: () => void
}) {
  const { can } = useAuth()
  const canEdit = can('payments:create')
  const [methods, setMethods] = useState<PaymentMethodSummary[]>([])
  const [editing, setEditing] = useState<PaymentSummary | null>(null)
  const [amount, setAmount] = useState('0')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canEdit) return
    void window.api.paymentMethods.listActive().then((res) => {
      if (res.ok) setMethods(res.data)
    })
  }, [canEdit])

  function startEdit(p: PaymentSummary) {
    setEditing(p)
    setAmount(formatCopInputValue(String(p.amount)))
    setPaymentMethodId(p.paymentMethodId)
    setNotes(p.notes ?? '')
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const value = parseCopInput(amount)
    if (value <= 0) {
      toast.error('El valor del abono debe ser mayor que cero')
      return
    }
    setSaving(true)
    const res = await window.api.payments.update({
      id: editing.id,
      amount: value,
      paymentMethodId: paymentMethodId || undefined,
      notes
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Abono actualizado')
    setEditing(null)
    onChanged?.()
  }

  async function voidPayment(p: PaymentSummary) {
    if (!window.confirm(`¿Quitar el abono de ${formatCop(p.amount)} en la boleta?`)) return
    const res = await window.api.payments.void(p.id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Abono quitado')
    onChanged?.()
  }

  if (payments.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-muted">Sin movimientos registrados.</p>
  }

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-50 text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Método</th>
            <th className="px-4 py-3 font-medium">Observación</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            {canEdit && <th className="px-4 py-3 font-medium" />}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const voided = p.status === 'ANULADO'
            return (
              <tr key={p.id} className={cn('border-t border-line', voided && 'text-ink-muted line-through')}>
                <td className="px-4 py-2.5">{p.sequence}</td>
                <td className="px-4 py-2.5">{formatDateCo(p.paidAt)}</td>
                <td className="px-4 py-2.5">{p.type === 'VENTA_INICIAL' ? 'Venta inicial' : 'Abono'}</td>
                <td className="px-4 py-2.5 font-medium">{formatCop(p.amount)}</td>
                <td className="px-4 py-2.5">{p.paymentMethodName}</td>
                <td className="px-4 py-2.5">{p.notes?.trim() ? p.notes : '—'}</td>
                <td className="px-4 py-2.5">{voided ? 'Anulado' : 'Activo'}</td>
                {canEdit && (
                  <td className="px-4 py-2.5">
                    {!voided && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-sm font-semibold text-brand-800"
                          onClick={() => startEdit(p)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-sm font-semibold text-accent-red"
                          onClick={() => void voidPayment(p)}
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <form onSubmit={(e) => void saveEdit(e)} className="app-card w-full max-w-md space-y-3 p-6">
            <h2 className="font-display text-2xl text-brand-900">Editar abono</h2>
            <p className="text-sm text-ink-muted">Boleta {String(ticketNumber).padStart(4, '0')}</p>
            <label className="text-sm">
              Valor
              <input
                className="mt-1 w-full"
                value={amount}
                onChange={(e) => setAmount(formatCopInputValue(e.target.value))}
                inputMode="numeric"
              />
            </label>
            <label className="text-sm">
              Método de pago
              <select
                className="mt-1 w-full"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Observación
              <input className="mt-1 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
