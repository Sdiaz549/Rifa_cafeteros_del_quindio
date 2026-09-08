# Rifa — Cafeteros del Quindío

Aplicación de **escritorio local** (Electron + React + TypeScript + SQLite) para administrar la rifa de **Cafeteros del Quindío**.

Funciona **sin Internet**. Un solo computador. Base de datos local.

## Instalar en Windows (usuarios)

### Opción A — Portable (sin instalador)

1. Descarga `Rifa-Cafeteros-0.1.0-win-x64-portable.zip` (artifact del agente / Actions).
2. Descomprime la carpeta `win-unpacked`.
3. Ejecuta `Rifa Cafeteros del Quindio.exe`.
4. Primer arranque: crea la base de datos y las 10.000 boletas (unos segundos).
5. Login: `admin` / `Admin123!` (cámbiala luego en Admin → Usuarios).

### Opción B — Instalador NSIS (`.exe`)

1. En GitHub → **Actions** → workflow **Build Windows installer** → *Run workflow* (o espera el build automático de la rama).
2. Descarga el artifact `rifa-windows-installer`.
3. Ejecuta el Setup `.exe` y sigue el asistente.
4. Abre **Rifa Cafeteros** desde el menú Inicio.

> No necesita Node.js ni Internet. La base queda en `AppData` del usuario de Windows.

### Generar el instalador en tu PC (desarrolladores)

En una máquina **Windows** con Node.js 20+:

```bash
git clone https://github.com/Sdiaz549/Rifa_cafeteros_del_quindio.git
cd Rifa_cafeteros_del_quindio
git checkout cursor/windows-installer-fe27
npm install
npm run dist:win
```

Los `.exe` quedan en `release/`.

## Qué incluye

- Login, roles ADMIN / USUARIO y permisos reales en el proceso main
- Boletas (cuadrícula y lista), ventas, abonos, liquidaciones
- Compradores, vendedores, boletas sin vender
- Dashboard con filtros de periodo y gráficos
- Ingresos, egresos, reportes y export Excel
- Usuarios, métodos de pago, configuración, backups y auditoría
- Comandos de voz (micrófono en la barra de búsqueda)
- Seed de desarrollo + tests de dominio

## Requisitos (solo desarrollo)

- Node.js 20+
- npm 10+
- Windows para generar el instalador NSIS final

## Instalación (desarrollo)

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

La base SQLite queda en `data/rifa.db`.

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
| `npm run dist:win` | Instalador Windows (NSIS + portable) |
| `npm run db:seed` | Datos de desarrollo |
| `npm run db:studio` | Prisma Studio |

## Licencia

Software interno — Cafeteros del Quindío. UNLICENSED.
