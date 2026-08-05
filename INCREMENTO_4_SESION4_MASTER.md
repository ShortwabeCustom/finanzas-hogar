# INCREMENTO 4 SESIÓN 4: E2E TESTS + QA MANUAL + SENDGRID/TWILIO INTEGRATION — PROMPT MASTER

**Fase:** Notificaciones completas (UI + backend + cron + integraciones reales + tests + QA)  
**Duración esperada:** 2-3 sesiones (1 E2E+QA, 1-2 SendGrid/Twilio)  
**Commits esperados:**
1. `test(e2e): complete debt workflow and notification tests with playwright`
2. `feat(notifications): add sendgrid email and twilio whatsapp integration`
3. `test(notifications): add unit tests for email/whatsapp sending`
4. `docs: update finanzas.md for INCREMENTO 4 Sesión 4`

**Estado previo:** INCREMENTO 4 Sesión 3 ✅ (Cron endpoint, DB migration, API endpoints, UI settings)

---

## 🎯 OBJETIVO

Completar el módulo de notificaciones con:
1. **E2E Tests** — Suite Playwright: crear deuda → pagar → recibir notificaciones
2. **QA Manual** — 40+ checkpoints (UI, API, cron, mobile, error handling)
3. **Email Real** — SendGrid integration en NotificationService
4. **WhatsApp Real** — Twilio integration en NotificationService
5. **Validación** — Performance baseline, edge cases, rollback plan

**No implementar aún:**
- Push notifications (futuro)
- SMS SMS adicionales (futuro)
- Analytics eventos (futuro)

---

## 📋 SECCIÓN 1: E2E TESTS CON PLAYWRIGHT

### 1.1 Completar `/tests/e2e/debts.spec.ts`

El archivo ya contiene tests básicos (skeleton). Necesita completarse:

**Tests a agregar/mejorar:**

#### Test 1: Crear deuda completa (ya existe, mejorar)
```typescript
test('Crear deuda con cuotas mensuales', async ({ page }) => {
  // Precondiciones: login como EDITOR
  // 1. Navegar a /personal/debts
  // 2. Click "Nueva deuda"
  // 3. Llenar:
  //    - Tipo: CREDIT_CARD
  //    - Dirección: PAYABLE
  //    - Nombre: "Tarjeta Santander ORO"
  //    - Contrapartida: "Banco Santander"
  //    - Monto original: $8,000
  //    - Monto actual: $8,000
  //    - Fecha inicio: 2026-08-01
  //    - Modo de pago: INSTALLMENTS
  //    - Cuotas: 12
  //    - Frecuencia: MONTHLY
  // 4. Click "Guardar"
  // Verificar:
  // - Toast "Deuda creada exitosamente"
  // - Deuda aparece en lista
  // - Status: PENDING
  // - Progreso: 0%
});
```

#### Test 2: Registrar 3 pagos (ya existe, mejorar)
```typescript
test('Registrar serie de abonos y ver progreso actualizado', async ({ page }) => {
  // Precondiciones: deuda existente $8,000 con 12 cuotas
  // Acciones:
  // 1. Navegar a deuda detail
  // 2. Click "Registrar abono" → $2,000 (25%)
  // 3. Click "Registrar abono" → $2,000 (50%)
  // 4. Click "Registrar abono" → $2,000 (75%)
  // Verificar después de cada abono:
  // - Progreso actualizado (25% → 50% → 75%)
  // - Color progreso correcto (indigo para 1-99%)
  // - Lista de abonos actualizada
  // - Saldo actual correcto
});
```

#### Test 3: Liquidar deuda completamente
```typescript
test('Liquidar deuda completa (100%)', async ({ page }) => {
  // Precondiciones: deuda con $2,000 restantes
  // Acciones:
  // 1. Registrar último abono de $2,000
  // Verificar:
  // - Progreso: 100% (verde)
  // - Status: PAID_OFF (badge dorado)
  // - Deuda desaparece de "Deudas Pendientes"
  // - Aparece en historial completadas
});
```

