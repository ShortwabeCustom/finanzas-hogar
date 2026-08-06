# INCREMENTO 5: COMPLETAR UI/UX BACKLOG + BACKEND SUPPORT
**Fecha:** 2026-08-06  
**Basado en:** UI/UX Pro Max Skill Review (12% completado, 38 items pendientes)  
**Habilidades Requeridas:** senior-backend (endpoints) + frontend-design (UI)  
**Duración estimada:** 2-3 sesiones (1 backend APIs, 1-2 frontend)

---

## 🎯 OBJETIVO GENERAL

Completar los **bloqueadores críticos** identificados en el backlog ui-ux-pro-max:
- ✅ **UX-01:** Crear UI de importación de statements (wizard multistep)
- ✅ **UX-02:** Agregar paginación en Pagos y Statements (limit/offset + cursors)
- ✅ **AN-01/02:** Instalar GA4 e implementar trackEvent básico
- ✅ **QW-04:** Agregar metadata dinámico por ruta
- ✅ **UI-01:** Reemplazar spinners con skeleton screens

**Fases:**
1. **SESIÓN 5A (Backend):** APIs de paginación + importación + analytics setup
2. **SESIÓN 5B (Frontend):** Import wizard UI + Skeleton screens + Metadata
3. **SESIÓN 5C (Validación):** E2E tests + QA manual + deploy

---

## 📋 SESIÓN 5A: BACKEND — APIS + INFRAESTRUCTURA

### SECCIÓN 1: Paginación Endpoints

**Objetivo:** Agregar cursor-based pagination a Pagos y Statements para evitar carga masiva.

#### 1.1 GET `/api/payments` — Paginación

**Cambios requeridos:**

```typescript
// Cambio: Query params
// Anterior: GET /api/payments → retorna TODOS
// Nuevo:   GET /api/payments?limit=20&cursor=abc123&sortBy=date&order=desc

// Response:
{
  "data": [ /* 20 pagos */ ],
  "pagination": {
    "limit": 20,
    "nextCursor": "next_abc456" | null,
    "hasMore": boolean,
    "totalCount": integer (estimado para performance)
  }
}
```

**Implementar en:** `src/app/api/payments/route.ts`

**DB Query pattern:**
```prisma
# Usar cursor-based pagination (más eficiente que offset)
const payments = await prisma.payment.findMany({
  where: {
    accountId: { in: userAccountIds },
    createdAt: { lt: cursorDate } // Cursor es timestamp
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1, // +1 para detectar hasMore
  cursor: cursor ? { id: cursor } : undefined,
  select: { id, name, amount, createdAt, status, ... }
})
```

#### 1.2 GET `/api/personal/payments` — Paginación

**Mismo patrón que 1.1 pero para usuario personal.**

#### 1.3 GET `/api/statements` — Paginación

**Mismo patrón aplicado a states.**

#### 1.4 GET `/api/personal/statements` — Paginación

**Mismo patrón para personal statements.**

---

### SECCIÓN 2: Importación de Statements API

**Objetivo:** Crear endpoint que procese uploads de PDFs bancarios → parsea → guarda transactions.

#### 2.1 POST `/api/statements/import` — Upload + Parse

**New endpoint estructura:**

```typescript
// POST /api/statements/import
// Body: multipart/form-data
// - file: File (PDF)
// - bankType?: 'SANTANDER' | 'BBVA' | 'AUTO_DETECT'
// - targetAccountId: string
// - mergeIfExists?: boolean

// Response (streaming o polling):
{
  "importId": "imp_abc123",
  "status": "PROCESSING" | "COMPLETED" | "FAILED",
  "progress": {
    "step": 1, // 1=upload, 2=parse, 3=preview, 4=save
    "stepName": "Procesando PDF...",
    "total": 4,
    "percentage": 25
  },
  "preview": {
    "bankName": "Santander",
    "period": "2026-08",
    "transactionCount": 42,
    "statementDate": "2026-08-05",
    "transactions": [ /* primeros 5 como preview */ ]
  },
  "error": null | { code: string, message: string }
}
```

**Implementar en:** `src/app/api/statements/import/route.ts`

**Lógica:**
1. Validar archivo (< 5MB, PDF)
2. Usar parseWithAI() o parseSantanderPDF() según bankType
3. Validar transacciones parseadas
4. Retornar preview
5. Caller confirma → POST `/api/statements/import/confirm` con importId

#### 2.2 POST `/api/statements/import/confirm` — Confirmar + Guardar

```typescript
// POST /api/statements/import/confirm
// Body:
{
  "importId": "imp_abc123",
  "mergeIfExists": true
}

// Response:
{
  "success": true,
  "statementId": "stmt_xyz789",
  "transactionsCreated": 42,
  "accountId": "acc_123",
  "message": "42 transacciones importadas exitosamente"
}
```

#### 2.3 GET `/api/statements/import/status` — Polling (opcional)

```typescript
// GET /api/statements/import/status?importId=imp_abc123
// Para SPA que haga polling durante procesamiento
```

