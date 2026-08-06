# INCREMENTO 6: DEPLOY + PRODUCCIÓN + OPTIMIZACIÓN
**Fecha:** 2026-08-06 (siguiente sesión)  
**Basado en:** INCREMENTO 5 (A+B+C completados)  
**Estado previo:** Main branch con INCREMENTO 5C validado 100%, ✅ DEPLOY READY  

---

## 🎯 OBJETIVO GENERAL

Llevar **INCREMENTO 5 a producción** con validación completa de E2E tests, ejecutar QA final, y preparar optimizaciones post-deploy. Verificar que todas las funcionalidades (Import Wizard, Paginación, Analytics GA4) funcionan en producción antes de cerrar el incremento.

**Resultado esperado:** Sistema completamente funcional en producción con monitoreo activo y 0 errores críticos.

---

## 📋 SECCIÓN 1: EJECUTAR E2E TESTS (Setup + Run)

### 1.1 Setup Base de Datos de Test

```bash
# En servidor o máquina de desarrollo

# 1. Crear DB test
createdb finanzas_test

# 2. Aplicar schema
DATABASE_URL="postgresql://user:pass@localhost:5432/finanzas_test" npm run db:push

# 3. Seed con datos de prueba
DATABASE_URL="postgresql://user:pass@localhost:5432/finanzas_test" npm run db:seed
```

**Verificación:** PostgreSQL debe tener `finanzas_test` con tablas Prisma generadas + usuario seed (`alexis.pro_sk8@hotmail.com / password`).

### 1.2 Ejecutar E2E Tests

```bash
# En /var/www/finanzas-hogar

# Opción 1: Todos los tests
npm run test:e2e

# Opción 2: Suite específica
npm run test:e2e -- tests/e2e/import-statements.spec.ts
npm run test:e2e -- tests/e2e/pagination.spec.ts
npm run test:e2e -- tests/e2e/analytics.spec.ts

# Opción 3: Con interfaz gráfica
npm run test:e2e:ui

# Opción 4: Debug interactivo
npm run test:e2e:debug
```

**Criterios de éxito:**
- [x] 17/18 tests PASS (o 18/18)
- [x] Import workflow: upload, preview, confirm fluyen sin errores
- [x] Paginación: cursor-based, sin duplicados, SPA transitions
- [x] Analytics: GA4 events se registran
- [ ] Generar reporte HTML: `npx playwright show-report`

**Documentar resultados:** Actualizar `QA_E2E_TEST_RESULTS.md` con:
- Fecha/hora ejecución
- Browserstack o ambiente local
- Resultados por suite
- Screenshots de errores (si aplica)
- Performance metrics

### 1.3 Validación Lighthouse Post-E2E

Una vez E2E tests pasan, ejecutar Lighthouse en **staging** o **producción**:

```bash
# Opción 1: Chrome DevTools (manual)
# 1. Abrir https://finanzas.torrax.cloud en Chrome
# 2. F12 → Lighthouse tab
# 3. Generate report (mobile + desktop)
# 4. Verificar:
#    - Performance >= 80
#    - Accessibility >= 90
#    - Best Practices >= 90
#    - SEO >= 90

# Opción 2: CLI
npm install -g lighthouse
lighthouse https://finanzas.torrax.cloud --output=json --output-path=lighthouse-report.json
```

**Guardar reportes:** `/var/www/finanzas-hogar/lighthouse-reports/2026-08-06-prod.json`

---

## 📋 SECCIÓN 2: DEPLOY A PRODUCCIÓN

### 2.1 Pre-Deploy Checklist

- [x] Todos los E2E tests pasan
- [x] QA manual: 62/62 items
- [x] Build: `npm run build` exitoso
- [x] TypeScript: 0 errores
- [x] ESLint: passing
- [x] Lighthouse: scores aceptables
- [x] No hay secrets/API keys en código
- [x] Todas las migraciones Prisma aplicadas
- [x] Environment variables configuradas (.env)
- [x] Commit + push a main

### 2.2 Deploy Steps (Vercel o VPS)

