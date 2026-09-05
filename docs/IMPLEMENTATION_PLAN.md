# Plan de implementación — Rifa Cafeteros del Quindío

## Objetivo

Entregar una aplicación Electron instalable en Windows que cubra **todos** los requisitos de `REQUIREMENTS.md`, siguiendo la arquitectura de `ARCHITECTURE.md` y el esquema de `DATABASE.md`.

Este documento divide el trabajo en **20 fases**. Cada fase tiene entregables verificables y dependencias claras.

**Estado actual:** Fases 1–9 avanzadas: scaffold, SQLite/Prisma, auth/roles, layout, boletas, **ventas**, **abonos**, compradores/vendedores CRUD, estados automáticos y tests de reglas. Build OK.

---

## Etapa 0 — Análisis y diseño (actual)

**Entregables:**

- [x] `docs/REQUIREMENTS.md` — requisitos, NFRs, inconsistencias y resoluciones
- [x] `docs/ARCHITECTURE.md` — stack, capas, carpetas, seguridad, decisiones
- [x] `docs/DATABASE.md` — ER, tablas, índices, transacciones, seed
- [x] `docs/IMPLEMENTATION_PLAN.md` — este plan
- [x] Estructura de carpetas propuesta (en ARCHITECTURE.md)

**Criterio de salida:** Diseño revisado; sin código de aplicación aún (salvo docs/README).

---

## FASE 1 — Estructura del proyecto

**Objetivo:** Scaffold Electron + React + TS + Vite + Tailwind.

**Tareas:**

- Inicializar `package.json`, electron-vite (o equivalente)
- Configurar TypeScript (main / preload / renderer / shared)
- Tailwind + tema CSS variables (verde oscuro / rojo / estados boleta)
- Estructura de carpetas vacía según ARCHITECTURE.md
- Scripts: `dev`, `build`, `test`, `prisma:*`
- ESLint/Prettier básico

**Done when:** `npm run dev` abre ventana Electron con shell vacío. ✅

---

## FASE 2 — SQLite y modelo de datos

**Objetivo:** Prisma schema completo + migraciones + client.

**Tareas:**

- `prisma/schema.prisma` según DATABASE.md
- Primera migración
- `db/client.ts`, path de DB en userData / `.env`
- Seed parcial (roles, settings, métodos de pago)
- Utilidad de generación de N boletas en lotes

**Done when:** Migración aplica; seed crea tablas y datos base; 100 boletas de dev generables.

---

## FASE 3 — Autenticación y roles

**Objetivo:** Login seguro + sesión + permisos en main.

**Tareas:**

- bcrypt hash/verify
- `session.ts` en main
- IPC `auth.login` / `logout` / `me`
- `shared/permissions.ts` + `assertPermission`
- Seed usuario ADMIN de desarrollo
- Pantalla Login

**Done when:** Login/logout funciona; IPC sin sesión rechaza; USER no puede llamar handlers ADMIN (test).

---

## FASE 4 — Layout general

**Objetivo:** App shell usable.

**Tareas:**

- Sidebar menú (§33) con visibilidad por rol
- Top bar: búsqueda global (UI stub) + micrófono (stub)
- Routing por features
- Toasts, dialogs, loaders, empty states base
- Branding “RIFA / Cafeteros del Quindío”

**Done when:** Navegación completa; rutas ADMIN ocultas y bloqueadas para USER.

---

## FASE 5 — Boletas

**Objetivo:** Listado, cuadrícula, detalle, búsqueda.

**Tareas:**

- Servicios + IPC tickets
- Vista grid virtualizada + lista
- Colores por estado + badge liquidada
- Detalle (§9) lectura
- Marcar perdida (permiso)
- Buscador de módulo

**Done when:** 100 boletas seed navegables; detalle correcto; perdida auditada (stub audit ok).

---

## FASE 6 — Compradores

**CRUD**, búsqueda, validación cédula duplicada, ver boletas/saldos/historial pagos.

**Done when:** Tests de unicidad cédula; perfil comprador usable.

---

## FASE 7 — Vendedores

CRUD, ACTIVO/INACTIVO, perfil con métricas (§13), cuadrícula boletas asignadas + filtros (§14), asignación/cambio de vendedor con historial.

**Done when:** Métricas coinciden con datos seed; filtros de colores OK.

---

## FASE 8 — Ventas

Módulo Nueva Venta (§10), transacción atómica, rechazo boleta vendida, pago inicial → payment + estado.

