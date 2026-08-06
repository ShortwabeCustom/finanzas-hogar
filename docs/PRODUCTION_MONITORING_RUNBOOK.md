# Production Monitoring Runbook — INCREMENTO 6 (72 horas)

**Período:** 2026-08-06 05:25 UTC — 2026-08-09 05:25 UTC  
**VPS:** /var/www/finanzas-hogar (self-hosted)  
**Contacto escalación:** TBD (actualizar con DevOps/SRE)

---

## Comandos Rápidos por Métrica

### 1. 5XX Errors (últimas N horas)

```bash
# Monitorear logs en tiempo real
pm2 logs finanzas-hogar --err --lines 50

# Buscar patrones de error (últimas 30 min)
tail -100 /root/.pm2/logs/finanzas-hogar-err.log | grep -i "error\|5xx\|timeout"

# Contar errores por hora (de /var/log/nginx/access.log si disponible)
grep "HTTP/1.1 5" /var/log/nginx/access.log | wc -l
```

**Acción si > 5 en 1 hora:**
- Revisar pm2 logs para causas específicas
- Verificar DB conexión: `psql finanzas_hogar -c "SELECT 1"`
- Si persiste > 15 min, ejecutar rollback (ver Sección 5)

---

### 2. Response Times

```bash
# Test latencia a /login
time curl -w "\nTotal: %{time_total}s\n" https://finanzas.torrax.cloud/login > /dev/null

# Test latencia a /payments (requiere sesión; usar token si disponible)
curl -w "HTTP %{http_code} — Total: %{time_total}s\n" https://finanzas.torrax.cloud/payments

# Para requests autenticados, usar credenciales test (si disponibles en .env):
# curl -X POST https://finanzas.torrax.cloud/api/auth/signin \
#   -d 'email=alexis@hogar.com&password=admin123' -w "%{time_total}s"
```

**Interpretar resultados:**
- < 0.5s: Óptimo
- 0.5 — 1.0s: Aceptable
- 1.0 — 2.0s: Lento, investigar
- > 2.0s: Crítico, rollback o optimizar

**Acción si P95 > 2s:**
- Revisar índices DB: `psql finanzas_hogar -c "\d+ Payment"` (verificar índices en `paymentDate`, `status`)
- Revisar queries lentas en logs de Prisma (si habilitado)
- Verificar carga CPU/memoria: `top` o `pm2 monit`

---

### 3. Uptime / PM2 Status

```bash
# Status general
pm2 status

# Verificar uptime y restart count
pm2 describe finanzas-hogar

# Esperado:
#  - status: online
#  - uptime: en crecimiento (no restarts frecuentes)
#  - restarts acumulados: no deben crecer entre chequeos
```

**Acción si status ≠ online:**
- `pm2 logs finanzas-hogar --lines 50` → investigar crash
- `pm2 start finanzas-hogar` (si está stopped)
- Si sigue crasheando, no reintentar > 3 veces, escalar

---

### 4. Database Connection Health

```bash
# Verificar conexión básica
psql finanzas_hogar -c "SELECT NOW() AS timestamp, COUNT(*) as user_count FROM \"User\";"

# Verificar errores en últimas queries
psql finanzas_hogar -c "SELECT * FROM \"Payment\" LIMIT 1;"  # Si falla, DB no accesible

# Estadísticas de conexiones activas
psql finanzas_hogar -c "SELECT * FROM pg_stat_activity;" | grep finanzas_hogar
```

**Acción si conexión falla:**
- Reiniciar postgres: `systemctl restart postgresql` (si control disponible)
- Verificar espacio disco: `df -h` (si < 10% libre, alertar)
- Verificar límites de conexión: `psql -c "SHOW max_connections"`
- Si persiste, contactar administrador DB

---

### 5. Analytics GA4 Status

```bash
# Abrir navegador con sesión iniciada, DevTools Network tab
# Buscar requests a googletagmanager.com

# Checklist:
# 1. ¿Hay requests a Google Analytics?
# 2. ¿Todos responden 200 OK o 204 No Content?
# 3. ¿window.gtag es función en Console?
# 4. ¿window.dataLayer es array?

# Línea de comando (sin interacción):
curl -s https://finanzas.torrax.cloud/ | grep -c "gtag.js\|googletagmanager"
```

