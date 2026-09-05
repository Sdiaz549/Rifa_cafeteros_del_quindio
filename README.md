# Rifa — Cafeteros del Quindío

Aplicación de **escritorio local** para la gestión completa de una rifa (boletas, vendedores, compradores, ventas, abonos, liquidaciones, finanzas, auditoría, backups y comandos de voz).

Funciona **sin Internet**. Base de datos **SQLite** en el computador. Pensada para un solo puesto de trabajo.

## Estado del proyecto

**Etapa 0 — Diseño documental** (en curso / entregada en `docs/`).

La implementación de código comenzará en la **Fase 1** según el plan.

| Documento | Contenido |
|-----------|-----------|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Requisitos funcionales/NFR, inconsistencias y resoluciones |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, capas, seguridad, estructura de carpetas |
| [docs/DATABASE.md](docs/DATABASE.md) | Esquema SQLite, índices, transacciones, seed |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Plan por fases (1–20) |

## Stack previsto

- Electron + React + TypeScript + Vite
- SQLite + Prisma
- Tailwind CSS + Radix/shadcn-style UI
- Recharts, ExcelJS, Zod, bcrypt
- Vitest + electron-builder (Windows NSIS)

## Roles

- **ADMINISTRADOR** — acceso total (finanzas, usuarios, config, backups, auditoría)
- **USUARIO** — operación diaria (boletas, ventas, abonos, catálogos operativos)

Los permisos se validan en el proceso main (IPC), no solo en la UI.

## Próximos pasos

1. Revisar y aprobar la documentación de diseño
2. Fase 1: scaffold del proyecto Electron
3. Fase 2: modelo Prisma y migraciones

## Licencia / uso

Software interno para Cafeteros del Quindío.
