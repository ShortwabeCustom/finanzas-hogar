# Production Validation — INCREMENTO 6

**Fecha de Deploy:** 2026-08-06 05:25 UTC  
**URL Producción:** https://finanzas.torrax.cloud  
**Ambiente:** VPS self-hosted (PM2 + nginx + Certbot)

---

## Validación de Humo (Smoke Tests Automatizados)

✅ **Endpoint /login:** Responde 200 OK, contiene botón "Iniciar sesión"  
✅ **Reverse proxy nginx:** Funciona correctamente, redirecciona HTTP → HTTPS  
✅ **PM2 finanzas-hogar:** Proceso online (uptime 3s post-restart), sin crash loops  
✅ **Base de datos:** `finanzas_hogar` sincronizada, queries respondiendo < 500ms  
✅ **Build artifacts:** `.next/` existe (build completado 2026-08-06 05:20 UTC)

---

## Validación Manual — Flujos Críticos

**Nota:** Los siguientes flujos requieren credenciales de producción válidas. Están documentados aquí como checklist para que el usuario los ejecute durante los primeros 72 horas post-deploy.

### Flujo 1: Login

1. Abrir https://finanzas.torrax.cloud
2. ➜ Ver página de login con formulario email + password
3. Ingresar credenciales reales (usuario ADMIN o EDITOR de producción)
4. Click "Iniciar sesión"
5. ➜ Redirige a /dashboard sin errores 5XX
6. ➜ Dashboard carga (puede tardar 2-3s en primera carga)
7. ✅ Screenshot: Capturar dashboard con KPI visible

**Frecuencia en 72h:** Ejecutar en:
- T+0h (inmediato post-deploy)
- T+24h
- T+72h

---

### Flujo 2: Import de PDF (Statements)

1. En dashboard, navegar a "Mis Finanzas" → "Estados de Cuenta" (o icono en sidebar)
2. ➜ Ver botón "Importar PDF / XML"
3. Seleccionar un estado de cuenta PDF Santander válido (no el fixture de tests)
4. Paso 1: Seleccionar "Santander"
5. Paso 2: Drag & drop del PDF (o click para explorador de archivos)
6. ➜ Verificar progress bar, sin timeout 504/504 Gateway
7. Paso 3: Preview de transacciones (debe mostrar tabla con filas)
8. Paso 4: Confirmar importación
9. ➜ Mensaje "Importación exitosa"
10. ✅ Screenshot: Tabla preview con transacciones

**Criterio de éxito:** PDF se procesa en < 30s, no hay error 503 "OpenAI API faltante"

**Frecuencia:** T+24h (solo una vez; operación sensible con I/O)

---

### Flujo 3: Paginación en Pagos del Hogar

1. Navegar a "Finanzas en Pareja" → "Pagos"
2. ➜ Tabla carga con máx 20 registros inicialmente
3. Verificar que hay botón "Cargar más" visible (si DB tiene > 20 registros)
4. Scroll al fondo, click "Cargar más"
5. ➜ Nuevas filas se agregan sin reload (SPA)
6. Verificar URL no cambió (`/payments`, sin query params)
7. ✅ Screenshot: Tabla con 30+ filas cargadas

**Criterio de éxito:** Paginación sin reload, sin errores JavaScript en DevTools

**Frecuencia:** T+0h, T+48h

---

### Flujo 4: Analytics GA4

1. Abrir https://finanzas.torrax.cloud en Chrome
2. F12 → Network tab
3. Iniciar sesión
4. ➜ Navegar a /dashboard
5. En Network tab, buscar requests a `googletagmanager.com` o `analytics.google.com`
6. ➜ Debe haber al menos 1-2 requests 200 OK (GA4 events)
7. Navegar a /payments
8. ➜ Debe haber nuevo request (page_view event)
9. Console tab: escribir `window.dataLayer` → debe retornar array con eventos
10. ✅ Screenshot: Network con requests de GA4, Console con dataLayer

**Criterio de éxito:** `window.gtag` es función, dataLayer es array con eventos

**Frecuencia:** T+0h (verificación rápida)

---

### Flujo 5: Mobile Responsive (375px)

1. En el mismo Chrome con sesión iniciada, abrir DevTools
2. Device toolbar (Ctrl+Shift+M), seleccionar "iPhone 12" (375px)
3. Navegar a /dashboard
4. ➜ Sidebar oculto, hamburger menu visible
5. Click hamburger → sidebar overlay aparece
6. Click en "Pagos" → navega sin errores
7. ➜ Tabla/cards responsive
8. Scroll → verificar que no hay layout shift, sin scroll horizontal involuntario
9. ✅ Screenshot: Dashboard en 375px

