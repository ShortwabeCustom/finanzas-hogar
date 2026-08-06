# INCREMENTO 4 SESIÓN 2: TESTS UNITARIOS, NOTIFICACIONES Y E2E CI — PROMPT MASTER

**Fase:** Unit testing + Notificaciones base + CI/CD  
**Duración esperada:** 2-3 sesiones (1 tests + notificaciones, 1 E2E CI, 1 QA)  
**Commits esperados:**
1. `test(debts): add unit tests for debt calculations and validation`
2. `feat(notifications): add debt-due-date alerts scaffold (email/whatsapp ready)`
3. `ci(e2e): configure playwright and github actions workflow`

**Estado previo:** INCREMENTO 4 Sesión 1 ✅ (Statements UI + LinkTransactionModal)

---

## 🎯 OBJETIVO

Completar la integración de "Deudas y Préstamos" con cobertura de tests, sistema de notificaciones y pipeline de E2E en CI:

1. **Tests Unitarios** — Cobertura ≥80% para debt-calculations.ts, validaciones Zod, APIs
2. **Notificaciones** — Sistema base para alertas de próximo vencimiento (email ready, WhatsApp scaffolded)
3. **E2E CI** — Ejecutar suite Playwright en pipeline automático (GitHub Actions)
4. **QA Completo** — Validación manual + automated

**No implementar aún:**
- Notificaciones automáticas scheduled (Incremento 5)
- SMS (Twilio integration — futuro)
- Push notifications web (futuro)
- Recomendaciones IA (futuro)

---

## 📋 SECCIÓN 1: TESTS UNITARIOS

### 1.1 Archivo: tests/unit/debt-calculations.test.ts

**Test Suite 1: calculateDebtTotals**

```typescript
describe('calculateDebtTotals', () => {
  test('should calculate total paid and balance correctly', () => {
    const result = calculateDebtTotals(10000, [
      { principalAmount: 2000, interestAmount: 100, feeAmount: 50, penaltyAmount: 0 },
      { principalAmount: 3000, interestAmount: 150, feeAmount: 0, penaltyAmount: 0 },
    ]);
    
    expect(result.principalPaid).toBe(5000);
    expect(result.interestPaid).toBe(250);
    expect(result.currentBalance).toBe(5000);
    expect(result.totalPaid).toBe(5400);
    expect(result.isFullyPaid).toBe(false);
  });
  
  test('should handle zero payments', () => {
    const result = calculateDebtTotals(10000, []);
    expect(result.principalPaid).toBe(0);
    expect(result.currentBalance).toBe(10000);
    expect(result.isFullyPaid).toBe(false);
  });
  
  test('should mark as paid off when balance ≤ 0', () => {
    const result = calculateDebtTotals(5000, [
      { principalAmount: 5500, interestAmount: 0, feeAmount: 0, penaltyAmount: 0 },
    ]);
    expect(result.isFullyPaid).toBe(true);
    expect(result.currentBalance).toBe(0); // clamped
  });
  
  test('should not allow negative balance', () => {
    const result = calculateDebtTotals(5000, [
      { principalAmount: 10000, interestAmount: 0, feeAmount: 0, penaltyAmount: 0 },
    ]);
    expect(result.currentBalance).toBeGreaterThanOrEqual(0);
  });
});
```

**Test Suite 2: calculateDebtProgress**

```typescript
describe('calculateDebtProgress', () => {
  test('should calculate progress as percentage', () => {
    const result = calculateDebtProgress(10000, 7500);
    expect(result.progress).toBe(75);
    expect(result.isPaidOff).toBe(false);
  });
  
  test('should return 100% when fully paid', () => {
    const result = calculateDebtProgress(10000, 10000);
    expect(result.progress).toBe(100);
    expect(result.isPaidOff).toBe(true);
  });
  
  test('should return 0% when nothing paid', () => {
    const result = calculateDebtProgress(10000, 0);
    expect(result.progress).toBe(0);
    expect(result.isPaidOff).toBe(false);
  });
});
```

**Test Suite 3: findNextDueDate**

```typescript
describe('findNextDueDate', () => {
  test('should return earliest pending due date', () => {
    const installments = [
      { dueDate: '2026-08-15', status: 'PAID' },
      { dueDate: '2026-08-20', status: 'PENDING' },
      { dueDate: '2026-08-25', status: 'PENDING' },
    ];
    const result = findNextDueDate(installments);
    expect(result).toBe('2026-08-20');
  });
  
  test('should return null if all paid', () => {
    const installments = [
      { dueDate: '2026-08-15', status: 'PAID' },
      { dueDate: '2026-08-20', status: 'PAID' },
    ];
    const result = findNextDueDate(installments);
    expect(result).toBeNull();
  });
  
  test('should return null for empty list', () => {
    const result = findNextDueDate([]);
    expect(result).toBeNull();
  });
});
```

