# Base de datos — Rifa Cafeteros del Quindío

## 1. Motor

- **SQLite** archivo único local
- **Prisma ORM** para schema, migraciones y acceso
- Valores monetarios: **INTEGER** (pesos COP enteros)
- Fechas: `DateTime` Prisma (ISO en DB); UI colombiana `DD/MM/YYYY`
- Soft-delete / anulación en entidades financieras

Ruta típica producción: `{userData}/rifa.db`

---

## 2. Diagrama entidad-relación (conceptual)

```
roles 1──* users
users 1──* payments | sales | settlements | expenses | audit_logs

sellers 1──* tickets (sellerId actual)
sellers 1──* ticket_assignments
sellers 1──* settlements

buyers 1──* tickets
buyers 1──* sales

tickets 1──* payments
tickets 1──1 sales          (una venta activa por boleta)
tickets 1──* settlements    (normalmente 0..1 activa)
tickets 1──* ticket_assignments

payment_methods 1──* payments | expenses

settings (singleton / key-value)
backup_records (metadatos de backups realizados)
```

---

## 3. Enums

```prisma
enum RoleCode {
  ADMIN
  USER
}

enum TicketStatus {
  DISPONIBLE
  EN_ABONOS
  CANCELADA
  PERDIDA
}

enum SellerStatus {
  ACTIVO
  INACTIVO
}

enum PaymentMethodStatus {
  ACTIVO
  INACTIVO
}

enum PaymentType {
  VENTA_INICIAL
  ABONO
}

enum PaymentOrigin {
  MANUAL
  VOZ
}

enum RecordStatus {
  ACTIVO
  ANULADO
}

enum AssignmentReason {
  ASIGNACION_INICIAL
  CAMBIO_VENDEDOR
  DEVOLUCION
}
```

---

## 4. Tablas

### 4.1 `roles`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK (uuid) | |
| code | RoleCode UNIQUE | ADMIN, USER |
| name | TEXT | |
| createdAt | DateTime | |

### 4.2 `users`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| username | TEXT UNIQUE | |
| passwordHash | TEXT | bcrypt |
| fullName | TEXT | |
| roleId | FK → roles | |
| isActive | BOOLEAN | default true |
| createdAt / updatedAt | DateTime | |

**Nunca exportar** `passwordHash`.

### 4.3 `sellers`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| fullName | TEXT | |
| documentId | TEXT UNIQUE | cédula |
| phone | TEXT | |
| address | TEXT? | |
| status | SellerStatus | |
| notes | TEXT? | |
| createdAt / updatedAt | DateTime | |

Índices: `fullName`, `documentId`, `phone`, `status`

### 4.4 `buyers`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| fullName | TEXT | |
| documentId | TEXT UNIQUE | validar duplicados |
| phone | TEXT | |
| address | TEXT? | |
| email | TEXT? | |
| notes | TEXT? | |
| createdAt / updatedAt | DateTime | |

Índices: `documentId`, `phone`, `fullName`

### 4.5 `payment_methods`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| name | TEXT UNIQUE | |
| status | PaymentMethodStatus | |
| createdAt / updatedAt | DateTime | |

### 4.6 `tickets`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| number | INT UNIQUE | 1..N; display padded |
| status | TicketStatus | |
| sellerId | FK? → sellers | asignación actual |
| buyerId | FK? → buyers | null si DISPONIBLE |
| soldAt | DateTime? | |
| totalAmount | INT | default 0 hasta venta |
| totalPaid | INT | default 0 |
| balanceDue | INT | default 0 |
| isSettled | BOOLEAN | liquidación independiente |
| settledAt | DateTime? | denormalizado opcional |
| notes | TEXT? | |
| createdAt / updatedAt | DateTime | |

Índices: `number`, `status`, `sellerId`, `buyerId`, `isSettled`, compuesto `(status, sellerId)`, `(isSettled, status)`

**Reglas derivadas (aplicadas en servicio, no solo UI):**

- `DISPONIBLE` ⇒ buyerId null, totalPaid 0, sin sale activa
- `EN_ABONOS` ⇒ balanceDue > 0 y totalPaid > 0
- `CANCELADA` ⇒ balanceDue = 0 y hubo venta (salvo regla perdida)
- `PERDIDA` ⇒ estado terminal de pago; no nuevos abonos
- `isSettled` puede ser true solo si tiene sentido liquidar (normalmente CANCELADA; permitir si negocio lo exige — **v1: liquidar solo CANCELADA**)

