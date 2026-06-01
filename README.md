# Finanzas del Hogar

Sistema de control de finanzas personales y del hogar con integración WhatsApp via n8n. Registra pagos, analiza gastos, importa estados de cuenta bancarios y genera un plan de recuperación financiera determinístico.

**URL:** https://finanzas.torrax.cloud

---

## Arquitectura general

```
WhatsApp / PDF / Excel / XML / Ticket
        │
      n8n (puerto 5678, loopback)
        │
finanzas-processor (Node.js + TS)   ← /var/www/finanzas-processor
        │
finanzas-hogar API (Next.js)        ← este repo
        │
  PostgreSQL — base: finanzas_hogar (Docker, 127.0.0.1:5432)
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| ORM | Prisma 7 |
| Base de datos | PostgreSQL (`finanzas_hogar`, Docker) |
| Auth | NextAuth.js v4 (JWT + Credentials) |
| Formularios | React Hook Form + Zod |
| Tablas | TanStack Table v8 |
| Gráficas | Recharts |
| Package manager | npm |
| Proceso | PM2 (`finanzas-hogar`, puerto 4000) |

---

## Módulos principales

### Finanzas del hogar
Control de pagos compartidos, despensa y categorías del hogar para múltiples usuarios.

### Finanzas personales
Gestión de pagos personales con clasificación jerárquica, tarjetas/cuentas, estados de cuenta bancarios y score financiero mensual.

### Plan de Recuperación Financiera (`/financial/recovery-plan`)
Módulo determinístico (sin IA generativa) que calcula:

| # | Componente | Descripción |
|---|-----------|-------------|
| 1 | **Score financiero 0–100** | Flujo libre (0–40 pts) + deuda vencida (0–35 pts) + urgencia (0–25 pts) |
| 2 | **Resumen financiero** | Ingreso/egreso promedio, totales vencido/pendiente/dueIn7/dueIn15, flujo libre |
| 3 | **Matriz priorizada** | P1 vencidos → P2 ≤7 días → P3 8–15 días recurrentes → P4 resto (top 20) |
| 4 | **Proyección 3 meses** | `remainingDebt` vs `cumulativePaid`, meses para ponerse al corriente |
| 5 | **Historial del score** | `FinancialSnapshot` upsert mensual automático (fire-and-forget) |
| 6 | **Sugerencias de recorte** | Top 5 categorías variables con reducción sugerida del 30% |
| 7 | **Insights** | Tarjetas risk/warning/opportunity/info por reglas |

### Integración WhatsApp (n8n)
Flujos automáticos para registrar pagos y consultar estado financiero por WhatsApp sin abrir la app.

---

## Modelo de datos (Prisma)

### Hogar
| Modelo | Descripción |
|--------|-------------|
| `User` | Usuarios con roles `ADMIN · EDITOR · VIEWER` |
| `Payment` | Pagos del hogar con período, método y estado |
| `Category` | Categorías globales (`PAYMENT · PANTRY · BOTH`) |
| `PantryItem` | Artículos de despensa |
| `PantryPurchaseHistory` | Historial de compras de despensa |

### Finanzas personales
| Modelo | Descripción |
|--------|-------------|
| `PersonalPayment` | Pago personal con folio único, `financialClass`, período y estado |
| `PersonalCategory` | Categorías por usuario (`userId + name` únicos) |
| `PersonalCard` | Tarjetas y cuentas bancarias |
| `BankAccount` | Cuenta bancaria vinculada |
| `BankStatement` | Estado de cuenta importado |
| `BankTransaction` | Transacción deduplicada por `txnHash` |
| `FinancialSnapshot` | Score financiero mensual (`@@unique[userId, date]`) |

### Enums clave

```
Period:          ONCE | WEEKLY | BIWEEKLY | MONTHLY | BIMONTHLY | QUARTERLY | SEMIANNUAL | ANNUAL
PaymentMethod:   CASH | CREDIT_CARD | DEBIT_CARD | TRANSFER | CHECK | OTHER
PaymentStatus:   PENDING | PAID | OVERDUE | CANCELLED
FinancialClass:  INCOME | EXPENSE | TRANSFER | SAVING
```

---

## API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET/POST` | `/api/internal/payments` | Usada por n8n (header `x-internal-token` requerido) |
| `GET` | `/api/financial/recovery-plan?months=1\|3\|6` | Plan de recuperación financiera |
| `GET` | `/api/financial/statements` | Estados de cuenta bancarios |
| `GET` | `/api/financial/transactions` | Transacciones bancarias |
| `POST` | `/api/financial/sync` | Sync de transacciones bancarias |
| `PATCH` | `/api/personal/payments/[id]/mark-paid` | Marcar PENDING/OVERDUE → PAID |
| `GET` | `/api/personal/dashboard` | Dashboard de finanzas personales |
| `GET` | `/api/dashboard` | Dashboard de finanzas del hogar |

---

## Estructura del proyecto

