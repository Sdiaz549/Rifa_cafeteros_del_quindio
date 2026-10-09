import { useState } from 'react'
import { toast } from 'sonner'
import { formatTicketNumber } from '@shared/tickets/numbers'
import { isUnusableTicket } from '@shared/domain/ticketStatus'
import type { TicketStatus } from '@shared/types'
import { useAuth } from '../auth/AuthContext'

export function MarkUnusableButtons({
  ticketNumber,
  status,
  onDone
}: {
  ticketNumber: number
  status: TicketStatus
  onDone?: () => void
}) {
  const { can } = useAuth()
  const [busy, setBusy] = useState<'PERDIDA' | 'DAÑADA' | null>(null)

  if (!can('tickets:mark_lost') || isUnusableTicket(status)) return null

  async function mark(next: 'PERDIDA' | 'DAÑADA') {
    const label = next === 'DAÑADA' ? 'dañada' : 'perdida'
    if (
      !window.confirm(
        `¿Marcar la boleta ${formatTicketNumber(ticketNumber)} como ${label.toUpperCase()}? Ya no se podrá vender ni abonar.`
      )
    ) {
      return
    }
    setBusy(next)
    const res =
      next === 'DAÑADA'
        ? await window.api.tickets.markDamaged(ticketNumber)
        : await window.api.tickets.markLost(ticketNumber)
    setBusy(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Boleta marcada como ${label}`)
    onDone?.()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy != null}
        className="btn-danger disabled:opacity-60"
        onClick={() => void mark('PERDIDA')}
      >
        {busy === 'PERDIDA' ? 'Marcando…' : 'Marcar perdida'}
      </button>
      <button
        type="button"
        disabled={busy != null}
        className="rounded-xl border border-[#c45c26] bg-[#fff3e8] px-4 py-2 text-sm font-semibold text-[#8a3b10] disabled:opacity-60"
        onClick={() => void mark('DAÑADA')}
      >
        {busy === 'DAÑADA' ? 'Marcando…' : 'Marcar dañada'}
      </button>
    </div>
  )
}
