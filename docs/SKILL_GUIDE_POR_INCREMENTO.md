# 📚 GUÍA DE SKILLS POR INCREMENTO
**Finanzas del Hogar**

---

## 🎯 Matriz de Selección de Skills

| INCREMENTO | Objetivo | Skill Recomendado | Alternativa | Notas |
|-----------|----------|-------------------|------------|-------|
| **INCREMENTO 1** | Database schema + Auth + API base | `/senior-backend` | `/fullstack-developer` | Arquitectura backend, migrations, auth, API design |
| **INCREMENTO 2** | Deudas module — frontend + API | `/fullstack-developer` | `/senior-fullstack` | UI deudas + backend endpoints, formularios, validación |
| **INCREMENTO 3** | Deudas integration + notificaciones | `/senior-backend` | `/senior-fullstack` | Lógica de cálculos, base de notificaciones, scheduler |
| **INCREMENTO 4** | Sesión 1: Statements UI modal | `/frontend-developer` | `/ui-ux-designer` | UI components, modal, transactionId linking |
| **INCREMENTO 4** | Sesión 2: Tests + Notificaciones | `/senior-fullstack` | `/qa-test-planner` | Vitest setup, E2E scaffolding, notification service |
| **INCREMENTO 4** | Sesión 3: DB migration + Cron | `/senior-backend` | `/senior-fullstack` | Safe DB operations, Vercel Cron, API endpoints |
| **INCREMENTO 5** | Sesión A: Backend APIs | `/senior-backend` | `/fullstack-developer` | Paginación, import logic, analytics infrastructure |
| **INCREMENTO 5** | Sesión B: Frontend UI | `/frontend-developer` | `/ui-ux-designer` | Import Wizard 4 pasos, skeleton screens, metadata |
| **INCREMENTO 5** | Sesión C: E2E + QA + Build ← **TÚ ESTÁS AQUÍ** | `/qa-test-planner` + manual | `/senior-fullstack` | E2E tests setup, QA checklist, build validation |
| **INCREMENTO 6** | Deploy + Producción + Monitoreo | **`/senior-fullstack`** ← **SIGUIENTE** | `/senior-backend` | E2E execution, DB setup, production validation, rollback |
| **INCREMENTO 7+** | Features nuevas (según tipo) | Depende feature | — | Seguir matriz según tipo (frontend/backend/full) |

---

## 🛠️ DESCRIPCIÓN DETALLADA POR SKILL

### `/senior-backend`
**Cuándo usar:** Backend APIs, database, architecture, migrations, business logic
- Paginación con cursores
- Import logic (parsers, dedup, bulk-insert)
- Analytics infrastructure
- Safe DB migrations
- Cron jobs, notifications
- API endpoints

**Ejemplo:** INCREMENTO 5A — "Implementar paginación cursor-based en /api/payments"

---

### `/frontend-developer`
**Cuándo usar:** UI components, forms, styling, interactive features, responsive design
- Import Wizard 4-step UI
- Skeleton screens, loading states
- Form validation with React Hook Form + Zod
- Responsive design (mobile, tablet, desktop)
- Accessibility WCAG AA

**Ejemplo:** INCREMENTO 5B — "Crear Import Wizard con drag & drop PDF"

---

### `/fullstack-developer`
**Cuándo usar:** Feature completa que toca frontend + backend + DB
- Deudas module (UI + API + schema)
- Credit card calendar (business logic + UI)
- Link transactions to debts

**Ejemplo:** INCREMENTO 2 — "Implementar módulo de Deudas de punta a punta"

---

### `/senior-fullstack`
**Cuándo usar:** Proyecto completo con arquitectura, design patterns, testing, deployment
- End-to-end testing (Playwright setup)
- Production deployment strategy
- Full-stack validation
- Monitoring, rollback, CI/CD
- Performance optimization

**Ejemplo:** INCREMENTO 6 — "Ejecutar E2E tests, deployar a producción, validar todo"

---

### `/qa-test-planner`
**Cuándo usar:** QA, testing, validation, checklists
- E2E test case design
- Manual QA checklists
- Accessibility audits (WCAG)
- Test plan creation
- Bug report templates
- Figma design validation