#### Test 4: Configurar notificaciones
```typescript
test('Configurar notificaciones por email y WhatsApp', async ({ page }) => {
  // Precondiciones: login, deuda existente, teléfono no configurado
  // Acciones:
  // 1. Navegar a /personal/settings/notifications
  // 2. Verificar email prerellenado
  // 3. Click "Editar" teléfono → ingresar "+56912345678" → "Guardar"
  // 4. Buscar deuda "Tarjeta Santander ORO"
  // 5. Check "Notificación por Email" → Selector "3 días antes"
  // 6. Check "Notificación por WhatsApp" → Selector "1 día antes"
  // Verificar:
  // - Toast "Notificación configurada"
  // - Toggles checked
  // - Selectores muestran valores correctos
});
```

#### Test 5: Enviar notificación de prueba
```typescript
test('Enviar notificación de prueba', async ({ page }) => {
  // Precondiciones: notificaciones configuradas
  // Acciones:
  // 1. En tarjeta de deuda, click "Enviar ahora"
  // Verificar:
  // - Toast "Notificación de prueba enviada"
  // - Sin errores en console
  // - Status "SENT" en historial (refresh página)
});
```

#### Test 6: Ver historial de notificaciones
```typescript
test('Historial de notificaciones con estado y fechas', async ({ page }) => {
  // Precondiciones: notificaciones enviadas (test send)
  // Acciones:
  // 1. En settings/notifications, scroll a "Historial"
  // Verificar:
  // - Tabla visible con columnas: Deuda, Tipo, Estado, Fecha
  // - Status badges con colores: SENT (verde), FAILED (rojo), PENDING (amber)
  // - Fechas en formato "5 de agosto de 2026"
  // - Desktop: tabla; Mobile (375px): cards
});
```

#### Test 7: Cron endpoint (sin auth → 401)
```typescript
test('Cron endpoint rechaza request sin CRON_SECRET', async ({ request }) => {
  // Acciones:
  // 1. POST /api/cron/send-debt-notifications sin header Authorization
  // Verificar:
  // - HTTP 401
  // - JSON: { error: "Unauthorized" }
});
```

#### Test 8: Cron endpoint (con auth → 200)
```typescript
test('Cron endpoint procesa notificaciones con CRON_SECRET válido', async ({ request }) => {
  // Precondiciones: deudas con notificaciones PENDING cuyo dueDate = hoy - daysBefore
  // Acciones:
  // 1. POST /api/cron/send-debt-notifications con header Authorization: Bearer <CRON_SECRET>
  // Verificar:
  // - HTTP 200
  // - JSON: { success: true, processed: N, failed: 0, timestamp: "..." }
  // - Log contiene "[Cron] ✓ Notificación ... enviada"
});
```

### 1.2 Setup Playwright CI

**`.github/workflows/e2e.yml`** (actualizar si existe, o crear):

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: finanzas_hogar
          POSTGRES_USER: postgres
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
          node-version: 20
          cache: npm
      
      - run: npm ci
      
      - run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/finanzas_hogar
      
      - run: npm run db:seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/finanzas_hogar
      
      - run: npx playwright install --with-deps
      
      - run: npm run dev &
      - run: npx wait-on http://localhost:4000 --timeout 30000
      
      - run: npm run test:e2e
        env:
          PLAYWRIGHT_TEST_BASE_URL: http://localhost:4000
          NEXTAUTH_SECRET: test-secret-key-for-ci
          CRON_SECRET: test-cron-secret-for-ci
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### 1.3 Configuración local

```bash
# Instalar Playwright browsers
npx playwright install

# Ejecutar tests en modo watch
npm run test:e2e:watch

# Ejecutar en UI mode (recomendado para debugging)
npm run test:e2e:ui

# Debug mode (inspector)
npm run test:e2e:debug
```

**`package.json` scripts (verificar/agregar):**
```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:watch": "playwright test --watch",
  "test:e2e:debug": "playwright test --debug"
}
```

---

## 📊 SECCIÓN 2: QA MANUAL

### 2.1 Checklist Completo (40+ items)

#### Autenticación & Acceso
- [ ] Login como ADMIN accede a `/personal/settings/notifications`
- [ ] Login como EDITOR accede a `/personal/settings/notifications`
- [ ] Login como VIEWER accede a `/personal/settings/notifications` (read-only)
- [ ] User no autenticado redirigido a `/login`
- [ ] CRON_SECRET faltante → cron endpoint retorna 401

