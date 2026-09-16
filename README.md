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

La base SQLite de desarrollo queda en `data/database.db` (si existía `data/rifa.db`, se copia automáticamente). En `.env` (ver `.env.example`) use:

```
DATABASE_URL="file:../data/database.db"
```

En el computador del cliente la base vive en:

`%AppData%\Roaming\SistemaRifas\database.db`

Una actualización o desinstalación **no borra** esa carpeta.

Documentación de la Fase 1: `docs/PHASE_1.md`.

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
| `npm run dist` | Instalador Windows NSIS (`release/SistemaRifas-Setup-x.y.z.exe`) |
| `npm run dist:win` | Alias de `npm run dist` |
| `npm run dist:dir` | Carpeta unpackaged para depurar el paquete |

Si el proyecto está en OneDrive, el empaquetado se hace en `%LOCALAPPDATA%\SistemaRifas-dist` y el `.exe` se copia a `release/`. Así se evita el error EPERM al renombrar `win-unpacked`.
| `npm run db:seed` | Datos de desarrollo |
| `npm run db:studio` | Prisma Studio |

## Licencia

Software interno — Cafeteros del Quindío. UNLICENSED.