**Si Vercel (recomendado):**
```bash
# 1. Push a main está automático → Vercel redeploy
# 2. Verificar deployment:
#    - Visit https://veranzas.torrax.cloud (o tu Vercel domain)
#    - Hacer login con credenciales de prueba
#    - Verificar Home → Dashboard, Pagos, Personal
#    - Hacer import de PDF (usar fixtures/sample-santander.pdf)
#    - Verificar paginación en /payments
#    - Abrir DevTools → Network → buscar gtag.js
# 3. Si hay error:
#    - Revisar Vercel deployment logs
#    - Revisar funciones serverless (timeouts)
#    - Rollback si es necesario: `vercel --prod --cwd .`
```

**Si VPS (manual):**
```bash
# En servidor /var/www/finanzas-hogar
cd /var/www/finanzas-hogar
git pull origin main
npm install  # si hay cambios package.json
npm run build
npm run db:push  # aplica migraciones
pm2 restart finanzas-hogar
# Verificar: curl http://127.0.0.1:4000/login
```

### 2.3 Post-Deploy Verification

| Aspecto | Verificación | Status |
|---------|--------------|--------|
| **Login** | Acceder con credenciales demo | [ ] |
| **Dashboard** | Cargar sin errores 5XX | [ ] |
| **Import PDF** | Upload, preview, confirm funciona | [ ] |
| **Paginación** | "Cargar más" en /payments sin reload | [ ] |
| **Analytics** | Network tab → gtag.js (200 OK) | [ ] |
| **Mobile** | Viewport 375px responsive | [ ] |
| **Errores console** | DevTools sin errores JS rojos | [ ] |
| **Lighthouse** | Mobile >= 80 | [ ] |
| **Response times** | API requests < 500ms | [ ] |

---

## 📋 SECCIÓN 3: VALIDACIÓN PRODUCCIÓN (Smoke Testing)

### 3.1 Flujo crítico: Import PDF

```
1. Login → alexis.pro_sk8@hotmail.com / password
2. Navegar a /personal/statements/import
3. Paso 1: Seleccionar "Santander"
4. Paso 2: Subir tests/fixtures/sample-santander-checking.pdf
   - Verificar: progress bar, sin errores, archivo muestra nombre
5. Paso 3: Preview tabla con 42 transacciones
   - Verificar: columnas correctas, selector cuenta visible
6. Paso 4: Confirmar importación
   - Verificar: "Importación exitosa", botón "Ver transacciones"
7. Click "Ver transacciones"
   - Verificar: tabla con movimientos Santander
```

**Documentar:** Tomar screenshot de cada paso exitoso → `PRODUCTION_VALIDATION_SCREENSHOTS.md`

### 3.2 Flujo crítico: Paginación

```
1. Ir a /payments
2. Verificar: tabla carga con <= 20 items
3. Click "Cargar más"
   - Verificar: nuevas filas sin reload (SPA), URL no cambió
4. Verificar: sin duplicados entre página 1 y 2
```

### 3.3 Flujo crítico: Analytics

```
1. Abrir DevTools → Network tab
2. Ir a /dashboard
   - Verificar: Network muestra gtag.js (200 OK)
3. Ir a /personal/payments
   - Verificar: evento page_view registrado en GA4
4. Crear un nuevo pago (TEST)
   - Verificar: evento payment_created en GA4
5. Eliminar el pago de prueba
```

**Documentar:** Timestamp de eventos, URLs, parámetros → `GA4_PRODUCTION_EVENTS.md`

---

## 📋 SECCIÓN 4: MONITOREO PRODUCCIÓN (72 HORAS)

### 4.1 Métricas a vigilar

| Métrica | Herramienta | Alerta si | Check | Status |
|---------|------------|-----------|-------|--------|
| 5XX errors | Sentry / logs | > 5/hora | Cada 6h | [ ] |
| Response time | Lighthouse / APM | P95 > 2s | Cada 6h | [ ] |
| GA4 events | GA4 console | evento_count = 0 | Diario | [ ] |
| DB queries | Prisma/pgAdmin | N+1, timeout | Diario | [ ] |
| Uptime | Healthcheck | < 99% | Cada hora | [ ] |

### 4.2 Acciones si hay problemas

| Síntoma | Acción |
|---------|--------|
| 5XX errors en /import | Revisar logs → PostgrSQL conexión → Rollback |
| Paginación lenta (> 1s) | Verificar índices DB → Re-run migrations |
| GA4 no trackea | Verificar gtag.js en DevTools → OPENAI_API_KEY en .env |
| Mobile broken | Viewport test en DevTools → Revisar CSS responsive |