#### Settings Page — Datos de Contacto
- [ ] Email prerellenado (read-only) desde sesión
- [ ] Teléfono inicialmente vacío (null)
- [ ] Click "Editar" activa input teléfono
- [ ] Ingresar "+56912345678" → "Guardar" → teléfono actualizado
- [ ] Click "Editar" nuevamente muestra teléfono guardado
- [ ] Ingresar teléfono inválido (`abc`) → validación cliente
- [ ] Toast "Teléfono guardado" en éxito
- [ ] Toast "No se pudo guardar el teléfono" en error

#### Settings Page — Notificaciones por Deuda
- [ ] Lista muestra todas las deudas PAYABLE
- [ ] Cada deuda muestra: nombre, saldo, vencimiento
- [ ] Botón "Enviar ahora" visible por deuda
- [ ] Toggle Email disabled si sin teléfono → enabled después de guardar
- [ ] Toggle WhatsApp disabled si sin teléfono
- [ ] Selector días (1-7 para email, 0-3 para WhatsApp)
- [ ] Mensajes descriptivos: "Recibirás un email...", "Requiere teléfono para habilitar"

#### Settings Page — Crear/Editar Notificación
- [ ] POST `/api/personal/debts/[id]/notifications` crea notificación
- [ ] Validación: tipo = EMAIL | WHATSAPP
- [ ] Validación: daysBefore en [0, 30]
- [ ] Validación: email requerido si type=EMAIL
- [ ] Validación: phone requerido si type=WHATSAPP
- [ ] Validación: sin duplicados (same type + daysBefore)
- [ ] Response 409 si duplicado: "Ya existe una notificación..."
- [ ] Response 400 si validación falla con mensaje descriptivo

#### Settings Page — Cancelar Notificación
- [ ] DELETE `/api/personal/debts/[id]/notifications?notificationId=X` marca CANCELLED
- [ ] UI actualiza (toggle desactiva automáticamente)
- [ ] Status en historial cambia a CANCELLED

#### Settings Page — Historial
- [ ] Tabla desktop visible
- [ ] Columnas: Deuda, Tipo (📧/💬), Estado, Fecha
- [ ] Status badges con colores:
  - SENT: verde (emerald-50/700)
  - FAILED: rojo (red-50/700)
  - PENDING: ámbar (amber-50/700)
  - CANCELLED: gris (gray-50/600)
- [ ] Últimas 20 notificaciones listadas
- [ ] Ordenamiento: más recientes primero
- [ ] Mobile (375px): cards en lugar de tabla
- [ ] Scroll infinito o paginación funciona

#### API `/api/personal/debts/[id]/notifications/test`
- [ ] POST crea DebtNotification con status=SENT
- [ ] Envía notificación de prueba via NotificationService
- [ ] Response: `{ success: true, messageId, message }`
- [ ] Response 404 si deuda no existe o no pertenece al usuario
- [ ] Toast cliente: "Notificación de prueba enviada"

#### API `/api/personal/notifications/history`
- [ ] GET retorna array de últimas 20 notificaciones
- [ ] Include debt.name, debt.currentPrincipal
- [ ] Ordenadas por createdAt DESC
- [ ] Query param `limit` respetado (max 100)
- [ ] Response 401 sin sesión

#### API `/api/personal/user/phone`
- [ ] PUT actualiza campo phone en User
- [ ] Validación: phone opcional (null permitido)
- [ ] Response incluye updated user: { id, name, email, phone }
- [ ] Response 401 sin sesión
- [ ] Cambio persiste en BD (verificar con DB query)

#### Cron `/api/cron/send-debt-notifications`
- [ ] POST sin Authorization → 401 `{ error: "Unauthorized" }`
- [ ] POST con Authorization: Bearer <invalid> → 401
- [ ] POST con Authorization: Bearer <CRON_SECRET> → 200
- [ ] Response 200: `{ success: true, processed: N, failed: N, timestamp }`
- [ ] Busca PENDING notifications donde sendDate = today
- [ ] Actualiza status a SENT o FAILED después de enviar
- [ ] Log "[Cron] Iniciando..." y "[Cron] Completado:" con números
- [ ] Timeout 60 segundos (maxDuration)
- [ ] Manejo seguro de Decimal conversions (currentPrincipal)

