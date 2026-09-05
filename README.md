# Rifa — Cafeteros del Quindío

Aplicación de **escritorio local** (Electron + React + TypeScript + SQLite) para administrar la rifa de **Cafeteros del Quindío**.

Funciona **sin Internet**. Un solo computador. Base de datos local.

## Estado actual (Fases 1–4)

- Scaffold Electron + React + Tailwind
- Prisma/SQLite con esquema completo
- Login + sesión + permisos reales en proceso main
- Layout (sidebar, búsqueda global, menú por rol)
- Boletas (cuadrícula/lista) + detalle
- Dashboard admin (KPIs)
- Seed de desarrollo + tests de dominio

## Documentación de diseño

| Documento | Contenido |
|-----------|-----------|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Requisitos e inconsistencias resueltas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, capas, carpetas |
| [docs/DATABASE.md](docs/DATABASE.md) | Esquema SQLite / Prisma |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Plan por 20 fases |

## Requisitos

- Node.js 20+
- npm 10+
- Windows para el instalador final (desarrollo posible en Linux/macOS)

## Instalación (desarrollo)

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### Usuarios seed (solo desarrollo)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `Admin123!` | ADMIN |
| `operador` | `Usuario123!` | USER |

**No usar estas contraseñas en producción.**

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | App Electron en modo desarrollo |
| `npm run test` | Tests Vitest (reglas de dominio) |
| `npm run typecheck` | TypeScript main + renderer |
| `npm run build` | Build producción |
| `npm run dist:win` | Instalador Windows (NSIS) |
| `npm run db:seed` | Datos de desarrollo |
| `npm run db:studio` | Prisma Studio |

## Base de datos

- Desarrollo: `data/rifa.db` (ruta vía `DATABASE_URL` / userData en runtime)
- ORM: Prisma
- Dinero: enteros COP
- Soft-delete / `ANULADO` en movimientos financieros

## Próximas fases

Ventas → Abonos → Liquidaciones → Boletas sin vender → Reportes → Excel → Backups → Auditoría UI → Voz → Empaquetado Windows.

## Licencia

Software interno — Cafeteros del Quindío. UNLICENSED.
