# INCREMENTO 4 SESIÓN 3: NOTIFICACIONES UI, VERCEL CRON, E2E TESTS Y QA — PROMPT MASTER

**Fase:** Notificaciones UI + Scheduled tasks + E2E testing + QA completo  
**Duración esperada:** 1-2 sesiones (1 UI+Cron, 1 E2E+QA)  
**Commits esperados:**
1. `feat(notifications): add settings page with notification management UI`
2. `feat(cron): add vercel cron endpoint for scheduled notification sending`
3. `test(e2e): add debt workflow and notification tests`
4. `docs: update finanzas.md for INCREMENTO 4 Sesión 3`

**Estado previo:** INCREMENTO 4 Sesión 2 ✅ (Tests 70/70 passing, NotificationService scaffold, API endpoint)

---

## 🎯 OBJETIVO

Completar el módulo de notificaciones con UI de configuración, scheduler automático en Vercel, suite E2E de tests, y validación completa de los flujos de deudas + notificaciones:

1. **Notificaciones UI** — Settings page con toggles por deuda, historial, botón "Enviar ahora"
2. **Vercel Cron** — Endpoint `/api/cron/send-debt-notifications` con auth y rate limiting
3. **E2E Tests** — Suite Playwright para flujos de crear deuda → vincular pago → recibir notificación
4. **QA Completo** — Validación manual + automated + performance checks

**No implementar aún:**
- Integraciones reales SendGrid/Twilio (scaffolds listos, se disparan en Sesión 4)
- Push notifications (futuro)
- SMS (Twilio — futuro)
- Email templating avanzado (futuro)

---

## 📋 SECCIÓN 1: NOTIFICACIONES UI

### 1.1 Settings Page: `/app/(app)/personal/settings/notifications`

**Ubicación:** `src/app/(app)/personal/settings/notifications.tsx` (nueva página)

**Estructura:**