#### Responsive Design
- [ ] Desktop 1440px: todo visible, tablas, modales
- [ ] Tablet 768px: sidebar colapsable, contacto 1col, deudas grid 1col
- [ ] Mobile 375px:
  - Sidebar overlay
  - Inputs stacked
  - Historial: cards en lugar de tabla
  - Botones 44px+ altura (touch targets)
  - Scroll horizontal si es necesario

#### Accesibilidad (WCAG 2.2 AA)
- [ ] `aria-label` en botones de ícono
- [ ] `aria-describedby` en campos de error
- [ ] `role="alert"` en errores
- [ ] Contraste ≥ 4.5:1 en texto
- [ ] Focus ring visible (focus:ring-2)
- [ ] Tab order lógico
- [ ] Screen reader anunta toggles, selectores

#### Error Handling
- [ ] Sin teléfono → WhatsApp toggle deshabilitado
- [ ] Crear notificación sin email → error 400 + toast
- [ ] Crear notificación sin phone (WhatsApp) → error 400 + toast
- [ ] DB error en update → error 500 + toast genérico
- [ ] Network timeout en test send → timeout error + retry UI
- [ ] Cron sin CRON_SECRET en env → error 500 en endpoint

#### Performance
- [ ] Settings page carga < 2s
- [ ] Historial fetch < 1s
- [ ] Toggle notification responde < 500ms
- [ ] Cron completa < 60s (maxDuration)
- [ ] API POST notification < 1.5s
- [ ] Test send < 3s (incluye email delay)

---

## 📧 SECCIÓN 3: SENDGRID INTEGRATION

### 3.1 Setup SendGrid

```bash
# 1. Crear cuenta en sendgrid.com
# 2. Generar API key (Settings > API Keys)
# 3. Agregar a .env:
SENDGRID_API_KEY="SG.xxxxxxxxxxxx"
SENDGRID_FROM_EMAIL="noreply@finanzas-hogar.mx"
```

### 3.2 Implementar `sendEmailNotification()` en NotificationService

**Archivo:** `src/lib/notifications/notification-service.ts`

```typescript
import sgMail from '@sendgrid/mail';

// En el constructor o al inicializar:
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export class NotificationService {
  async sendEmailNotification(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.recipient.email) {
      return { success: false, error: 'Email recipient not provided' };
    }

    try {
      const msg = {
        to: payload.recipient.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@finanzas-hogar.mx',
        subject: payload.subject || `Recordatorio: ${payload.debtName}`,
        html: this.buildEmailTemplate(payload),
        text: this.buildEmailText(payload),
        replyTo: 'support@finanzas-hogar.mx',
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
      };

      const [response] = await sgMail.send(msg);

      console.log(`[SendGrid] Email enviado a ${payload.recipient.email}, messageId: ${response.messageId}`);

      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'SendGrid error';
      console.error(`[SendGrid] Error al enviar email a ${payload.recipient.email}:`, errorMsg);

      return {
        success: false,
        error: `SendGrid: ${errorMsg}`,
      };
    }
  }

  private buildEmailTemplate(payload: NotificationPayload): string {
    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(payload.debtAmount);

    const dueDate = new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(payload.dueDate);

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px;">
      <h2 style="color: #1e1b4b;">Recordatorio de Deuda</h2>
      <p>Hola ${payload.recipient.name || 'usuario'},</p>
      <p>Te recordamos que tu deuda <strong>"${payload.debtName}"</strong> vence en ${payload.daysBefore} días.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #6b7280;">Saldo Actual</p>
        <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #1e1b4b;">${formattedAmount}</p>
        <p style="margin: 5px 0; color: #6b7280;">Vencimiento: <strong>${dueDate}</strong></p>
      </div>
      <p>Ingresa a <a href="https://finanzas.torrax.cloud/personal/debts">tu dashboard</a> para registrar un pago.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
        Este es un recordatorio automático. No respondas a este email.
      </p>
    </div>
    `;
  }

  private buildEmailText(payload: NotificationPayload): string {
    const dueDate = payload.dueDate.toLocaleDateString('es-MX');
    return `
Recordatorio de Deuda

Hola ${payload.recipient.name || 'usuario'},

Tu deuda "${payload.debtName}" vence en ${payload.daysBefore} días.

Saldo Actual: $${payload.debtAmount}
Vencimiento: ${dueDate}

Ingresa a https://finanzas.torrax.cloud/personal/debts para registrar un pago.

---
Este es un recordatorio automático. No respondas a este email.
    `;
  }
}
```

**`package.json` dependency:**
```json
{
  "dependencies": {
    "@sendgrid/mail": "^8.1.0"
  }
}
```

```bash
npm install @sendgrid/mail
```

---

## 📱 SECCIÓN 4: TWILIO WHATSAPP INTEGRATION

### 4.1 Setup Twilio

```bash
# 1. Crear cuenta en twilio.com
# 2. Generar API keys (Account SID + Auth Token)
# 3. Configurar WhatsApp Sandbox (Numbers > Messaging Services > WhatsApp)
# 4. Agregar a .env:
TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_WHATSAPP_NUMBER="+14155552671"  # Provided by Twilio Sandbox
```

### 4.2 Implementar `sendWhatsAppNotification()` en NotificationService

**Archivo:** `src/lib/notifications/notification-service.ts`

```typescript
import twilio from 'twilio';