**Done when:** Tests: no revender; estados post-venta correctos; auditoría venta.

---

## FASE 9 — Abonos

Módulo abonos (§11), validación saldo, secuencia, origen MANUAL.

**Done when:** Tests: no superar saldo; mensajes de error exactos.

---

## FASE 10 — Estados automáticos

Centralizar motor de estados en `domain/ticketStatus.ts`; invariantes totalPaid/balanceDue; transición a CANCELADA; bloqueos PERDIDA.

**Done when:** Suite de invariantes verdes; sin lógica duplicada en UI.

---

## FASE 11 — Liquidaciones

Módulo boletas liquidadas (§15); liquidar solo CANCELADA no liquidada; historial y filtros.

**Done when:** Tests liquidación; `isSettled` independiente de status.

---

## FASE 12 — Boletas sin vender

Módulo agrupado por vendedor (§16); indicadores; filtros; preparación export.

**Done when:** Totales y porcentaje correctos vs ticketCount.

---

## FASE 13 — Dashboard ADMIN

KPIs + filtros periodo + Recharts (§5).

**Done when:** Cifras cuadran con payments/expenses/tickets para el rango.

---

## FASE 14 — Ingresos y egresos

Ingresos derivados de payments; egresos CRUD; filtros; solo ADMIN.

**Done when:** USER recibe error permiso; reportes de totales coherentes.

---

## FASE 15 — Reportes

Módulo reportes (§20) con filtros comunes; reutilizar query layer.

**Done when:** Cada reporte listado tiene vista usable.

---

## FASE 16 — Excel

ExcelJS multi-hoja (§21); exclusiones de seguridad (no hashes).

**Done when:** Archivo abre en Excel/LibreOffice con hojas y encabezados.

---

## FASE 17 — Backups

Servicio backup/restore (§22); settings carpeta; daily scheduler simple; on-close; UI ADMIN; audit restore.

**Done when:** Test restore round-trip; app usable tras restore.

---

## FASE 18 — Auditoría

Completar `auditService` en todos los puntos sensibles (§23); UI consulta solo ADMIN; sin delete.

**Done when:** Tests aseguran log en venta/abono/liquidación/backup/usuario.

---

## FASE 19 — Comandos de voz

Parser es-CO; mic en search; navegación; abono con confirmación (§24–26); origen VOZ.

**Done when:** Tests unitarios del parser; flujo confirmación E2E manual documentado.

---

## FASE 20 — Empaquetado Windows

electron-builder NSIS; Prisma engines; README build; smoke test instalador.

**Done when:** Instalador genera `.exe`; app corre en máquina limpia con DB en userData.

---

## Tests transversales (desde Fase 3+)

Ubicación: `tests/`

| Área | Casos mínimos |
|------|----------------|
| Ventas | No vender vendida |
| Abonos | No exceder saldo; auto CANCELADA |
| Liquidación | Solo cancelada; no doble liquidación |
| Permisos | Matriz ADMIN/USER en IPC |
| Auditoría | Eventos obligatorios |
| Backup | Create + restore |
| Money | Formato COP; sumas enteras |
| Estados | Invariantes ticket |

Correr en CI local: `npm test` antes de cada merge de fase.

---

## Orden de commits sugerido

Un PR o serie de commits por fase (o grupos 1–4, 5–10, 11–16, 17–20) para revisión incremental.

**Esta primera entrega (Etapa 0)** es un único PR documental.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Binarios Prisma en electron-builder | Probar empaquetado temprano (spike en Fase 1/2); fallback Drizzle si bloquea |
| Virtualización 10k celdas | TanStack Virtual desde Fase 5 |
| SpeechRecognition offline | Degradación UX; parser testeable sin mic |
| Corrupción DB | WAL + backup before migrate/restore |
| Drift totales vs payments | Recalc solo en transacciones; test invariantes |

---

## Definición de terminado (producto v1)

- Todos los módulos del menú (§33) operativos según rol
- Requisitos §1–§41 cubiertos o documentados con decisión explícita
- README completo (instalación, dev, build, backup)
- Seed dev + tests críticos verdes
- Instalador Windows generable

---

## Próximo paso inmediato

Tras aprobación de esta Etapa 0:

1. Ejecutar **FASE 1** (scaffold del monorepo Electron)
2. Continuar **FASE 2** (Prisma schema real + migración)
