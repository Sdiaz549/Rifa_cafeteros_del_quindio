# Requisitos — Rifa Cafeteros del Quindío

## 1. Resumen del producto

Aplicación de **escritorio local** (un solo computador, un usuario a la vez) para administrar una rifa de la empresa **Cafeteros del Quindío**.

Prioridades (en orden):

1. Simplicidad
2. Seguridad de la información
3. Facilidad de uso
4. Buen rendimiento
5. Interfaz moderna
6. Copias de seguridad
7. Trazabilidad financiera completa

**No** es una aplicación web ni depende de un servidor externo. Debe funcionar **sin Internet**.

---

## 2. Actores y roles

| Rol | Descripción |
|-----|-------------|
| **ADMINISTRADOR** | Acceso total: finanzas, usuarios, configuración, backups, auditoría |
| **USUARIO** | Operación diaria: boletas, ventas, abonos, compradores, vendedores |

La protección de permisos debe ser **real** (validación en capa de servicios / IPC), no solo ocultar menús.

---

## 3. Requisitos funcionales por módulo

### 3.1 Autenticación

- Login con usuario + contraseña
- Hash seguro (bcrypt o Argon2); nunca texto plano
- Sesión con: `usuarioId`, `nombre`, `rol`, `fechaInicio`

### 3.2 Dashboard administrativo (solo ADMIN)

Indicadores mínimos:

- Ingresos del día / del mes
- Total egresos, balance, total recaudado, total por cobrar
- Conteos de boletas: total, vendidas, sin vender, en abonos, canceladas, perdidas, liquidadas, pendientes de liquidación

Filtros de periodo: Hoy, Semana, Mes, Año, Rango personalizado.

Gráficos: ingresos por día, ventas por vendedor, métodos de pago, estados de boletas, recaudo por vendedor.

### 3.3 Boletas

- Configurables (inicialmente ~10.000; diseño hasta >100.000)
- Campos: id, número, estado, vendedor, comprador, fecha venta, valor total, total abonado, saldo pendiente, observaciones, timestamps
- Vistas: cuadrícula y lista
- Buscador: número, comprador, cédula, teléfono, vendedor
- Colores:
  - Blanco → DISPONIBLE
  - Amarillo claro → EN_ABONOS
  - Verde fosforescente → CANCELADA
  - Rojo → PERDIDA
  - Indicador aparte → LIQUIDADA (`liquidada` independiente del estado de pago)

Estados de pago explícitos: `DISPONIBLE | EN_ABONOS | CANCELADA | PERDIDA`.

### 3.4 Detalle de boleta

Información general, vendedor, comprador, tabla de abonos, totales, acciones: editar, registrar abono, historial, imprimir, marcar perdida (con permiso), regresar.

### 3.5 Ventas

Formulario: número, comprador, vendedor, valor, fecha, método de pago, pago inicial, observaciones.

- Buscar/crear comprador; buscar vendedor
- No vender boleta ya vendida
- Pago inicial actualiza `totalAbonado`, `saldoPendiente`, `estado`

### 3.6 Abonos

Buscar boleta → ver saldo → registrar valor, método, fecha, observación.

Persistir: boletaId, valor, fecha, metodoPagoId, usuarioId, observación, origen (`MANUAL | VOZ`).

Reglas:

- Recalcular totales
- Si saldo = 0 → estado `CANCELADA`
- Rechazar abono > saldo con mensaje: *“El valor del abono supera el saldo pendiente.”*

### 3.7 Compradores / Vendedores

Compradores: CRUD + búsqueda + boletas + saldos + historial; validar cédula duplicada.

Vendedores: CRUD + estado ACTIVO/INACTIVO + perfil con métricas + cuadrícula de boletas asignadas con filtros por estado.

### 3.8 Liquidaciones

Conceptos distintos:

- **CANCELADA** = comprador terminó de pagar
- **LIQUIDADA** = vendedor entregó el dinero a la empresa

Registro: boletaId, vendedorId, fecha, valor, usuarioId, observaciones. Filtros y totales liquidados / pendientes.

### 3.9 Boletas sin vender

Módulo independiente: agrupación por vendedor, indicadores, filtros, export Excel.

### 3.10 Métodos de pago

Catálogo admin (crear/editar/activar/desactivar). Usuario solo selecciona activos.

Seed: Efectivo, Nequi, Daviplata, Bancolombia, Transferencia.

### 3.11 Ingresos / Egresos (ADMIN)

Ingresos: totales y filtros; diferenciar venta de contado vs abonos.

Egresos: fecha, concepto, categoría, valor, método, observaciones, usuario; CRUD + filtros.