**Resultado esperado:** Al menos 1 ocurrencia  
**Acción si = 0:** Revisar `/src/app/layout.tsx` para asegurar GA4 script está incluido

---

## Matriz de Chequeos (72h)

### Cada 1 hora (automático si posible)

```bash
# Dentro de un cron o monitor externo
pm2 status finanzas-hogar | grep -c "online" | xargs -I {} test {} -eq 1 && echo "✅ UP" || echo "❌ DOWN"
```

### Cada 6 horas (manual)

```bash
echo "=== 6h Check ===" && \
echo "PM2 Status:" && pm2 status finanzas-hogar | head -2 && \
echo "Response time:" && curl -w "%{time_total}s\n" https://finanzas.torrax.cloud/login && \
echo "5XX errors:" && pm2 logs finanzas-hogar --lines 100 | grep -c "5XX" && \
echo "DB connection:" && psql finanzas_hogar -c "SELECT 1"
```

### Cada 24 horas (detallado)

```bash
# Ejecutar todos los chequeos arriba
# + Lighthouse audit (si disponible)
# + Revisar error patterns en logs
# + Validar flujos críticos (login, import, paginación)
```

### Al final (T+72h)

```bash
# Resumen ejecutivo
echo "=== INCREMENTO 6 MONITORING SUMMARY ===" && \
echo "Period: 2026-08-06 to 2026-08-09" && \
echo "Uptime: $(pm2 describe finanzas-hogar | grep uptime)" && \
echo "Total restarts: $(pm2 describe finanzas-hogar | grep restarts)" && \
echo "Errors in logs: $(pm2 logs finanzas-hogar --lines 500 | grep -c 'error\|Error\|ERROR')" && \
echo "Status: $(pm2 status finanzas-hogar | grep status | awk '{print $NF}')"
```

---

## Troubleshooting por Síntoma

### Síntoma: "Gateway Timeout 504"

**Causas posibles:**
1. Servidor Next.js está lento (query DB o procesamiento)
2. nginx timeout en `proxy_read_timeout` (default 60s)
3. PDF parser cuelga (OPENAI_API_KEY missing o rate limit)

**Debug:**
```bash
# 1. Revisar logs del servidor
pm2 logs finanzas-hogar --lines 100 | grep -E "timeout|slow|OPENAI"

# 2. Revisar nginx config
grep "proxy_read_timeout\|proxy_connect_timeout" /etc/nginx/sites-enabled/finanzas.torrax.cloud

# 3. Verificar .env OPENAI_API_KEY está presente
grep OPENAI_API_KEY /var/www/finanzas-hogar/.env | wc -c  # Debe ser > 10

# 4. Si es PDF import: probar con un PDF más pequeño
```

**Solución:**
- Si es PDF: usuario repite upload con PDF válido
- Si es query lenta: optimizar índices DB (ver Sección 2)
- Si es timeout nginx: aumentar `proxy_read_timeout 600s` en nginx y recargar

---

### Síntoma: "Unauthorized 401" en APIs

**Causas posibles:**
1. JWT expirado (sesión > max-age)
2. NEXTAUTH_SECRET cambiado o incorrecto en .env
3. Cookie de sesión no se envía (CORS, SameSite settings)

**Debug:**
```bash
# 1. Verificar NEXTAUTH_SECRET en .env
grep NEXTAUTH_SECRET /var/www/finanzas-hogar/.env

# 2. En navegador DevTools → Application → Cookies
#    Buscar "authjs.session-token" o similar
#    Verificar: Domain, Path, SameSite, Secure flags

# 3. Revisar logs: ¿hay mensajes de JWT validation?
pm2 logs finanzas-hogar --lines 50 | grep -i "jwt\|token"
```

**Solución:**
- No cambiar NEXTAUTH_SECRET en producción (rompe sesiones existentes)
- Usuarios deben hacer logout/login manual si cookie expiró
- Si es CORS issue, revisar headers en respuesta (Access-Control-Allow-*)

---

### Síntoma: "Database connection refused"

**Causas posibles:**
1. PostgreSQL service parado
2. DATABASE_URL incorrecto (.env desincronizado)
3. Firewall/network issue entre VPS y DB (si DB remota)
4. Pool de conexiones agotado