**Ejemplo:** INCREMENTO 5C — "Crear QA checklist de 62 items para Import Wizard"

---

### `/ui-ux-designer`
**Cuándo usar:** UI polish, visual design, UX improvements, design system
- Color palettes
- Typography guidelines
- Component design
- Responsive layouts
- Accessibility UX (focus states, keyboard nav)

**Ejemplo:** "Mejorar visual design del dashboard, crear design system"

---

### `/run`
**Cuándo usar:** Verificar que la app funciona (testing manual, screenshot, demo)
- Iniciar dev server
- Probar flujos en navegador real
- Capturar screenshots/videos
- Testing manual e2e

**Ejemplo:** "Arranca la app y verifica que Import Wizard funciona"

---

## 🔄 PATRÓN DE WORKFLOW

### Típico para feature nueva (ej: INCREMENTO 5):

```
1. PLAN (Senior Fullstack):
   - Revisar arquitectura
   - Diseñar API endpoints + DB schema
   - Planificar componentes UI
   - Definir testing strategy
   
2. SESSION A - BACKEND (Senior Backend):
   - Implement APIs
   - Add migrations
   - Add tests unitarios
   
3. SESSION B - FRONTEND (Frontend Developer):
   - Implement UI components
   - Add forms + validation
   - Add responsive design
   - E2E test scaffolding
   
4. SESSION C - QA + DEPLOY (Senior Fullstack o QA Planner):
   - Create E2E tests
   - Run QA manual checklist
   - Build validation
   - Deploy to production
   
5. MONITORING (Senior Backend + Ops):
   - Monitor errors/performance
   - Collect metrics
   - Prepare next iteration
```

---

## 💡 DECISIÓN RÁPIDA

**Si la tarea es:**

- ❓ "Implement new API endpoint" → `/senior-backend`
- ❓ "Design login form" → `/frontend-developer`
- ❓ "Create user dashboard" → `/fullstack-developer` (tiene UI + API)
- ❓ "Deploy to production" → `/senior-fullstack`
- ❓ "Write E2E tests" → `/qa-test-planner`
- ❓ "Improve design system" → `/ui-ux-designer`
- ❓ "Test the app manually" → `/run`
- ❓ "Whole new module" → `/senior-fullstack` (plan first)

---

## 🎯 PARA PRÓXIMA SESIÓN (INCREMENTO 6)

### Skill recomendado: **`/senior-fullstack`**

```bash
# En tu terminal, ejecutar:
/senior-fullstack

# Luego pega este prompt:

Ejecutar INCREMENTO 6 completo: Deploy a producción + E2E Tests + Validación

Contexto: INCREMENTO 5 está completo (E2E tests creados, QA 62/62 pass, build clean).
Ahora necesito:

1. Setup DB test + ejecutar 18 E2E tests (3 suites: import, pagination, analytics)
   - DB: createdb finanzas_test + migrations + seed
   - Tests: npm run test:e2e + generar reporte
   - Documentar resultados

2. Deploy a producción (Vercel o VPS)
   - Pre-deploy checklist
   - Deploy steps
   - Post-deploy smoke tests

3. Production validation (72 horas monitoreo)
   - Critical flows: Import + Pagination + Analytics
   - Lighthouse audit
   - GA4 event validation
   - Error tracking

4. Cierre del incremento
   - Release notes
   - Git tag v5.0-prod
   - Update finanzas.md

Referencias:
- INCREMENTO_6_MASTER_PROMPT.md (full spec)
- finanzas.md (architecture)
- QA_CHECKLIST_INCREMENTO_5.md (known tests)
```

---

## 📞 CONTACTO & HELP

**¿No sabes qué skill usar?**
1. Mira la matriz de arriba (tabla principal)
2. Si no está claro, usa `/senior-fullstack` (es la más versátil)
3. Si es muy específico (diseño), usa `/ui-ux-designer`
4. Si es solo testing/QA, usa `/qa-test-planner`

**Cada sesión, el prompt master indicará qué skill usar:**
- ✅ INCREMENTO_6_MASTER_PROMPT.md indica `→ /senior-fullstack`
- ✅ Próximos incrementos tendrán su propio prompt master

---

**Last updated:** 2026-08-06 (INCREMENTO 5C complete)
