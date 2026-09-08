import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Settings } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { formatCop } from '@shared/money'
import { DEFAULT_TICKET_PRICE } from '@shared/constants'
import type { AppSettings } from '@shared/types'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [raffleName, setRaffleName] = useState('')
  const [ticketCount, setTicketCount] = useState('10000')
  const [drawDate, setDrawDate] = useState('')
  const [pad, setPad] = useState('4')
  const [generate, setGenerate] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await window.api.settings.get()
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setSettings(res.data)
    setCompanyName(res.data.companyName)
    setRaffleName(res.data.raffleName)
    setTicketCount(String(res.data.ticketCount))
    setDrawDate(res.data.drawDate ? res.data.drawDate.slice(0, 10) : '')
    setPad(String(res.data.ticketNumberPad))
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await window.api.settings.update({
      companyName: companyName.trim(),
      raffleName: raffleName.trim(),
      ticketCount: Number(ticketCount),
      drawDate: drawDate ? new Date(`${drawDate}T12:00:00`).toISOString() : undefined,
      ticketNumberPad: Number(pad),
      generateMissingTickets: generate
    })
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(generate ? 'Configuración guardada y boletas generadas' : 'Configuración guardada')
    setGenerate(false)
    setSettings(res.data)
  }

  if (!settings) return <p className="text-ink-muted">Cargando configuración…</p>

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings size={22} />}
        title="Configuración"
        description="Parámetros de la rifa, empresa y generación de boletas."
      />

      <form onSubmit={onSubmit} className="app-card mx-auto max-w-3xl space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Empresa
            <input className="mt-1 w-full" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </label>
          <label className="text-sm">
            Nombre de la rifa
            <input className="mt-1 w-full" value={raffleName} onChange={(e) => setRaffleName(e.target.value)} required />
          </label>
          <label className="text-sm">
            Cantidad de boletas
            <input
              className="mt-1 w-full"
              type="number"
              min={1}
              value={ticketCount}
              onChange={(e) => setTicketCount(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-ink-muted">
              10.000 boletas numeradas del 0000 al 9999.
            </span>
          </label>
          <label className="text-sm">
            Valor de la boleta
            <p className="mt-1 rounded-xl border border-line bg-brand-50 px-3 py-2.5 font-semibold text-brand-900">
              {formatCop(DEFAULT_TICKET_PRICE)}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">
              Fijo: $50.000. No se puede modificar.
            </span>
          </label>
          <label className="text-sm">
            Fecha de sorteo
            <input className="mt-1 w-full" type="date" value={drawDate} onChange={(e) => setDrawDate(e.target.value)} />
          </label>
          <label className="text-sm">
            Cifras del número
            <input
              className="mt-1 w-full"
              type="number"
              min={2}
              max={8}
              value={pad}
              onChange={(e) => setPad(e.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} />
          Generar boletas faltantes (0000 hasta la cantidad − 1)
        </label>
        <p className="text-xs text-ink-muted">
          Los backups automáticos y la carpeta de copias se configuran en Administración → Backups.
        </p>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}