```typescript
"use client";

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { debtApi } from '@/lib/api';
import { DebtAccount } from '@prisma/client';

type NotificationConfig = {
  debtId: string;
  emailNotification: boolean;
  emailDaysBefore: number;
  whatsappNotification: boolean;
  whatsappDaysBefore: number;
};

export default function NotificationsSettings() {
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string>('');
  const [editingPhone, setEditingPhone] = useState(false);

  // Fetch deudas + notificaciones existentes
  const { data: debts, isLoading } = useQuery({
    queryKey: ['debts-for-notifications'],
    queryFn: () => debtApi.getDebts({ direction: 'PAYABLE' }),
  });

  // Crear/actualizar notificación
  const createNotifMutation = useMutation({
    mutationFn: (config: NotificationConfig) => 
      debtApi.createNotification(config.debtId, {
        type: config.emailNotification ? 'EMAIL' : 'WHATSAPP',
        daysBefore: config.emailNotification ? config.emailDaysBefore : config.whatsappDaysBefore,
        recipientEmail: userEmail,
        recipientPhone: userPhone,
      }),
    onSuccess: () => {
      toast.success('Notificación configurada');
      queryClient.invalidateQueries({ queryKey: ['debts-for-notifications'] });
    },
    onError: (error) => toast.error('Error al configurar notificación'),
  });

  // Cancelar notificación
  const cancelNotifMutation = useMutation({
    mutationFn: (notificationId: string) => 
      debtApi.cancelNotification(notificationId),
    onSuccess: () => {
      toast.success('Notificación cancelada');
      queryClient.invalidateQueries({ queryKey: ['debts-for-notifications'] });
    },
  });

  // Enviar notificación de prueba (test now)
  const testNotifMutation = useMutation({
    mutationFn: (debtId: string) =>
      fetch(`/api/personal/debts/${debtId}/notifications/test`, { method: 'POST' }),
    onSuccess: () => toast.success('Notificación de prueba enviada'),
    onError: () => toast.error('Error al enviar notificación de prueba'),
  });

  if (isLoading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración de Notificaciones</h1>

      {/* Configuración de contacto */}
      <section className="mb-8 p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Datos de Contacto</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={userEmail}
            readOnly
            className="w-full px-3 py-2 border rounded bg-gray-50"
            placeholder="Tu email de cuenta"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Teléfono WhatsApp</label>
          {!editingPhone ? (
            <div className="flex gap-2">
              <input
                type="tel"
                value={userPhone || ''}
                readOnly
                className="flex-1 px-3 py-2 border rounded bg-gray-50"
                placeholder="+56912345678 (opcional)"
              />
              <button
                onClick={() => setEditingPhone(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Editar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                placeholder="+56912345678"
              />
              <button
                onClick={() => setEditingPhone(false)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Guardar
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">Requerido para notificaciones por WhatsApp</p>
        </div>
      </section>

      {/* Deudas con notificaciones */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Notificaciones por Deuda</h2>

        {debts?.length === 0 ? (
          <p className="text-gray-500">No hay deudas a pagar registradas</p>
        ) : (
          <div className="space-y-4">
            {debts?.map((debt) => (
              <DebtNotificationCard
                key={debt.id}
                debt={debt}
                userEmail={userEmail}
                userPhone={userPhone}
                onToggle={(type, enabled) => {
                  // Lógica de toggle
                }}
                onTestSend={(debtId) => testNotifMutation.mutate(debtId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Historial de notificaciones */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Historial (últimas 20)</h2>
        <NotificationHistory />
      </section>
    </div>
  );
}

// Componente para una deuda
function DebtNotificationCard({
  debt,
  userEmail,
  userPhone,
  onToggle,
  onTestSend,
}: {
  debt: DebtAccount;
  userEmail: string;
  userPhone: string;
  onToggle: (type: 'EMAIL' | 'WHATSAPP', enabled: boolean) => void;
  onTestSend: (debtId: string) => void;
}) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailDays, setEmailDays] = useState(3);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappDays, setWhatsappDays] = useState(1);

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold">{debt.name}</h3>
          <p className="text-sm text-gray-600">
            Saldo: ${debt.currentPrincipal.toFixed(2)} | Vence: {debt.nextDueDate?.toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => onTestSend(debt.id)}
          className="text-sm px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Enviar ahora
        </button>
      </div>

      {/* Email toggle */}
      <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded">
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => {
            setEmailEnabled(e.target.checked);
            onToggle('EMAIL', e.target.checked);
          }}
          className="w-4 h-4"
        />
        <div className="flex-1">
          <label className="font-medium">Email ({emailDays} días antes)</label>
          <p className="text-xs text-gray-600">{userEmail}</p>
        </div>
        <select
          value={emailDays}
          onChange={(e) => setEmailDays(Number(e.target.value))}
          className="px-2 py-1 border rounded text-sm"
          disabled={!emailEnabled}
        >
          {[1, 2, 3, 5, 7].map((d) => (
            <option key={d} value={d}>{d} días</option>
          ))}
        </select>
      </div>

      {/* WhatsApp toggle */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
        <input
          type="checkbox"
          checked={whatsappEnabled}
          onChange={(e) => {
            setWhatsappEnabled(e.target.checked);
            onToggle('WHATSAPP', e.target.checked);
          }}
          disabled={!userPhone}
          className="w-4 h-4"
        />
        <div className="flex-1">
          <label className="font-medium">WhatsApp ({whatsappDays} día antes)</label>
          <p className="text-xs text-gray-600">
            {userPhone ? userPhone : 'Agregar teléfono para habilitar'}
          </p>
        </div>
        <select
          value={whatsappDays}
          onChange={(e) => setWhatsappDays(Number(e.target.value))}
          className="px-2 py-1 border rounded text-sm"
          disabled={!whatsappEnabled || !userPhone}
        >
          {[0, 1, 2, 3].map((d) => (
            <option key={d} value={d}>{d === 0 ? 'Día del vencimiento' : `${d} día antes`}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Componente de historial
function NotificationHistory() {
  const { data: history } = useQuery({
    queryKey: ['notification-history'],
    queryFn: async () => {
      const res = await fetch('/api/personal/notifications/history');
      return res.json();
    },
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Deuda</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2 text-left">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {history?.map((n) => (
            <tr key={n.id} className="border-t">
              <td className="p-2">{n.debt?.name}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  n.type === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {n.type}
                </span>
              </td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  n.status === 'SENT' ? 'bg-green-100 text-green-800' :
                  n.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {n.status}
                </span>
              </td>
              <td className="p-2 text-gray-600">
                {new Date(n.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 1.2 Integración en Layout

**Archivo:** `src/app/(app)/personal/settings/layout.tsx` (modificar si existe)

Agregar ruta "Notificaciones" en sidebar:
```typescript
{
  title: 'Notificaciones',
  href: '/personal/settings/notifications',
  icon: 'bell',
}
```

### 1.3 API Helper

**Archivo:** `src/lib/api/debt-api.ts` (actualizar)

```typescript
export const debtApi = {
  // ... métodos existentes ...

  createNotification: async (debtId: string, data: {
    type: 'EMAIL' | 'WHATSAPP';
    daysBefore: number;
    recipientEmail?: string;
    recipientPhone?: string;
  }) => {
    const res = await fetch(`/api/personal/debts/${debtId}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create notification');
    return res.json();
  },

  cancelNotification: async (notificationId: string) => {
    const res = await fetch(`/api/personal/notifications/${notificationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to cancel notification');
    return res.json();
  },

  getNotificationHistory: async (limit: number = 20) => {
    const res = await fetch(`/api/personal/notifications/history?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch notification history');
    return res.json();
  },
};
```

---

## 🕐 SECCIÓN 2: VERCEL CRON

### 2.1 Endpoint Cron

**Ubicación:** `src/app/api/cron/send-debt-notifications/route.ts` (nueva)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { processPendingNotifications } from '@/lib/notifications/scheduler';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos máximo

export async function POST(req: NextRequest) {
  // Verificar autenticación (Vercel proporciona Authorization header)
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET;

  if (!token || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting notification processing at', new Date().toISOString());
    const result = await processPendingNotifications();
    console.log('[Cron] Completed:', result);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
```

### 2.2 Configuración Vercel

**Archivo:** `vercel.json` (crear si no existe)

```json
{
  "crons": [
    {
      "path": "/api/cron/send-debt-notifications",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Notas:**
- Cron ejecuta cada hora en la hora exacta (00:00, 01:00, etc.)
- `CRON_SECRET` se configura en Vercel Dashboard > Project Settings > Environment Variables
- Token debe ser secreto fuerte (ej: `openssl rand -base64 32`)

### 2.3 Variables de entorno

**`.env.example`** (actualizar)

```env
# Cron notifications
CRON_SECRET="[openssl rand -base64 32]"
```

---

## 🧪 SECCIÓN 3: E2E TESTS

### 3.1 Archivo: `tests/e2e/debts.spec.ts`

Completar / crear tests E2E con Playwright:

```typescript
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:4000';
const TEST_USER_EMAIL = 'alexis@hogar.com';
const TEST_USER_PASSWORD = 'admin123';

test.describe('Debtss Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Create debt and verify in list', async () => {
    await page.goto(`${BASE_URL}/personal/debts`);

    // Click "Nueva Deuda"
    await page.click('button:has-text("Nueva Deuda")');
    await page.fill('input[name="name"]', 'Test Credit Card');
    await page.selectOption('select[name="type"]', 'CREDIT_CARD');
    await page.selectOption('select[name="direction"]', 'PAYABLE');
    await page.fill('input[name="originalPrincipal"]', '5000');
    await page.fill('input[name="currentPrincipal"]', '3500');
    await page.fill('input[name="startDate"]', '2026-08-01');

    await page.click('button:has-text("Crear")');
    await expect(page).toHaveURL(`${BASE_URL}/personal/debts`);
    await expect(page.locator('text=Test Credit Card')).toBeVisible();
  });

  test('Record payment on debt', async () => {
    await page.goto(`${BASE_URL}/personal/debts`);
    
    // Click on first debt
    await page.click('[role="row"] >> nth=1');
    
    // Click "Registrar Pago"
    await page.click('button:has-text("Registrar Pago")');
    
    // Fill payment form
    await page.fill('input[name="principalAmount"]', '500');
    await page.fill('input[name="interestAmount"]', '50');
    await page.fill('input[name="paidAt"]', '2026-08-05');
    await page.selectOption('select[name="paymentMethod"]', 'TRANSFER');
    
    await page.click('button:has-text("Guardar Pago")');
    
    // Verify payment appears in history
    await expect(page.locator('text=$500')).toBeVisible();
  });

  test('Link transaction to debt from statements', async () => {
    await page.goto(`${BASE_URL}/personal/statements`);
    
    // Find a transaction and click link button
    const firstTx = page.locator('[role="row"] >> nth=1');
    await firstTx.hover();
    await firstTx.locator('button[aria-label="Vincular a deuda"]').click();
    
    // Fill link modal
    await page.selectOption('select[name="debtId"]', { index: 0 });
    await page.fill('input[name="principalAmount"]', '250');
    await page.fill('input[name="interestAmount"]', '25');
    
    await page.click('button:has-text("Vincular")');
    
    // Verify success message
    await expect(page.locator('text=Transacción vinculada')).toBeVisible();
  });

  test('Configure notifications', async () => {
    await page.goto(`${BASE_URL}/personal/settings/notifications`);
    
    // Edit phone for WhatsApp
    await page.click('button:has-text("Editar")');
    await page.fill('input[name="phone"]', '+56912345678');
    await page.click('button:has-text("Guardar")');
    
    // Toggle email notification
    const debtCard = page.locator('[class*="DebtNotificationCard"] >> nth=0');
    await debtCard.locator('input[type="checkbox"] >> nth=0').check();
    
    // Select 3 days before
    await debtCard.locator('select >> nth=0').selectOption('3');
    
    // Verify configuration saved
    await expect(page.locator('text=Notificación configurada')).toBeVisible();
  });

  test('View notification history', async () => {
    await page.goto(`${BASE_URL}/personal/settings/notifications`);
    
    // Scroll to history section
    await page.locator('text=Historial').scrollIntoViewIfNeeded();
    
    // Verify history table
    const table = page.locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead')).toContainText('Deuda');
    await expect(table.locator('thead')).toContainText('Estado');
  });

  test('Send test notification', async () => {
    await page.goto(`${BASE_URL}/personal/settings/notifications`);
    
    // Find debt card and click "Enviar ahora"
    await page.click('button:has-text("Enviar ahora")');
    
    // Verify toast confirmation
    await expect(page.locator('text=Notificación de prueba enviada')).toBeVisible();
  });
});

test.describe('Notification Scheduler', () => {
  test('Pending notifications are sent by cron', async ({ request }) => {
    // Call cron endpoint
    const response = await request.post('/api/cron/send-debt-notifications', {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('processed');
    expect(data).toHaveProperty('failed');
  });

  test('Cron endpoint rejects unauthorized requests', async ({ request }) => {
    const response = await request.post('/api/cron/send-debt-notifications', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(response.status()).toBe(401);
  });
});
```

### 3.2 Ejecutar E2E tests

```bash
# Local (con servidor dev ejecutándose)
npm run dev &
npm run test:e2e

# UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

---

## 📊 SECCIÓN 4: QA COMPLETO

### 4.1 Checklist de Testing Manual

#### Login y acceso

- [ ] Login como admin (alexis@hogar.com) accede a settings/notifications
- [ ] Login como editor accede a settings/notifications
- [ ] Login como viewer accede a settings/notifications (read-only)
- [ ] Usuario no autenticado redirigido a login

#### Settings de notificaciones

- [ ] Email prerellenado (read-only)
- [ ] Teléfono editable, se guarda
- [ ] Deudas PAYABLE listadas correctamente
- [ ] Saldo y vencimiento mostrados
- [ ] Toggle email funciona (activa/desactiva)
- [ ] Toggle WhatsApp deshabilitado si sin teléfono
- [ ] Selector de días funciona (1-7 días)
- [ ] Botón "Enviar ahora" dispara test send

#### Crear/editar notificación

- [ ] POST a `/api/personal/debts/[id]/notifications` crea notificación
- [ ] GET devuelve notificaciones existentes
- [ ] Validación: email requerido si type=EMAIL
- [ ] Validación: teléfono requerido si type=WHATSAPP
- [ ] Deduplicación: no crear si existe con mismo tipo y daysBefore
- [ ] DELETE cancela notificación (status = CANCELLED)

#### Historial

- [ ] Historial muestra últimas 20 notificaciones
- [ ] Estados mostrados: PENDING, SENT, FAILED, CANCELLED con colores
- [ ] Fechas en formato correcto
- [ ] Paginación/scroll funciona si >20 notificaciones

#### Cron

- [ ] Vercel cron configurado en vercel.json
- [ ] CRON_SECRET en Vercel env vars
- [ ] GET /api/cron/send-debt-notifications sin auth retorna 401
- [ ] POST con token válido procesa notificaciones
- [ ] Response incluye {success, processed, failed, timestamp}
- [ ] Logs registrados en Vercel function logs

#### Flujos E2E

- [ ] Crear deuda → lista actualizada
- [ ] Registrar pago → saldo reducido
- [ ] Vincular transacción → status actualizado
- [ ] Configurar notificación → guardada correctamente
- [ ] Enviar test notification → toast de éxito
- [ ] Cron dispara scheduler → notificaciones procesadas

#### Performance

- [ ] Settings page carga < 2s
- [ ] Historial tabla < 1s
- [ ] Toggle notification responde < 500ms
- [ ] Cron completa < 60s

#### Mobile

- [ ] Settings responsivo en 375px
- [ ] Toggles accesibles touch
- [ ] Modal de ajustes legible
- [ ] Tabla historial scroll horizontal

#### Error handling

- [ ] Crear notificación sin recipient → error 400 con mensaje
- [ ] Cron sin token → error 401
- [ ] Cron con timeout → error 500 con detalles
- [ ] Teléfono inválido → validación cliente
- [ ] Email inválido → rechazado

### 4.2 Performance Baselines

| Métrica | Target | Aceptable |
|---------|--------|-----------|
| Settings page load | < 2s | < 3s |
| Historial fetch | < 1s | < 2s |
| Notificación toggle | < 500ms | < 1s |
| Cron execution | < 30s | < 60s |
| API POST notification | < 500ms | < 1.5s |

---

## 📝 SECCIÓN 5: ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos

```
src/app/(app)/personal/settings/notifications.tsx
src/app/api/cron/send-debt-notifications/route.ts
src/app/api/personal/notifications/history/route.ts
src/app/api/personal/notifications/[id]/route.ts
tests/e2e/debts.spec.ts (completar)
vercel.json
.env.example (actualizar)
```

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/app/(app)/personal/settings/layout.tsx` | Agregar ruta "Notificaciones" en sidebar |
| `src/lib/api/debt-api.ts` | Agregar métodos createNotification, cancelNotification, getNotificationHistory |
| `package.json` | Verificar @playwright/test presente |
| `finanzas.md` | Actualizar estado INCREMENTO 4 Sesión 3 |

---

## 🚀 ORDEN RECOMENDADO

1. ✅ Crear Settings page (notifications.tsx)
2. ✅ Conectar API helpers
3. ✅ Crear Cron endpoint + vercel.json
4. ✅ Completar E2E tests (debts.spec.ts)
5. ✅ QA manual (checklist)
6. ✅ Performance testing
7. ✅ Deploy y monitoreo

---

## ✅ DEFINICIÓN DE HECHO (DoD)

- [ ] Settings UI implementada y funcionando
- [ ] Todos los toggles guardan notificaciones
- [ ] Historial carga y muestra datos correctamente
- [ ] Vercel Cron configurado en vercel.json
- [ ] Cron endpoint autentica con CRON_SECRET
- [ ] E2E tests ejecutan sin errores (Playwright)
- [ ] QA manual completa (30+ checkpoints)
- [ ] Performance baselines cumplidas
- [ ] Mobile responsive verificado
- [ ] Build exitoso, TypeScript clean
- [ ] Commits según formato convencional
- [ ] finanzas.md actualizado

---

## 📦 COMMITS ESPERADOS

```bash
git commit -m "feat(notifications): add settings page with notification management UI"
git commit -m "feat(cron): add vercel cron endpoint for scheduled notification sending"
git commit -m "test(e2e): add debt workflow and notification tests"
git commit -m "docs: update finanzas.md for INCREMENTO 4 Sesión 3"
```

---

## 📚 Referencias

- [Playwright Docs](https://playwright.dev)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Prisma Client Docs](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

---

**Duración estimada:** 1-2 sesiones  
**Próximo:** INCREMENTO 4 Sesión 4 (SendGrid/Twilio integration + notificaciones reales)
