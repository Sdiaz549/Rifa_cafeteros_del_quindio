# Fase 1 — Base del sistema

Fecha: 2026-09-08

## Qué se entregó

Esta fase deja la **arquitectura y la base ejecutable** del software de escritorio, sin abrir todavía el resto de módulos como trabajo nuevo.

El repositorio ya tenía Electron + Vite + React + TypeScript. La Fase 1 **no partió de cero**: se alineó esa base con la arquitectura pedida (capas, IPC, Prisma, login, dashboard).

### Stack verificado

- Electron (main / preload / renderer)
- Vite + electron-vite
- React 19 + TypeScript
- Tailwind CSS 4
- Prisma + SQLite local
- electron-builder (instalador Windows, script `dist:win`)

### Arquitectura

```
Renderer (React)  ──IPC whitelist──►  Preload (contextBridge)
                                          │
                                          ▼
                                    Main process
                       auth · ipc · services · repositories · db
                                          │
                                          ▼
                              SQLite local (nunca Google Drive)
```

- `nodeIntegration: false`, `contextIsolation: true`
- React no toca Node, el filesystem ni SQLite
- Contraseñas con bcrypt (cost 12)
- Roles ADMIN / USUARIO con permisos en el proceso main

### Entidades Prisma (iniciales)

Usuario, Vendedor, Comprador, Boleta (`Ticket`), Abono (`Payment`), MetodoPago, Movimiento, Configuracion (`Setting`), Backup, más auditoría y relaciones operativas ya existentes (venta, liquidación, egreso).

Estados de boleta: `SIN_VENDER` (blanco), `EN_ABONOS` (amarillo), `CANCELADA` (verde), `PERDIDA` (rojo).

### Backups

- SQLite permanece local
- Archivo: `backup_YYYY-MM-DD_HH-mm-ss.db`
- Primero carpeta local; Drive es destino secundario
- `GoogleDriveBackupService`: estructura OAuth 2.0, **sin credenciales reales**
- Funciones: `createBackup`, `listLocalBackups`, `uploadBackupToDrive`, `listDriveBackups`, `restoreBackup`, `deleteOldBackups`
- Restauración: cierra Prisma, respalda la DB actual, reemplaza el archivo, reabre e informa
- Scheduler preparado (cierre, manual, programado, intervalo de horas)

### Voz

`VoiceCommandService` es un servicio **transversal** (no un módulo de menú). Parser listo; sin API de voz de terceros.

### UI Fase 1

- Login
- Layout (sidebar + barra superior)
- Dashboard inicial con KPIs, actividad reciente y tarjeta **Copias de seguridad** (solo ADMIN)

La venta no tiene módulo propio: se hace desde Boletas (`/nueva-venta` redirige a `/boletas`).

## Cómo ejecutar

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Usuarios de desarrollo:

| Usuario    | Contraseña   | Rol    |
|------------|--------------|--------|
| `admin`    | `Admin123!`  | ADMIN  |
| `operador` | `Usuario123!`| USUARIO |

```bash
npm run typecheck
npm test
npm run build
```

## Siguiente fase (Fase 2)

Módulo de **Boletas** completo según la especificación:

1. Cuadrícula/lista de ~10.000 números con colores de estado
2. Venta y abonos desde el detalle de boleta (sin menú “Nueva venta”)
3. Historial de abonos, saldo automático, tope de excedente configurable
4. Transacciones y auditoría en cada operación financiera

Después: vendedores, compradores, reportes, Drive OAuth real y empaquetado Windows.
