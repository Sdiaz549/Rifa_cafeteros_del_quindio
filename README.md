# Rifa — Cafeteros del Quindío

Aplicación de **escritorio local** (Electron + React + TypeScript + SQLite) para administrar la rifa de **Cafeteros del Quindío**.

Funciona **sin Internet**. Un solo computador. Base de datos local.

## Qué incluye

- Login, roles ADMIN / USUARIO y permisos reales en el proceso main
- Boletas (cuadrícula y lista), ventas, abonos, liquidaciones
- Compradores, vendedores, boletas sin vender
- Dashboard con filtros de periodo y gráficos
- Ingresos, egresos, reportes y export Excel
- Usuarios, métodos de pago, configuración, backups y auditoría
- Comandos de voz (micrófono en la barra de búsqueda)
- Seed de desarrollo + tests de dominio

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

La base SQLite queda en `data/rifa.db`. En `.env` use:

```
DATABASE_URL="file:../data/rifa.db"
```

(Prisma resuelve esa ruta relativa a la carpeta `prisma/`.)

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

## Licencia

Software interno — Cafeteros del Quindío. UNLICENSED.