**Debug:**
```bash
# 1. Verificar postgres running
systemctl status postgresql

# 2. Probar conexión directa
psql "postgresql://postgres:PASSWORD@localhost:5432/finanzas_hogar" -c "SELECT 1"

# 3. Revisar DATABASE_URL en .env
grep DATABASE_URL /var/www/finanzas-hogar/.env

# 4. Ver estadísticas de pool
psql finanzas_hogar -c "SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;"
```

**Solución:**
- Restart PostgreSQL: `systemctl restart postgresql`
- Aumentar max_connections si agotado (editar postgresql.conf)
- Restart Node.js app para resetear pool: `pm2 restart finanzas-hogar`

---

### Síntoma: "High Memory Usage (> 500MB)"

**Causas posibles:**
1. Memory leak en dependencias (raro en Next.js)
2. Large queries cargando todo en memoria
3. Cache sin límite en cliente/servidor

**Debug:**
```bash
# Monitorear en tiempo real
pm2 monit

# Verificar memoria por proceso
ps aux | grep "next\|node" | grep -v grep

# Revisar queries grandes en logs
pm2 logs finanzas-hogar --lines 200 | grep -i "query\|select" | head -10
```

**Solución:**
- Restart app: `pm2 restart finanzas-hogar` (memory se resetea)
- Implementar paginación en queries grandes (ya hecho para /payments)
- Aumentar RAM del VPS si necesario

---

## Escalation Path

1. **Síntomas aislados (response slow, occasional 5XX):**
   - Investigar con comandos arriba
   - Posible fix: restart app, optimize query
   - NO necesita rollback

2. **Errores críticos (> 10 5XX en 10 min, uptime < 99%):**
   - Ejecutar rollback immediatamente (ver Sección 5 abajo)
   - Investigar causa post-rollback

3. **Seguridad o datos comprometidos:**
   - No usar rollback automático
   - Escalar a incident commander
   - Rotar secrets inmediatamente

---

## Rollback Plan (Si es Crítico)

**Requisito:** Git history y previous build disponibles

```bash
# 1. Identificar commit anterior al deploy (INCREMENTO 6)
git log --oneline | head -5
# Output:
# 9cb515c (HEAD, origin/main) tests(e2e): fix blockers and isolate test server to port 4100  ← INCREMENTO 6
# f9742fc docs: update finanzas.md + create INCREMENTO 6 master prompt + skill guide      ← INCREMENTO 5C

# 2. Revertir a INCREMENTO 5C
git revert 9cb515c --no-edit
# O si se quiere reset limpio (destructivo):
# git reset --hard f9742fc

# 3. Rebuild y redeploy
npm run build && npm run db:push && pm2 restart finanzas-hogar

# 4. Verificar
curl -s https://finanzas.torrax.cloud/login | head -20

# 5. Si todo OK, push a origin (revert commit)
git push origin main
```

**Tiempo estimado:** 5-10 minutos  
**Riesgo:** Cero (reset a commit conocido, DB no se cambia)

---

## Contactos y Escalación

| Persona | Rol | Teléfono | Slack | Notas |
|---------|-----|----------|-------|-------|
| TBD | DevOps / SRE | — | #infraestructura | Actualizar con datos reales |
| TBD | Backend Lead | — | #backend | Escalación de bugs |
| TBD | Product | — | #product | Comunicar status a stakeholders |

---

## Post-Monitoring Report (Completar al T+72h)

```markdown
# INCREMENTO 6 Monitoring Report

**Período:** 2026-08-06 05:25 → 2026-08-09 05:25 UTC

## Métricas

- **Uptime:** __%  (expected >= 99%)
- **Avg Response Time:** __ms  (target < 500ms)
- **5XX Errors:** ___ total  (target = 0)
- **Critical Issues:** ___  (none = ✅)

## Eventos Significativos

- [ ] Ninguno (verde)
- [ ] ___ (describir)

## Recomendaciones

1. TBD
2. TBD

## Signed Off By

- **Name:** ________________
- **Date:** ________________
- **Status:** PASSED / FAILED / ROLLBACK_EXECUTED
```

---

**Archivado:** Este runbook queda como referencia permanente en el repo. Actualizar con contactos reales y copiar la sección de report para cada deploy futuro.