**Criterio de éxito:** Layouts responsivos sin errores, sidebar colapsable funciona

**Frecuencia:** T+24h

---

### Flujo 6: Error Handling

1. En /dashboard, abrir DevTools → Console
2. Verificar que no hay errores JS rojos (solo warnings/logs normales)
3. Navegar a /payments → sin errores
4. Navegar a /personal/debts → sin errores
5. Intentar acceder a ruta protegida sin autenticación (abrir `/personal/payments` en incógnito)
6. ➜ Redirige a /login sin errores
7. ✅ Screenshot: Console limpia (solo logs, sin errores)

**Criterio de éxito:** Cero errores JS que aparezcan en Console

**Frecuencia:** T+0h, T+72h

---

## Lighthouse Audit (Producción)

**Requisito:** Chrome headless con `lighthouse` CLI

```bash
npm install -g lighthouse
lighthouse https://finanzas.torrax.cloud --output=json --output-path=lighthouse-reports/2026-08-06-prod.json --chrome-flags="--headless"
```

**Criterios de éxito:**
- Performance >= 80 (móvil >= 75)
- Accessibility >= 90
- Best Practices >= 90
- SEO >= 90

**Notas:**
- Lighthouse puede estar limitado en VPS (sin Chrome disponible)
- Si no se puede ejecutar CLI, ejecutar manual via Chrome DevTools F12 → Lighthouse tab

**Frecuencia:** T+0h y T+72h (antes/después del período de monitoreo)

---

## Matriz de Monitoreo 72 Horas

| Métrica | Herramienta | Alerta si | Check | T+0 | T+24h | T+48h | T+72h |
|---------|-------------|-----------|-------|-----|-------|-------|-------|
| 5XX errors | `pm2 logs finanzas-hogar` | > 5/hora | Cada 6h | ✓ | ✓ | ✓ | ✓ |
| Response time | `curl -w %{time_total}` | > 2s | Cada 6h | ✓ | ✓ | ✓ | ✓ |
| Uptime | `pm2 status` | status ≠ online | Cada hora | ✓ | ✓ | ✓ | ✓ |
| DB errors | `psql finanzas_hogar` | conexión falla | Diario | ✓ | ✓ | ✓ | ✓ |
| Analytics events | GA4 console | evento_count = 0 | Diario | ✓ | ✓ | ✓ | ✓ |

---

## Checklist de 72 Horas

- [ ] **T+0h:** Login funciona, smoke tests pasan, error handling OK
- [ ] **T+6h:** `pm2 logs` sin errores críticos, response times < 1s
- [ ] **T+12h:** Paginación probada, Analytics confirmado
- [ ] **T+24h:** Import PDF prueba (si aplica), mobile responsive OK
- [ ] **T+30h:** Lighthouse ejecutado (manual o CLI)
- [ ] **T+48h:** Segunda validación de flujos críticos, DB stats OK
- [ ] **T+72h:** Tercera validación, resumen de métricas, rollback plan ready (si algo falla)

---

## Plan de Rollback (Si hay críticos)

Si detectas cualquiera de estos síntomas:
1. **> 5 errores 5XX en 1 hora:**
   ```bash
   git log --oneline -5
   git checkout <commit-anterior-al-deploy>
   npm run build
   pm2 restart finanzas-hogar
   ```

2. **Response times > 2s consistentes:**
   ```bash
   npm run db:migrate status  # Verificar índices
   # O revertir cambios recientes si la build es la culpable
   ```

3. **Uptime < 99% (proceso crashing):**
   ```bash
   pm2 logs finanzas-hogar --lines 100  # Investigar causa
   # Reportar al canal de alerts/monitoring
   ```

4. **Seguridad (credenciales expuestas, etc):**
   - Rotar `.env` inmediatamente
   - Contactar al equipo de infraestructura
   - No usar rollback, escalar a incident response

---

## Documentación Post-Validación

Al completar los 72 horas, actualizar este archivo con:
- Fecha/hora de cada checklist ejecutado
- Status (✅/❌) y cualquier anomalía detectada
- Número de errores observados (si los hay)
- Recomendaciones para INCREMENTO 7

**Completado por:** (Tu nombre/email)  
**Fecha de cierre:** (YYYY-MM-DD HH:MM UTC)