**Test Suite 4: validateDebtPayment**

```typescript
describe('validateDebtPayment', () => {
  test('should accept valid desglose that sums to payment amount', () => {
    const result = validateDebtPayment(400, 60, 30, 10, 5000); // total 500
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
  
  test('should reject principal > current balance', () => {
    const result = validateDebtPayment(5500, 0, 0, 0, 5000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Capital no puede superar');
  });
  
  test('should reject negative amounts', () => {
    const result = validateDebtPayment(-100, 0, 0, 0, 5000);
    expect(result.valid).toBe(false);
  });
  
  test('should allow zero non-principal components', () => {
    const result = validateDebtPayment(500, 0, 0, 0, 5000);
    expect(result.valid).toBe(true);
  });
});
```

### 1.2 Archivo: tests/unit/debt-validation.test.ts

**Test Suite 1: debtFormSchema**

```typescript
describe('debtFormSchema', () => {
  test('should accept valid debt form', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test Card',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };
    expect(debtFormSchema.safeParse(data).success).toBe(true);
  });
  
  test('should reject missing name', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };
    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
  
  test('should reject currentPrincipal > originalPrincipal', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test',
      originalPrincipal: 5000,
      currentPrincipal: 6000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };
    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
```

**Test Suite 2: debtPaymentSchema**

```typescript
describe('debtPaymentSchema', () => {
  test('should accept valid payment', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 400,
      interestAmount: 60,
      feeAmount: 30,
      penaltyAmount: 10,
      paymentMethod: 'TRANSFER',
    };
    expect(debtPaymentSchema.safeParse(data).success).toBe(true);
  });
  
  test('should reject negative principal', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: -100,
      interestAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      paymentMethod: 'TRANSFER',
    };
    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
  
  test('should accept zero interest/fees', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 500,
      interestAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      paymentMethod: 'TRANSFER',
    };
    expect(debtPaymentSchema.safeParse(data).success).toBe(true);
  });
});
```

### 1.3 Archivo: tests/unit/debt-api.test.ts

**Test Suite 1: POST /api/personal/debts (create)**

```typescript
describe('POST /api/personal/debts', () => {
  test('should create debt with valid payload', async () => {
    const payload = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'New Debt',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };
    
    const res = await fetch('/api/personal/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    expect(res.status).toBe(201);
    const debt = await res.json();
    expect(debt.id).toBeDefined();
    expect(debt.userId).toBe(sessionUser.id);
  });
  
  test('should reject invalid payload', async () => {
    const res = await fetch('/api/personal/debts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Only Name' }),
    });
    expect(res.status).toBe(400);
  });
  
  test('should validate ownership (no cross-user access)', async () => {
    // Create debt as user A
    // Try to access as user B → 404
  });
});
```

**Test Suite 2: PATCH /api/personal/debts/[id]**

```typescript
describe('PATCH /api/personal/debts/[id]', () => {
  test('should update only allowed fields', async () => {
    const res = await fetch(`/api/personal/debts/${debtId}`, {
      method: 'PATCH',
      body: JSON.stringify({ currentPrincipal: 2000 }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.currentPrincipal).toBe(2000);
  });
  
  test('should reject updating userId', async () => {
    // Attempt to change userId → should be ignored or error
  });
});
```

**Test Suite 3: DELETE /api/personal/debts/[id]**

