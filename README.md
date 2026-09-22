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

- Windows 10/11
- [Git](https://git-scm.com/download/win)
- [Node.js 20 LTS](https://nodejs.org/) (incluye npm)
- No usa Docker. Es un programa de escritorio con instalador `.exe`.

## Instalar en un computador nuevo

Después de formatear el PC:

```bash
git clone https://github.com/Sdiaz549/Rifa_cafeteros_del_quindio.git
cd Rifa_cafeteros_del_quindio
npm install
npm run dist
```

Luego ejecute `release\SistemaRifas-Setup-1.0.0.exe`. Crea acceso directo en el escritorio.

El primer usuario es `admin` / `Admin123!`. Cámbielo después de entrar.

La base de datos **no** está en GitHub. Si ya hay rifa en este PC y quiere conservarla, copie antes de formatear:

`%LOCALAPPDATA%\SistemaRifas-dev\database.db`

y, si ya instaló el `.exe`:

`%APPDATA%\SistemaRifas\database.db`

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
| `npm run db:seed` | Datos de desarrollo |
| `npm run db:studio` | Prisma Studio |

Si el proyecto está en OneDrive, el empaquetado se hace en `%LOCALAPPDATA%\SistemaRifas-dist` y el `.exe` se copia a `release/`. Así se evita el error EPERM al renombrar `win-unpacked`.

## Licencia

Software interno — Cafeteros del Quindío. UNLICENSED.