// En clase:
private twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export class NotificationService {
  async sendWhatsAppNotification(payload: NotificationPayload): Promise<SendResult> {
    if (!payload.recipient.phone) {
      return { success: false, error: 'Phone recipient not provided' };
    }

    try {
      // Asegurar formato +56XXXXXXXXX para Chile
      const normalizedPhone = this.normalizePhoneNumber(payload.recipient.phone);

      const message = await this.twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${normalizedPhone}`,
        body: this.buildWhatsAppMessage(payload),
      });

      console.log(`[Twilio] WhatsApp enviado a ${normalizedPhone}, messageId: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Twilio error';
      console.error(`[Twilio] Error al enviar WhatsApp a ${payload.recipient.phone}:`, errorMsg);

      return {
        success: false,
        error: `Twilio: ${errorMsg}`,
      };
    }
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove spaces, dashes, etc.
    const cleaned = phone.replace(/\D/g, '');
    
    // If starts with 9 (Chile mobile without +56), prepend +56
    if (cleaned.startsWith('9') && cleaned.length === 9) {
      return `+56${cleaned}`;
    }
    
    // If already has country code, ensure +
    if (cleaned.startsWith('56')) {
      return `+${cleaned}`;
    }
    
    // Assume it's already correct format
    return phone.startsWith('+') ? phone : `+${phone}`;
  }

  private buildWhatsAppMessage(payload: NotificationPayload): string {
    const formattedAmount = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(payload.debtAmount);

    return `
Hola ${payload.recipient.name || 'usuario'}! 👋

Recordatorio: Tu deuda "*${payload.debtName}*" vence en ${payload.daysBefore} días.

💰 Saldo actual: ${formattedAmount}
📅 Vencimiento: ${new Date(payload.dueDate).toLocaleDateString('es-MX')}

Ingresa a finanzas.torrax.cloud/personal/debts para registrar un pago.

Mensajes automáticos de Finanzas del Hogar.
    `.trim();
  }
}
```

**`package.json` dependency:**
```json
{
  "dependencies": {
    "twilio": "^4.10.0"
  }
}
```

```bash
npm install twilio
```

---

## 🧪 SECCIÓN 5: UNIT TESTS PARA NOTIFICACIONES

**Archivo:** `tests/unit/notifications.test.ts` (crear)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '@/lib/notifications/notification-service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    // Mock SendGrid y Twilio
    vi.mock('@sendgrid/mail');
    vi.mock('twilio');
  });

  describe('sendEmailNotification', () => {
    it('should send email successfully', async () => {
      const payload = {
        type: 'EMAIL' as const,
        userId: 'user-1',
        debtId: 'debt-1',
        debtName: 'Tarjeta Santander',
        debtAmount: 5000,
        dueDate: new Date('2026-08-10'),
        daysBefore: 3,
        recipient: {
          email: 'user@example.com',
          name: 'Test User',
        },
      };

      const result = await service.sendEmailNotification(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error if email missing', async () => {
      const payload = {
        type: 'EMAIL' as const,
        userId: 'user-1',
        debtId: 'debt-1',
        debtName: 'Tarjeta',
        debtAmount: 5000,
        dueDate: new Date(),
        daysBefore: 3,
        recipient: { name: 'Test' }, // No email
      };

      const result = await service.sendEmailNotification(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email recipient');
    });
  });

  describe('sendWhatsAppNotification', () => {
    it('should send WhatsApp successfully', async () => {
      const payload = {
        type: 'WHATSAPP' as const,
        userId: 'user-1',
        debtId: 'debt-1',
        debtName: 'Tarjeta Santander',
        debtAmount: 5000,
        dueDate: new Date('2026-08-10'),
        daysBefore: 1,
        recipient: {
          phone: '+56912345678',
          name: 'Test User',
        },
      };

      const result = await service.sendWhatsAppNotification(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should normalize phone numbers correctly', async () => {
      const testCases = [
        { input: '912345678', expected: '+56912345678' },
        { input: '+56912345678', expected: '+56912345678' },
        { input: '56912345678', expected: '+56912345678' },
        { input: '+1234567890', expected: '+1234567890' },
      ];

      for (const { input, expected } of testCases) {
        const normalized = service['normalizePhoneNumber'](input);
        expect(normalized).toBe(expected);
      }
    });
  });

  describe('cancelNotification', () => {
    it('should update notification status to CANCELLED', async () => {
      const notificationId = 'notif-1';
      await service.cancelNotification(notificationId);
      // Verify Prisma update was called
      expect(true).toBe(true); // Placeholder
    });
  });
});
```

