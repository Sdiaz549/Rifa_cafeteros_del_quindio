import type { ReactNode } from 'react'

export function PageHeader({
  kicker = 'Cafeteros del Quindío',
  title,
  description,
  icon,
  actions
}: {
  kicker?: string
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-900 text-gold-soft shadow-lg shadow-brand-950/20">
            {icon}
          </div>
        )}
        <div>
          <p className="page-kicker">{kicker}</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight text-brand-900 md:text-4xl">
            {title}
          </h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="app-card border-dashed px-8 py-12 text-center">
      <p className="font-display text-xl text-brand-900">{title}</p>
      {hint && <p className="mt-2 text-sm text-ink-muted">{hint}</p>}
    </div>
  )
}