```typescript
describe('DELETE /api/personal/debts/[id]', () => {
  test('should delete debt with no payments', async () => {
    const res = await fetch(`/api/personal/debts/${emptyDebtId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);
  });
  
  test('should reject deletion if has payments (409)', async () => {
    // Create debt → add payment → try delete
    const res = await fetch(`/api/personal/debts/${debtWithPaymentsId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toHaveProperty('error');
  });
});
```

### 1.4 Coverage Targets

- ✅ debt-calculations.ts: **≥ 90%** (all paths, edge cases)
- ✅ validations/debt.ts: **≥ 85%** (schema parsing, errors)
- ✅ API routes: **≥ 80%** (happy path, error cases, auth)

**Ejecución:**
```bash
npm run test:unit                  # Ejecutar todos los tests unitarios
npm run test:coverage              # Generar reporte de cobertura
npm run test:watch                 # Watch mode para desarrollo
```

---

## 🔔 SECCIÓN 2: NOTIFICACIONES

### 2.1 Modelo: DebtNotification

**Ubicación:** `prisma/schema.prisma`

```prisma
enum NotificationStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

enum NotificationType {
  EMAIL
  WHATSAPP
  PUSH
}

model DebtNotification {
  id                String              @id @default(cuid())
  userId            String
  debtId            String
  type              NotificationType
  status            NotificationStatus  @default(PENDING)
  subject           String?             // Para EMAIL
  message           String
  recipientEmail    String?
  recipientPhone    String?
  dueDate           DateTime
  daysBefore        Int                 // Enviar N días antes (default 3)
  sentAt            DateTime?
  failureReason     String?
  retryCount        Int                 @default(0)
  maxRetries        Int                 @default(3)
  lastRetryAt       DateTime?
  nextRetryAt       DateTime?
  externalId        String?             // ID de proveedor (SendGrid, Twilio)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  user User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  debt DebtAccount    @relation(fields: [debtId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([dueDate])
  @@index([userId, debtId])
}
```

### 2.2 API: Crear Notificación

**Endpoint:** `POST /api/personal/debts/[id]/notifications`

```typescript
Body: {
  type: 'EMAIL' | 'WHATSAPP',
  daysBefore: 3, // Enviar 3 días antes
  recipientEmail?: string, // default: user.email
  recipientPhone?: string, // Para WhatsApp
}

Response: {
  id: string,
  debtId: string,
  type: NotificationType,
  status: NotificationStatus,
  dueDate: DateTime,
  daysBefore: number,
  nextRetryAt: DateTime | null,
}
```

**Validación:**
- ✅ Deuda pertenece al usuario
- ✅ daysBefore: 0-30 días
- ✅ Email válido si type=EMAIL
- ✅ Phone válido si type=WHATSAPP
- ✅ No crear duplicada (same debtId, type, daysBefore)

### 2.3 Servicio: NotificationService

**Ubicación:** `src/lib/notifications/notification-service.ts`

```typescript
export interface NotificationPayload {
  type: 'EMAIL' | 'WHATSAPP';
  userId: string;
  debtId: string;
  debtName: string;
  debtAmount: number;
  dueDate: Date;
  daysBefore: number;
  recipient: {
    email?: string;
    phone?: string;
    name?: string;
  };
}

export class NotificationService {
  async sendEmailNotification(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Stub: Ready for SendGrid integration
    console.log('EMAIL:', payload);
    return { success: true, messageId: 'email-stub' };
  }

  async sendWhatsAppNotification(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Stub: Ready for Twilio integration
    console.log('WHATSAPP:', payload);
    return { success: true, messageId: 'wa-stub' };
  }

  async scheduleNotifications(): Promise<void> {
    // SCHEDULED TASK: Run every hour
    // 1. Find all PENDING notifications where nextRetryAt ≤ now
    // 2. Send via appropriate provider
    // 3. Update status (SENT | FAILED + nextRetryAt)
  }

  async cancelNotification(notificationId: string): Promise<void> {
    // Set status = CANCELLED
  }
}
```

### 2.4 Background Job: Enviar Notificaciones

**Ubicación:** `src/lib/notifications/scheduler.ts`

```typescript
/**
 * Run every hour via external scheduler (n8n, cron, etc.)
 * Or use Vercel Cron (app/api/cron/send-debt-notifications/route.ts)
 */

export async function processPendingNotifications() {
  const service = new NotificationService();
  
  const pending = await prisma.debtNotification.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: new Date() },
    },
    include: { user: true, debt: true },
    take: 100, // Batch size
  });

  for (const notification of pending) {
    try {
      let result;
      if (notification.type === 'EMAIL') {
        result = await service.sendEmailNotification({/* ... */});
      } else {
        result = await service.sendWhatsAppNotification({/* ... */});
      }

      if (result.success) {
        await prisma.debtNotification.update({
          where: { id: notification.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            externalId: result.messageId,
            retryCount: 0,
          },
        });
        trackDebtEvent('debt_notification_sent', {
          type: notification.type,
          daysBefore: notification.daysBefore,
        });
      } else {
        // Retry logic
        const nextRetryAt = new Date(Date.now() + (30 * 60 * 1000)); // 30 min later
        if (notification.retryCount < notification.maxRetries) {
          await prisma.debtNotification.update({
            where: { id: notification.id },
            data: {
              status: 'PENDING',
              retryCount: notification.retryCount + 1,
              lastRetryAt: new Date(),
              nextRetryAt,
              failureReason: result.error,
            },
          });
        } else {
          await prisma.debtNotification.update({
            where: { id: notification.id },
            data: {
              status: 'FAILED',
              failureReason: `Max retries exceeded: ${result.error}`,
            },
          });
        }
      }
    } catch (error) {
      console.error('[Notification]', error);
    }
  }
}
```

### 2.5 Endpoint Cron (Optional): Vercel Cron

**Ubicación:** `src/app/api/cron/send-debt-notifications/route.ts`

```typescript
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos max

export async function POST(req: NextRequest) {
  // Verify request is from Vercel (check Authorization header)
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await processPendingNotifications();
    return NextResponse.json({ success: true, processed: 'OK' });
  } catch (error) {
    console.error('[Cron]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Configuración en `vercel.json`:**
```json
{
  "crons": [{
    "path": "/api/cron/send-debt-notifications",
    "schedule": "0 * * * *"
  }]
}
```

### 2.6 UI: Settings Página Notificaciones

**Ubicación:** `src/app/(app)/personal/settings/notifications.tsx`

**Features:**
- ✅ Listar todas las deudas del usuario
- ✅ Para cada deuda: toggle para EMAIL (3 días antes) + toggle para WHATSAPP (1 día antes)
- ✅ Mostrar email usado (user.email) y campo phone (Si se cambia, actualiza todas las WHATSAPP)
- ✅ Historial: listar últimas 20 notificaciones enviadas/fallidas
- ✅ Botón "Enviar ahora" (test notificación)
- ✅ Status: "Pending", "Sent (5 ago)", "Failed (retry 2/3)"

---

## 🧪 SECCIÓN 3: E2E EN CI/CD

### 3.1 Playwright Config

**Archivo:** `playwright.config.ts` (crear si no existe)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // 1 worker en CI para estabilidad
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['github'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3.2 GitHub Actions

**Ubicación:** `.github/workflows/e2e.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: finanzas_hogar
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run db:push
      - run: npm run db:seed
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### 3.3 Scripts en package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 📝 SECCIÓN 4: ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos

```
tests/unit/debt-calculations.test.ts
tests/unit/debt-validation.test.ts
tests/unit/debt-api.test.ts
src/lib/notifications/notification-service.ts
src/lib/notifications/scheduler.ts
src/app/api/personal/debts/[id]/notifications/route.ts
src/app/api/cron/send-debt-notifications/route.ts
src/app/(app)/personal/settings/notifications.tsx
.github/workflows/e2e.yml
playwright.config.ts
```

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Agregar modelo DebtNotification |
| `src/lib/analytics.ts` | Agregar evento debt_notification_sent |
| `package.json` | Scripts test:e2e, test:unit; verificar @playwright/test presente |
| `.env.example` | CRON_SECRET, NOTIFICATION_SETTINGS |
| `finanzas.md` | Actualizar estado Incremento 4 Sesión 2 |

---

## 🚀 ORDEN RECOMENDADO

### Día 1: Unit Tests
- Tests unitarios (3 archivos: calculations, validation, api)
- Coverage ≥ 80%
- Git: `test(debts): add unit tests for debt calculations and validation`

### Día 2: Notificaciones Base
- Schema DebtNotification
- NotificationService (stubs email/whatsapp)
- Settings UI notificaciones
- Cron endpoint (opcional, Vercel compatible)
- Git: `feat(notifications): add debt-due-date alerts scaffold (email/whatsapp ready)`

### Día 3: E2E CI/CD
- Playwright config
- GitHub Actions workflow
- Test en CI
- Git: `ci(e2e): configure playwright and github actions workflow`

### Día 4: QA + Refinamiento
- Manual testing
- Bug fixes
- Documentation
- Commit + Push

---

## ✅ CRITERIOS DE ACEPTACIÓN

Incremento 4 Sesión 2 completado cuando:

1. ✅ Unit tests: ≥ 80% coverage (calculations, validation, API)
2. ✅ Todos los tests unitarios pasan
3. ✅ DebtNotification modelo en schema
4. ✅ NotificationService scaffolded (email/whatsapp stubs)
5. ✅ Settings UI: crear notificaciones por deuda
6. ✅ Cron endpoint ready (Vercel Cron compatible)
7. ✅ Playwright config + tests e2e (debts.spec.ts) funcionando localmente
8. ✅ GitHub Actions workflow ejecutando tests en CI
9. ✅ Test results + artifacts guardados en CI
10. ✅ Sin errores TypeScript
11. ✅ Build de producción exitoso
12. ✅ Documentación actualizada (finanzas.md)

---

## 🔗 REFERENCIAS

- Documentación deudas: `/docs/debts-loans.md`
- INCREMENTO 4 Sesión 1: `/INCREMENTO_4_MASTER.md` (completada)
- Statements UI (previo): `src/components/personal/debts/LinkTransactionModal.tsx`
- Validaciones deuda: `src/lib/validations/debt.ts`
- Debt calculations: `src/lib/financial/debt-calculations.ts`

---

**Fin del Prompt Master para Incremento 4 Sesión 2**

Proceder cuando Incremento 4 Sesión 1 sea validado y merged. Esta sesión agrega comprehensive testing, notificaciones base, y CI pipeline para deudas.