---

## ✅ DEFINICIÓN DE HECHO

### Fase E2E + QA
- [ ] 8+ E2E tests ejecutados sin fallos
- [ ] Tests cubren: create debt → pay → liquidate → notifications
- [ ] QA manual: 40+ checkpoints completados (ticked)
- [ ] Mobile (375px) verificado en todos los tests
- [ ] Responsive grid testado en 3+ breakpoints
- [ ] Error handling probado (missing fields, invalid input, network)

### Fase SendGrid
- [ ] `sendEmailNotification()` implementada y funcional
- [ ] Email template con datos deuda y fecha
- [ ] Validación: email requerido
- [ ] Logging: `[SendGrid]` en console
- [ ] SENDGRID_API_KEY en .env
- [ ] Unit test para email sending (mock)

### Fase Twilio
- [ ] `sendWhatsAppNotification()` implementada y funcional
- [ ] Phone number normalization (Chile +56)
- [ ] Validación: phone requerido
- [ ] Logging: `[Twilio]` en console
- [ ] TWILIO_* variables en .env
- [ ] Unit test para WhatsApp sending (mock)

### Build & Docs
- [ ] `npm run build` sin errores TypeScript
- [ ] E2E tests en CI/CD (GitHub Actions)
- [ ] Unit tests: `npm run test:unit` pasa
- [ ] finanzas.md actualizado con Sesión 4
- [ ] Commits semánticos (feat/test/docs)

---

## 📝 ORDEN RECOMENDADO

1. ✅ Completar E2E tests (debts.spec.ts)
2. ✅ Ejecutar QA manual (checklist)
3. ✅ Implementar SendGrid email
4. ✅ Implementar Twilio WhatsApp
5. ✅ Agregar unit tests (notifications.test.ts)
6. ✅ Verificar CI/CD (GitHub Actions)
7. ✅ Performance testing
8. ✅ Deploy y monitoreo
9. ✅ Update finanzas.md

---

## 📊 MATRIZ DE RIESGOS & MITIGACIÓN

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| SendGrid falla → email nunca enviado | Alta | Logging detallado + retry logic + fallback a pending |
| Twilio rate limit → SMS/WhatsApp bloqueado | Media | Batch processing + queue + exponential backoff |
| Phone number parsing bug → números inválidos | Media | Test cases + regex validation + Chile-specific logic |
| Cron timeout > 60s → función abortada | Alta | maxDuration=300, monitor logs, split en batches si necesario |
| DB inconsistency (Decimal vs number) | Media | Always parseFloat() + Zod validation |

---

## 🔗 REFERENCIAS

- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs)
- [Twilio Node.js SDK](https://github.com/twilio/twilio-node)
- [Playwright Docs](https://playwright.dev)
- [Vitest Guide](https://vitest.dev)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [NextAuth.js Session Testing](https://next-auth.js.org/getting-started/example)

---

**Duración estimada:** 2-3 sesiones  
**Próximo:** INCREMENTO 5 (futuro) o polish/performance de todo el sistema  
**Fecha de creación:** 2026-08-05  
**Para:** Sesión 4 (E2E + QA + Integraciones reales)