### 4.7 `ticket_assignments`

Historial de asignación de boletas a vendedores.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| ticketId | FK → tickets | |
| sellerId | FK → sellers | |
| assignedAt | DateTime | |
| assignedByUserId | FK? → users | |
| reason | AssignmentReason | |
| notes | TEXT? | |
| endedAt | DateTime? | null = vigente |

Índices: `ticketId`, `sellerId`, `(sellerId, endedAt)`

### 4.8 `sales`

Primera venta de una boleta.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| ticketId | FK UNIQUE | una venta “activa” por boleta |
| buyerId | FK | |
| sellerId | FK | |
| amount | INT | valor total boleta |
| soldAt | DateTime | |
| initialPayment | INT | |
| paymentMethodId | FK? | del pago inicial |
| notes | TEXT? | |
| status | RecordStatus | ACTIVO / ANULADO |
| createdByUserId | FK → users | |
| createdAt / updatedAt | DateTime | |

Índices: `sellerId`, `buyerId`, `soldAt`, `status`

### 4.9 `payments`

Cada movimiento de ingreso (pago inicial o abono). **No** usar columnas abono1..abono15.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| ticketId | FK | |
| saleId | FK? → sales | |
| type | PaymentType | VENTA_INICIAL / ABONO |
| amount | INT | > 0 |
| paidAt | DateTime | |
| paymentMethodId | FK | |
| userId | FK → users | quien registró |
| origin | PaymentOrigin | MANUAL / VOZ |
| notes | TEXT? | |
| status | RecordStatus | ACTIVO / ANULADO |
| sequence | INT | nº abono visible por boleta |
| createdAt / updatedAt | DateTime | |

Índices: `ticketId`, `paidAt`, `paymentMethodId`, `userId`, `status`, `(ticketId, status)`

### 4.10 `settlements`

Liquidación vendedor → empresa.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| ticketId | FK | |
| sellerId | FK | |
| amount | INT | usualmente totalPaid de la boleta |
| settledAt | DateTime | |
| userId | FK | |
| notes | TEXT? | |
| status | RecordStatus | |
| createdAt / updatedAt | DateTime | |

Índices: `ticketId`, `sellerId`, `settledAt`, `status`  
Unique parcial lógico: una liquidación ACTIVA por ticket (enforce en transacción).

### 4.11 `expenses`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| expenseDate | DateTime | |
| concept | TEXT | |
| category | TEXT | |
| amount | INT | |
| paymentMethodId | FK? | |
| notes | TEXT? | |
| userId | FK | |
| status | RecordStatus | |
| createdAt / updatedAt | DateTime | |

Índices: `expenseDate`, `category`, `status`

### 4.12 `audit_logs`

Append-only.

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| userId | FK? | null si sistema |
| createdAt | DateTime | fechaHora |
| module | TEXT | |
| action | TEXT | |
| entity | TEXT | |
| entityId | TEXT? | |
| previousValue | TEXT? | JSON |
| newValue | TEXT? | JSON |
| origin | TEXT | MANUAL / VOZ / SYSTEM |
| notes | TEXT? | |

Índices: `createdAt`, `userId`, `module`, `entity`, `(entity, entityId)`

**Sin DELETE desde la aplicación.**

### 4.13 `settings`

Key-value tipado por convención.

| Columna | Tipo | Notas |
|---------|------|-------|
| key | TEXT PK | |
| value | TEXT | JSON string |
| updatedAt | DateTime | |
| updatedByUserId | FK? | |

Keys iniciales:

- `companyName` → "Cafeteros del Quindío"
- `raffleName` → "RIFA Cafeteros del Quindío"
- `ticketCount` → 10000
- `defaultTicketPrice` → entero COP
- `drawDate` → ISO date
- `backupFolder` → path
- `autoBackupEnabled` → bool
- `autoBackupOnClose` → bool
- `ticketNumberPad` → 4

### 4.14 `backup_records`

Metadatos (el archivo `.db` vive en disco).

| Columna | Tipo | Notas |
|---------|------|-------|
| id | TEXT PK | |
| fileName | TEXT | |
| filePath | TEXT | |
| createdAt | DateTime | |
| trigger | TEXT | MANUAL / DAILY / ON_CLOSE / PRE_RESTORE |
| createdByUserId | FK? | |
| sizeBytes | INT | |
| notes | TEXT? | |