```
/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/             # Finanzas del hogar
│   │   │   ├── payments/              # Pagos del hogar
│   │   │   ├── categories/            # Categorías del hogar
│   │   │   ├── pantry/                # Despensa
│   │   │   ├── users/                 # Gestión de usuarios
│   │   │   ├── personal/
│   │   │   │   ├── dashboard/         # Dashboard personal
│   │   │   │   ├── payments/          # Pagos personales
│   │   │   │   ├── categories/        # Categorías personales
│   │   │   │   ├── cards/             # Tarjetas y cuentas
│   │   │   │   └── statements/        # Estados de cuenta bancarios
│   │   │   └── financial/
│   │   │       └── recovery-plan/     # Plan de recuperación financiera
│   │   └── api/
│   │       ├── dashboard/
│   │       ├── categories/[id]/
│   │       ├── financial/
│   │       │   ├── recovery-plan/
│   │       │   ├── statements/
│   │       │   ├── transactions/
│   │       │   └── sync/
│   │       ├── internal/payments/     # Webhook para n8n
│   │       └── personal/
│   │           ├── dashboard/
│   │           └── payments/[id]/mark-paid/
│   ├── components/
│   │   ├── layout/                    # AppLayout · Header · Sidebar
│   │   └── payments/                  # PaymentForm · PaymentTable
│   ├── hooks/
│   │   └── useLimpiarCampos.ts
│   ├── lib/
│   │   └── financial/
│   │       ├── recovery-plan.ts       # Lógica del plan (score, matriz, proyección)
│   │       ├── import.ts              # Importación de estados de cuenta
│   │       └── sync.ts                # Sync de transacciones bancarias
│   └── types/
│       └── financial.ts
├── prisma/
│   └── schema.prisma
└── finanzas.md                        # Documentación operativa completa
```

---

## Variables de entorno (`.env`)

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/finanzas_hogar"
NEXTAUTH_SECRET=""
NEXTAUTH_URL="https://finanzas.torrax.cloud"
INTERNAL_TOKEN="fh-internal-n8n-2026-xK9mP3qL7vR2nT8w"
```

---

## Instalación local

### Prerrequisitos

- Node.js 20+
- PostgreSQL 15+ (local o Docker)

### Setup

```bash
git clone git@github.com:ShortwabeCustom/finanzas-hogar.git
cd finanzas-hogar

npm install

cp .env.example .env   # Editar con tus credenciales

npm run db:push        # Sync schema sin migraciones
npm run db:seed        # Datos demo (admin/editor/viewer)

npm run dev            # Puerto 4000
```

---

## Scripts

```bash
npm run dev            # Servidor de desarrollo (puerto 4000)
npm run build          # Build de producción
npm run db:push        # Sync schema sin migraciones
npm run db:migrate     # Ejecutar migraciones pendientes
npm run db:seed        # Seed con usuarios demo
npm run db:studio      # Prisma Studio GUI
npm run db:generate    # Regenerar cliente Prisma
```

---

## n8n — Integración WhatsApp

**URL local:** `http://localhost:5678`

| Workflow | Webhook |
|----------|---------|
| Finanzas con amor (hogar) | `/webhook/whatsapp-finanzas` |
| Finanzas personales | `/finanzas-personales-whatsapp` |

### Fixes críticos conocidos

1. **Grupos WhatsApp** (`not-acceptable`): enviar a `senderJid` (key.participant), no al JID del grupo
2. **webhookId se resetea** al reiniciar n8n — actualizar manualmente en SQLite:
   ```sql
   UPDATE webhook_entity SET webhookId='whatsapp-finanzas-001' WHERE workflowId='74t4EGI8TmuJ3p7m';
   ```
3. **Llamadas desde container Docker** → usar `172.17.0.1:4000` en lugar de `localhost`

---

## Deploy en producción (VPS)

```bash
cd /var/www/finanzas-hogar
npm run build
pm2 restart finanzas-hogar --update-env
```

### Logs

```bash
pm2 logs finanzas-hogar --lines 50
```

---

## Infraestructura

| Item | Valor |
|------|-------|
| URL | `https://finanzas.torrax.cloud` |
| Puerto | `4000` |
| PM2 name | `finanzas-hogar` |
| Nginx config | `/etc/nginx/sites-available/finanzas.torrax.cloud` |
| SSL | Let's Encrypt (Certbot) |
| Base de datos | PostgreSQL en Docker `torre_de_control_db` (127.0.0.1:5432) |
| n8n | `http://localhost:5678` (loopback) |

---

## Pendientes

| Tarea | Prioridad |
|-------|-----------|
| Resumen ejecutivo con IA (Claude Haiku, 3 bullets) | P3 |
| Chat CFO personal — panel lateral de preguntas | P3 |
| Notificación WhatsApp 3 días antes de vencimiento | P4 |
| Alerta crítica si `financialStatus === "critical"` | P4 |
| Caché del endpoint recovery-plan (5 min, `unstable_cache`) | P5 |
| Tests E2E (Playwright) | P5 |
