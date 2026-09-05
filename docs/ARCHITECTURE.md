# Arquitectura — Rifa Cafeteros del Quindío

## 1. Visión

Aplicación de escritorio **Electron + React + TypeScript** con **SQLite local**, sin servidor externo. Toda la lógica sensible corre en el **proceso main** (Node); el renderer solo presenta UI y envía comandos tipados por IPC.

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + Tailwind + UI lib)                       │
│  pages / components / hooks / stores                        │
│  voice (Web Speech) · charts · excel client triggers        │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC tipado (preload bridge)
┌──────────────────────────▼──────────────────────────────────┐
│  Preload (contextBridge) — API segura, sin nodeIntegration  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Main process                                               │
│  ├── ipc/handlers/*                                         │
│  ├── auth/ (sesión, permisos)                               │
│  ├── services/ (casos de uso)                               │
│  ├── domain/ (reglas, money, estados)                       │
│  ├── db/ (Prisma + SQLite)                                  │
│  ├── audit/                                                 │
│  ├── backup/                                                │
│  └── export/ (ExcelJS)                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  SQLite .db │
                    │  (userData) │
                    └─────────────┘
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Motivo |
|------|------------|--------|
| Shell escritorio | Electron 33+ | Empaquetado Windows, FS local, offline |
| UI | React 19 + TypeScript | Componentes, tipado |
| Bundler | Vite + electron-vite | DX rápida |
| Estilos | Tailwind CSS 4 | Utilidades, tema custom |
| Componentes | Radix UI + shadcn/ui patterns | Accesible, moderno, control total |
| Iconos | Lucide React | Ligero |
| Gráficos | Recharts | React-friendly |
| ORM | Prisma | Esquema claro, migraciones, SQLite |
| DB | SQLite (better-sqlite3 vía Prisma) | Local, embbedable, backups = copy file |
| Validación | Zod | Contratos IPC y formularios |
| Passwords | bcrypt | Estándar, suficiente para desktop local |
| Excel | ExcelJS | Multi-hoja, encabezados |
| Tests | Vitest | Unit/integration servicios y dominio |
| Empaquetado | electron-builder (NSIS) | Instalador Windows |

**Alternativa considerada:** better-sqlite3 directo sin Prisma — más control, menos DX. Se elige **Prisma** por mantenibilidad y migraciones; si el empaquetado nativo complica, se documenta fallback a `drizzle-orm` + better-sqlite3.

---

## 3. Principios de diseño

1. **No lógica de negocio en componentes React** — solo orquestación UI.
2. **Servicios = única puerta a mutaciones** — handlers IPC delgados.
3. **Permisos en servidor (main)** — cada handler llama `assertPermission(session, action)`.
4. **Dinero como enteros** (`Int` COP) — helpers `formatCop` / `parseCopInput`.
5. **Transacciones** en ventas, abonos, liquidaciones, anulaciones, restore.
6. **Auditoría append-only** — sin delete desde UI.
7. **Soft-delete / anulación** para datos financieros.
8. **Módulos por dominio** — carpetas claras, imports unidireccionales.

---

## 4. Separación de capas

| Capa | Responsabilidad | Ubicación |
|------|-----------------|-----------|
| UI | Pantallas, formularios, feedback | `src/renderer` |
| Bridge | API tipada al main | `src/preload` |
| IPC | Validar Zod + auth + llamar servicio | `src/main/ipc` |
| Auth | Login, sesión en memoria, permisos | `src/main/auth` |
| Services | Casos de uso | `src/main/services` |
| Domain | Estados, money, voice parse, reglas puras | `src/main/domain` (+ shared) |
| DB | Prisma client, migraciones, seed | `src/main/db`, `prisma/` |
| Audit | Helper `writeAuditLog` | `src/main/audit` |
| Backup | Copy/restore SQLite | `src/main/backup` |
| Export | Excel multi-hoja | `src/main/export` |
| Voice | Parser de comandos (shared) + UI mic | `src/shared/voice`, `src/renderer/features/voice` |

Código compartido renderer↔main: `src/shared` (tipos DTO, enums, permisos, money format, voice grammar).

---

## 5. Autenticación y sesión

- Login → bcrypt.compare → crear `Session { userId, name, role, startedAt }` en memoria del main.
- Preload expone `api.auth.*` y `api.*.*` que siempre viajan con contexto de sesión implícito en main.
- Logout limpia sesión.
- Al restaurar backup → forzar logout.

### Matriz de permisos (resumen)

Ver implementación en `src/shared/permissions.ts`.

| Acción | ADMIN | USUARIO |
|--------|:-----:|:------:|
| Dashboard / ingresos / egresos / balance | ✓ | ✗ |
| Usuarios, settings críticas, backups restore | ✓ | ✗ |
| Métodos pago CRUD | ✓ | ✗ (solo leer activos) |
| Auditoría | ✓ | ✗ |
| Boletas consultar / buscar | ✓ | ✓ |
| Ventas / abonos | ✓ | ✓ |
| Compradores / vendedores CRUD operativo | ✓ | ✓ |
| Marcar perdida | ✓ | Configurable (default ADMIN) |
| Liquidaciones | ✓ | ✗ (o solo consulta — **decisión: solo ADMIN registra**) |
| Reportes operativos (boletas) | ✓ | ✓ |
| Reportes financieros | ✓ | ✗ |
| Export Excel completo | ✓ | Limitado a módulos permitidos |
| Backup crear | ✓ | ✗ |

---

## 6. Flujo ejemplo: registrar abono

```
UI AbonosForm
  → api.payments.create(dto)          // preload
  → ipc payments:create               // main
  → zod parse
  → assertPermission(ABONO_CREATE)
  → paymentService.createAbono(dto, session)
       prisma.$transaction:
         lock ticket
         validate saldo, estado, método
         create payment (origen MANUAL|VOZ)
         recalc totals + status
         update ticket
         audit_log
  → return result
  → toast éxito / error
```

---

## 7. Estructura de carpetas

```
rifa-cafeteros-del-quindio/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── REQUIREMENTS.md
│   └── IMPLEMENTATION_PLAN.md
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── resources/                 # iconos, splash
├── scripts/                   # generate-tickets, backup helpers
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── window.ts
│   │   ├── paths.ts           # userData, db path
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   └── password.ts
│   │   ├── ipc/
│   │   │   ├── register.ts
│   │   │   └── handlers/
│   │   │       ├── auth.ts
│   │   │       ├── tickets.ts
│   │   │       ├── sales.ts
│   │   │       ├── payments.ts
│   │   │       ├── buyers.ts
│   │   │       ├── sellers.ts
│   │   │       ├── settlements.ts
│   │   │       ├── expenses.ts
│   │   │       ├── reports.ts
│   │   │       ├── dashboard.ts
│   │   │       ├── users.ts
│   │   │       ├── paymentMethods.ts
│   │   │       ├── settings.ts
│   │   │       ├── audit.ts
│   │   │       ├── backup.ts
│   │   │       └── export.ts
│   │   ├── services/
│   │   │   ├── ticketService.ts
│   │   │   ├── saleService.ts
│   │   │   ├── paymentService.ts
│   │   │   ├── buyerService.ts
│   │   │   ├── sellerService.ts
│   │   │   ├── settlementService.ts
│   │   │   ├── expenseService.ts
│   │   │   ├── dashboardService.ts
│   │   │   ├── reportService.ts
│   │   │   ├── userService.ts
│   │   │   └── settingsService.ts
│   │   ├── domain/
│   │   │   ├── ticketStatus.ts
│   │   │   ├── money.ts
│   │   │   └── errors.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   └── migrate.ts
│   │   ├── audit/
│   │   │   └── auditService.ts
│   │   ├── backup/
│   │   │   └── backupService.ts
│   │   └── export/
│   │       └── excelExport.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── api.ts
│   ├── renderer/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── routes/
│   │   ├── layouts/
│   │   │   ├── AppShell.tsx      # sidebar + top search
│   │   │   └── AuthLayout.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── tickets/
│   │   │   ├── unsold/
│   │   │   ├── sales/
│   │   │   ├── payments/
│   │   │   ├── buyers/
│   │   │   ├── sellers/
│   │   │   ├── settlements/
│   │   │   ├── expenses/
│   │   │   ├── incomes/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   ├── paymentMethods/
│   │   │   ├── audit/
│   │   │   ├── settings/
│   │   │   ├── backup/
│   │   │   ├── search/
│   │   │   └── voice/
│   │   ├── components/ui/        # button, table, dialog, toast...
│   │   ├── lib/                  # cn, formatters UI
│   │   └── stores/               # session UI state
│   └── shared/
│       ├── types/
│       ├── permissions.ts
│       ├── money.ts
│       ├── dates.ts
│       ├── constants.ts
│       └── voice/
│           ├── grammar.ts
│           └── parseCommand.ts
├── tests/
│   ├── domain/
│   ├── services/
│   └── permissions/
├── electron-builder.yml
├── package.json
├── tsconfig*.json
├── vite / electron-vite config
└── README.md
```

---

## 8. Decisiones técnicas importantes

### 8.1 Proceso main como “backend local”

Evita que el renderer manipule SQLite directamente. Cumple seguridad de permisos y centraliza transacciones.

### 8.2 Prisma + SQLite en `app.getPath('userData')`

La DB de desarrollo puede vivir en `./data/rifa.db`; producción en userData. Backups copian ese archivo.

### 8.3 Generación masiva de boletas

Al configurar `ticketCount = N`, job en main inserta en lotes (`createMany`) con números zero-padded / enteros indexados. Índices en `number` y `status`.

### 8.4 Voz

- Reconocimiento: `webkitSpeechRecognition` / SpeechRecognition en renderer (es-CO).
- Parsing: módulo puro en `shared/voice` (números en español → entero).
- Abonos: siempre modal de confirmación; comando “Sí, confirmar” solo si hay pending confirm.

**Limitación:** reconocimiento offline depende del SO/Chromium; documentar en README.

### 8.5 Impresión de boleta

`window.print()` con vista HTML dedicada o PDF via Electron `webContents.print`. Fase posterior a detalle.

### 8.6 Tema visual

CSS variables:

- `--brand-green` verde oscuro café
- `--brand-red`
- `--surface`, `--ticket-available`, `--ticket-partial`, `--ticket-paid`, `--ticket-lost`

Tipografía: **Source Serif 4** (marca) + **DM Sans** (UI) — evitar Inter/Roboto.

### 8.7 Rendimiento cuadrícula 10k–100k

- Virtualización (`@tanstack/react-virtual`)
- Paginación/server-side filter en main
- No cargar 100k nodos DOM

---

## 9. Seguridad local

- `contextIsolation: true`, `nodeIntegration: false`
- Preload mínimo
- bcrypt cost factor ≥ 10
- Sin secretos en exports
- Backup restore requiere ADMIN + confirmación explícita
- Validación Zod en todos los IPC de escritura

---

## 10. Empaquetado Windows (Fase 20)

- `electron-builder` target NSIS
- Incluir Prisma query engine / binaries correctos para win x64
- Script postinstall `prisma generate`
- Documentar firma de código como opcional (no bloqueante v1)

---

## 11. Observabilidad

- Logs main → archivo rotativo en userData (opcional v1.1)
- Errores de dominio tipados (`AppError`) con códigos para UI

---

## 12. Extensiones futuras (no v1)

- Multi-rifa
- Sync LAN read-only
- Roles granulares custom
- Impresión térmica