---

## 5. Prisma schema (borrador)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ... enums y models según tablas anteriores
```

Archivo definitivo: `prisma/schema.prisma` (Fase 2).

---

## 6. Índices prioritarios (escala 100k+)

```text
tickets(number) UNIQUE
tickets(status)
tickets(sellerId, status)
tickets(buyerId)
tickets(isSettled, status)
buyers(documentId) UNIQUE
buyers(phone)
buyers(fullName)
sellers(fullName)
sellers(documentId) UNIQUE
payments(ticketId, status)
payments(paidAt)
sales(sellerId, soldAt)
settlements(sellerId, settledAt)
audit_logs(createdAt)
audit_logs(entity, entityId)
```

SQLite maneja bien 100k filas con estos índices si las consultas filtran/paginan.

---

## 7. Integridad financiera — transacciones

### Crear venta + pago inicial

```
BEGIN
  assert ticket DISPONIBLE
  create/update buyer
  create sale ACTIVO
  create payment VENTA_INICIAL (si initialPayment > 0)
  update ticket (buyer, seller, amounts, status, soldAt)
  optional assignment touch
  audit VENTA_CREADA (+ ABONO/PAGO si aplica)
COMMIT
```

### Registrar abono

```
BEGIN
  assert ticket EN_ABONOS o CANCELADA? → solo EN_ABONOS (o CANCELADA rechaza)
  assert amount > 0 && amount <= balanceDue
  create payment ABONO
  recalc totalPaid, balanceDue, status
  audit ABONO_CREADO
COMMIT
```

### Liquidar

```
BEGIN
  assert ticket CANCELADA && !isSettled
  create settlement
  update ticket isSettled=true
  audit LIQUIDACION
COMMIT
```

### Anular abono

```
BEGIN
  mark payment ANULADO
  recalc ticket
  audit ABONO_ANULADO
COMMIT
```

Cualquier error → `ROLLBACK`.

---

## 8. Seed de desarrollo

- Roles ADMIN, USER
- Usuario admin (hash bcrypt; password solo en README de desarrollo, forzar cambio documentado)
- 5 métodos de pago
- 10 vendedores
- 50 compradores
- 100 boletas (subset) con mix de estados + algunas liquidadas
- Settings por defecto
- Varios payments y 1–2 expenses de ejemplo

Producción / primera instalación real:

- Generar N boletas vacías
- Crear admin inicial mediante wizard o seed controlado
- **No** dejar passwords débiles documentadas como “de producción”

---

## 9. Migraciones

- `prisma migrate dev` en desarrollo
- `prisma migrate deploy` al iniciar app (main) si hay pendientes
- Backup automático **antes** de migrate en producción (recomendación Fase 17)

---

## 10. Backup / restore

- Backup = copia del archivo SQLite (+ WAL checkpoint previo: `prisma.$queryRaw\`PRAGMA wal_checkpoint(FULL)\``)
- Nombre: `backup_rifa_YYYY-MM-DD_HHmm.db`
- Restore = checkpoint, cerrar client, reemplazar archivo, reabrir, invalidar sesión, audit `BACKUP_RESTORE`
- Metadato en `backup_records`

---

## 11. Consultas derivadas (no tablas extra)

| Concepto | Fuente |
|----------|--------|
| Ingresos | SUM(payments.amount) WHERE status=ACTIVO |
| Egresos | SUM(expenses.amount) WHERE status=ACTIVO |
| Balance | ingresos − egresos (filtro fecha) |
| Por cobrar | SUM(tickets.balanceDue) WHERE status IN (EN_ABONOS) |
| Pendiente liquidar | tickets CANCELADA AND isSettled=false |
| Recaudo por vendedor | payments ⨝ tickets group by sellerId |

---

## 12. Notas de consistencia

- `tickets.totalPaid` / `balanceDue` son **caché** recalculada en transacción desde payments ACTIVOS; tests deben verificar invariantes.
- `sequence` en payments: `MAX(sequence)+1` por ticket dentro de la transacción.
- Cambio de vendedor: actualizar `tickets.sellerId`, cerrar assignment vigente (`endedAt`), crear nueva fila, audit.