---

### SECCIÓN 3: Analytics Infrastructure

#### 3.1 `src/lib/analytics.ts` — trackEvent implementation

**Crear función global de tracking:**

```typescript
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // 1. Enviar a GA4 si gtag está disponible
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, properties);
  }
  
  // 2. Log local en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', eventName, properties);
  }
  
  // 3. Opcional: enviar a servidor para logging
  // fetch('/api/analytics/log', { method: 'POST', body: JSON.stringify(...) })
}

// Eventos predefinidos:
export const events = {
  LOGIN: 'user_login',
  DASHBOARD_VIEW: 'dashboard_viewed',
  PAYMENT_CREATE: 'payment_created',
  PAYMENT_MARK_PAID: 'payment_marked_paid',
  STATEMENT_IMPORT: 'statement_imported',
  DEBT_CREATE: 'debt_created',
  RECOVERY_PLAN_VIEW: 'recovery_plan_viewed',
  FILTER_APPLIED: 'filter_applied',
  EXPORT_DATA: 'data_exported',
}
```

#### 3.2 GA4 Setup en `src/app/layout.tsx`

```typescript
// En root layout, agregar script:
<head>
  <script
    async
    src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
  />
  <script dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
        page_path: window.location.pathname,
      });
    `,
  }} />
</head>
```

#### 3.3 POST `/api/analytics/log` — Backend logging (opcional)

```typescript
// Para eventos críticos que deben registrarse servidor-side
// POST /api/analytics/log
// Body:
{
  "eventName": "payment_created",
  "userId": "user_123",
  "properties": { "amount": 1000, "paymentId": "pay_xyz" },
  "timestamp": "2026-08-06T12:34:56Z"
}
```

---

### SECCIÓN 4: Database Changes (si aplica)

**Verificar:**
- ¿Existe índice en `payments(createdAt, accountId)` para cursor pagination?
- ¿Existe índice en `statements(createdAt, userId)` para cursor pagination?

**Agregaciones requeridas:**

```prisma
// En schema.prisma, agregar índices si no existen:

model Payment {
  // ...
  @@index([accountId, createdAt])
  @@index([createdAt])
}

model Statement {
  // ...
  @@index([userId, createdAt])
  @@index([createdAt])
}
```

---

## 📋 SESIÓN 5B: FRONTEND — UI + COMPONENTS

### SECCIÓN 5: Import Wizard UI

**Objetivo:** Crear `/personal/statements/import` page con wizard multistep.

#### 5.1 Componente Wizard (4 pasos)

```
Paso 1: Seleccionar banco
  ├─ Radio: Auto-detect | Santander | BBVA | etc
  └─ Botón: Siguiente

Paso 2: Upload PDF
  ├─ Drag & drop zone
  ├─ Progress bar durante procesamiento
  └─ Botones: Cancelar | Siguiente (deshabilitado hasta parsear)

Paso 3: Preview
  ├─ Tabla de transacciones parseadas
  ├─ Selector: "Vincular a cuenta..." (dropdown)
  ├─ Checkbox: "Combinar si el período existe"
  └─ Botones: Atrás | Cancelar | Confirmar importación

Paso 4: Resultado
  ├─ Ícono success/error
  ├─ Mensaje: "42 transacciones importadas" o error detail
  ├─ Link: "Ver transacciones"
  └─ Botón: Cerrar
```

**Ubicación:** `src/app/(app)/personal/statements/import/page.tsx`

**Sub-components:**
- `<StepIndicator step={1} totalSteps={4} />`
- `<BankSelector onSelect={setBankType} />`
- `<PdfUploadZone onFileSelect={handleUpload} />`
- `<TransactionPreviewTable transactions={preview} />`
- `<ImportResultCard success={true} count={42} />`

#### 5.2 Agregar link en Sidebar

```tsx
// En src/components/layout/Sidebar.tsx, agregar a personalItems:
{
  href: "/personal/statements/import",
  label: "Importar Estado de Cuenta",
  icon: ( /* upload icon */ )
}
```

---

### SECCIÓN 6: Skeleton Screens

**Objetivo:** Reemplazar spinners con placeholders de forma de la UI.

#### 6.1 Crear componente `<SkeletonCard>`

```tsx
// src/components/ui/SkeletonCard.tsx
export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/3 mt-4" />
    </div>
  );
}
```

#### 6.2 Reemplazar en componentes principales

- Dashboard StatCard loading → `<SkeletonCard>`
- Payments table skeleton → tabla con 5 filas grises
- Statements skeleton → similar

**Ubicaciones:**
- `src/app/(app)/dashboard/page.tsx` (L127-134)
- `src/app/(app)/payments/page.tsx`
- `src/app/(app)/statements/page.tsx`

---

### SECCIÓN 7: Metadata Dinámico

**Objetivo:** Agregar `export const metadata` a cada page para títulos únicos en tabs.

```typescript
// src/app/(app)/payments/page.tsx
export const metadata: Metadata = {
  title: "Mis Pagos | Finanzas del Hogar",
  description: "Gestiona todos tus pagos",
};