### 3.12 Reportes y Excel

Reportes listados en especificación original (§20). Exportación multi-hoja (§21) **sin** contraseñas ni hashes.

### 3.13 Backups

Backup manual, automático diario, al cerrar app, restaurar, carpeta configurable (puede ser carpeta sync Drive/OneDrive/Dropbox sin APIs).

Formato: `backup_rifa_YYYY-MM-DD_HHmm.db` (copia completa SQLite).

### 3.14 Auditoría

Tabla `audit_logs` inmutable desde UI. Eventos mínimos listados en §23.

### 3.15 Voz

Micrófono en buscador: búsqueda y navegación por comandos.

Abonos por voz con diálogo de confirmación obligatorio; origen `VOZ` + auditoría.

### 3.16 Búsqueda global

Barra superior permanente: número, comprador, cédula, teléfono, vendedor.

### 3.17 Configuración (ADMIN)

Empresa, nombre rifa, cantidad números, valor boleta, fecha sorteo, carpeta backup, backup automático, parámetros generales.

---

## 4. Requisitos no funcionales

| Área | Requisito |
|------|-----------|
| Offline | Funciona sin Internet |
| Plataforma | Windows instalable (Electron) |
| Dinero | Enteros COP (centavos no requeridos); UI `$ 50.000` |
| Fechas | UI `DD/MM/YYYY`; almacenamiento normalizado ISO/UTC |
| Integridad | Transacciones DB en operaciones financieras |
| Soft-delete | Preferir anulado / eliminado lógico sobre borrado físico |
| Escala | Índices y modelo listos para >100.000 boletas |
| UX | Loaders, toasts, confirmaciones, tooltips, vacíos, validaciones |
| UI | Verde oscuro / blanco / rojo; sidebar; look dashboard admin |

---

## 5. Inconsistencias detectadas y resoluciones

| # | Inconsistencia | Resolución adoptada |
|---|----------------|---------------------|
| 1 | “Estados” vs liquidación mezclados en lenguaje cotidiano | Separar `ticket.status` (pago/asignación) de `ticket.isSettled` / tabla `settlements` |
| 2 | Boleta “sin vender” pero “con vendedor asignado” | Modelo: `tickets` + `ticket_assignments`. DISPONIBLE puede tener vendedor asignado sin comprador/venta |
| 3 | ¿Valor de boleta fijo en settings vs por venta? | `settings.defaultTicketPrice` como default; `sales.amount` / `tickets.totalAmount` pueden variar si se permite override (validado en servicio) |
| 4 | Abono “eliminado” vs soft-delete | `payments.status = ANULADO`; recalcular totales; auditoría obligatoria |
| 5 | Ingresos vs payments | Ingresos derivados de `payments` activos + clasificación por `type` (VENTA_INICIAL / ABONO); egresos en tabla propia |
| 6 | `ticket_assignments` vs solo FK en ticket | Mantener `sellerId` actual en ticket **y** historial en `ticket_assignments` para cambios de vendedor auditables |
| 7 | Voz sin Internet | Usar Web Speech API del SO/Chromium cuando haya; degradar con mensaje claro si no hay reconocimiento offline disponible |
| 8 | Roles tabla vs enum | Tabla `roles` seed + FK en users (extensible); permisos centralizados en código (`permissions.ts`) |
| 9 | “sales” + “payments” | Una `sale` por primera venta de boleta; cada movimiento de dinero es un `payment` (inicial u abono) |
| 10 | Backup al restaurar con app abierta | Cerrar conexiones Prisma/better-sqlite3, reemplazar archivo, reinicializar, forzar re-login |

---

## 6. Criterios de aceptación globales

- [ ] App arranca offline con DB local
- [ ] Login con hash; sesión tipada
- [ ] USUARIO no puede invocar APIs financieras de ADMIN (IPC rechaza)
- [ ] Transacciones atómicas en venta/abono/liquidación/anulación
- [ ] Colores y estados coherentes en todas las vistas
- [ ] Liquidación independiente de CANCELADA
- [ ] Auditoría en operaciones sensibles
- [ ] Backup/restore funcional
- [ ] Export Excel multi-hoja
- [ ] Seed de desarrollo usable
- [ ] Tests de reglas críticas pasan
- [ ] Build instalable Windows documentado

---

## 7. Fuera de alcance (esta versión)

- Multi-usuario concurrente en red / servidor central
- App móvil nativa
- Integración API Google Drive / OneDrive / Dropbox
- Contabilidad tributaria formal (DIAN, facturación electrónica)
- Multi-rifa simultánea en la misma instalación (una rifa activa; futura extensión posible vía settings)