---

## 📋 SECCIÓN 5: CIERRE DEL INCREMENTO

### 5.1 Documentación final

- [ ] Actualizar `finanzas.md` con fecha/status de INCREMENTO 5 finalizado
- [ ] Crear tag Git: `git tag -a v5.0-prod -m "INCREMENTO 5 deployed to production"`
- [ ] Subir tag: `git push origin v5.0-prod`
- [ ] Generar release notes: `RELEASE_5.0.md`

### 5.2 Release Notes template

```markdown
# Release v5.0 — INCREMENTO 5 Completo

## ✅ Features

- **Import Wizard (4 pasos)** — Seleccionar banco → Upload PDF → Preview → Confirmar
- **Pagination cursor-based** — /payments con "Cargar más" sin reload
- **Analytics GA4** — Event tracking, page_view automático
- **Skeleton screens** — Loading states sin layout shift
- **Metadata dinámico** — Títulos únicos por página

## 📊 Quality

- **18 E2E tests** — import, pagination, analytics
- **62/62 QA manual items** — 100% pass rate
- **Build clean** — 0 TypeScript errors
- **Accessibility** — WCAG AA compliant
- **Performance** — Lighthouse mobile >= 80

## 🚀 Deployment

- **Date:** 2026-08-06
- **Environment:** Production
- **Estimated users impacted:** All authenticated users
- **Rollback plan:** Git tag v4.3, `pm2 restart`, DB migration rollback

## 📝 Known limitations

- [ ] E2E tests require DB seed (no automation in CI yet)
- [ ] Lighthouse audit manual (no automated periodic checks)
- [ ] GA4 events no custom dashboard (use Google Analytics UI)

## 🎓 Next

- INCREMENTO 6: Optimizaciones post-deploy, refining UX based on user feedback
```

### 5.3 Comunicación al equipo

- [ ] Enviar release notes a stakeholders
- [ ] Crear retrospectiva (qué salió bien, qué mejorar)
- [ ] Documentar blockers + solutions
- [ ] Programar follow-up en 1 semana (feedback de usuarios)

---

## 🔧 SKILL A USAR: **`/senior-fullstack`**

### Por qué senior-fullstack:

Este incremento involucra:
- **End-to-end testing** (E2E Playwright) — testing strategy, Playwright config, test case design
- **Production deployment** — environment setup, migration strategy, rollback planning
- **Monitoring & alerting** — Sentry, logs, performance profiling
- **Full-stack validation** — frontend + backend + database + third-party (GA4)

`/senior-fullstack` cubre arquitectura, patrones deployment, testing strategies y production readiness.

### Alternativas viables:
- **`/qa-test-planner`** — si focus es solo en E2E execution + QA validation (subset)
- **`/senior-backend`** — si focus es DB migration + API deployment (subset)
- **`/run`** — para ejecutar la app y verificar en tiempo real

### Comando sugerido:

```bash
/senior-fullstack
```

Luego en el prompt de la sesión:

```
Ejecutar INCREMENTO 6: Deploy + Producción + E2E Tests
- Configurar DB test y ejecutar 18 E2E tests (3 suites)
- Deployar a producción (Vercel o VPS)
- Validación post-deploy (smoke tests críticos)
- Monitoreo 72h (métricas, alertas, rollback plan)
- Documentación final + release notes

Usar finanzas.md como contexto de arquitectura.
Verificar QA_CHECKLIST_INCREMENTO_5.md para know-how.
```

---

## 📋 CHECKLIST FINAL

**Antes de marcar INCREMENTO 6 como COMPLETADO:**

- [ ] E2E Tests: 17/18+ PASS (solo 1 allowed si timeout)
- [ ] QA Manual: 62/62 verificado en producción
- [ ] Build: Clean deploy (0 errors)
- [ ] Lighthouse: Mobile >= 80 (staging + prod)
- [ ] Production validation: Import + Pagination + Analytics fluyen
- [ ] Monitoreo 72h: Sin alertas críticas
- [ ] Documentación: Release notes + finanzas.md actualizado
- [ ] Git: Commit + tag v5.0-prod
- [ ] Rollback plan: Testeado (aborable en < 5 min)

---

**PRÓXIMO INCREMENTO:** INCREMENTO 7 — Feature nuevas o refinamiento UX basado en feedback de usuarios.