export default function PaymentsPage() {
  // ...
}
```

**Páginas a actualizar:**
- `/dashboard` → "Dashboard | Finanzas del Hogar"
- `/payments` → "Pagos | Finanzas del Hogar"
- `/personal/payments` → "Mis Pagos | Finanzas del Hogar"
- `/personal/statements` → "Estados de Cuenta | Finanzas del Hogar"
- `/personal/debts` → "Deudas y Préstamos | Finanzas del Hogar"
- `/categories` → "Categorías | Finanzas del Hogar"

---

## 📋 SESIÓN 5C: VALIDACIÓN + TESTS

### SECCIÓN 8: E2E Tests (Playwright)

**Tests a agregar:**

#### 8.1 Import Workflow
```typescript
test('Importar estado de cuenta con PDF', async ({ page }) => {
  // 1. Login
  // 2. Navegar a /personal/statements/import
  // 3. Seleccionar banco "Santander"
  // 4. Drag & drop PDF (usar fixture)
  // 5. Esperar preview
  // 6. Seleccionar cuenta destino
  // 7. Click "Confirmar"
  // 8. Verificar resultado: "42 transacciones importadas"
  // 9. Verificar que transacciones aparecen en /personal/statements
});
```

#### 8.2 Pagination
```typescript
test('Paginar en tabla de pagos', async ({ page }) => {
  // 1. Navegar a /payments
  // 2. Verificar que carga máximo 20 pagos
  // 3. Click "Cargar más" o scroll → next page
  // 4. Verificar transición sin reload
});
```

#### 8.3 Analytics
```typescript
test('Trackear evento de pago creado', async ({ page }) => {
  // 1. Monitorear window.gtag calls
  // 2. Crear un pago
  // 3. Verificar que gtag fue llamado con 'payment_created'
});
```

---

### SECCIÓN 9: QA Manual Checklist

**Antes de deploy:**

- [ ] Import wizard: todos los pasos funcionan sin errores
- [ ] Paginación: carga máximo 20 items, cursor funciona
- [ ] Skeleton screens: visible durante carga, no layout shift
- [ ] Metadata: títulos únicos en cada tab del navegador
- [ ] Analytics: GA4 cargado, eventos se registran
- [ ] Mobile: Import wizard responsive en 375px
- [ ] Error handling: mensajes claros si PDF falla
- [ ] Performance: import de PDF grande (3MB) completa en < 5s
- [ ] Accesibilidad: aria-labels en wizard, focus visible en botones

---

## 🚀 COMMITS ESPERADOS

```
1. backend(pagination): add cursor-based pagination to payments & statements
2. backend(import): add statements import wizard API endpoints with preview
3. backend(analytics): setup GA4 infrastructure and trackEvent
4. frontend(import): create statements import wizard UI (4-step)
5. frontend(ui): replace spinners with skeleton screens
6. frontend(metadata): add dynamic page titles
7. test(e2e): add import, pagination, analytics e2e tests
8. docs: update finanzas.md for INCREMENTO 5 completion
```

---

## 📊 Métricas de Éxito

| Métrica | Target | Success |
|---------|--------|---------|
| Backlog items completados | 12/48 → 30/48 | 62% |
| Quick Wins | 3/8 → 7/8 | 87% |
| Import UI | ❌ → ✅ | 100% |
| Paginación | ❌ → ✅ | 100% |
| Analytics | ❌ → ✅ | 100% |
| E2E tests | +8 tests | 100% |
| Build clean | ✅ | ✅ |

---

## 📌 Dependencias

- ✅ Prisma (migraciones)
- ✅ Next.js API routes
- ✅ TypeScript
- ✅ Playwright (tests)
- 📦 GA4 (Google Analytics setup)
- 📦 pdf-parse (ya instalado para parsing)

---

## ⚠️ Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Import PDF parser falla | Fallback a gpt-4o-mini + error message clara |
| Cursor pagination confunde usuarios | Documentar en UI, mostrar "Cargar más" |
| GA4 no carga (blocker de ads) | Graceful fallback, eventos locales logged |
| Wizard complejo en mobile | Usar accordion/tabs en lugar de pasos lineales |

---

## 🎓 Notas para la sesión

- **senior-backend:** Enfocarse en APIs de paginación e import primero. Testing: validar que `nextCursor` siempre es válido y no hay duplicados.
- **frontend-design:** Wizard debe ser accesible (WCAG AA). Skeleton screens deben tener animación sutil (`animate-pulse`).
- **Testing:** Importar PDF real (fixtures en `tests/fixtures/sample-santander.pdf`) para e2e realista.
- **Performance:** Paginación → usar índices. Import parse → puede ser lento, meter en background job si > 1MB.

---

**Estado inicial:** Plataforma funcional pero con 3 bloqueadores críticos.  
**Estado esperado post-INCREMENTO 5:** 62% del backlog completado, flujo de importación operativo, analytics baseline.

