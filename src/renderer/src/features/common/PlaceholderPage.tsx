export function PlaceholderPage({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-8 shadow-sm">
      <h1 className="font-display text-3xl font-bold text-brand-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">{description}</p>
      <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        Módulo planificado — la estructura y permisos ya están cableados. Se implementará según
        IMPLEMENTATION_PLAN.md.
      </p>
    </div>
  )
}
