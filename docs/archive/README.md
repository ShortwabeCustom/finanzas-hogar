# 📦 Archive — Documentación Histórica

**Fecha creación:** 2026-08-06  
**Razón:** Consolidación de documentación en `finanzas.md`

---

## 📋 Contenido

Documentos históricos de incrementos y sesiones pasadas. La información crítica ha sido consolidada en **`finanzas.md`** (documento principal).

### Documentación de Incrementos (Antigua)

Estos archivos contienen prompts y reportes específicos de sesión de incrementos completados:

```
INCREMENTO_3_SESION_SIGUIENTE.md          — Planificación INCREMENTO 3
INCREMENTO_4_MIGRACION_SAFE_PHONE.md      — DB migration safe phone
INCREMENTO_4_SESION2_MASTER.md            — Tests + Notificaciones
INCREMENTO_4_SESION3_MASTER.md            — DB Migration + Cron
INCREMENTO_4_SESION4_MASTER.md            — E2E + QA + SendGrid
INCREMENTO_5_MASTER_PROMPT.md             — Planificación INCREMENTO 5
INCREMENTO_5C_FINAL_REPORT.md             — Reporte final E2E + QA
INCREMENTO_5C_MASTER_PROMPT.md            — E2E + QA + Build validation
INCREMENTO_5C_RESULTS.md                  — Resultados específicos
INCREMENTO_5C_STATUS.txt                  — Status updates
INCREMENTO_5C_SUMMARY.md                  — Resumen ejecución
INCREMENTO_6_MASTER_PROMPT.md             — Deploy + Monitoreo
QUICK_REFERENCE.md                        — Quick ref deudas (v1)
```

**¿Cuándo usarlos?** Solo como referencia histórica. Para info actual, usar **`finanzas.md`**.

### Resultados de Tests

```
test-results/                             — Resultados E2E tests de sesiones
```

---

## 🎯 Referencia Rápida: ¿Cuándo Buscar Aquí?

| Necesidad | Usar Este Archivo | O Usar finanzas.md |
|-----------|------------------|-------------------|
| Entender la app ahora | ❌ No | ✅ § Arquitectura + § API Routes |
| Flujo login/dashboard | ❌ No | ✅ § Módulos y Flujos |
| Deployar a producción | ❌ No | ✅ § Deployment y Monitoreo |
| Troubleshooting errores | ❌ No | ✅ § Troubleshooting |
| Entender CÓMO se hizo INCREMENTO 5 | ✅ Sí | — |
| Ver resultados específicos de un test | ✅ Sí | — |
| Historial de cambios | ✅ Aquí (parcial) | ✅ finanzas.md § Historial |

---

## ✅ Archivos Que Seguir Usando

Estos documentos **NO fueron archivados** porque siguen siendo útiles como referencia:

| Archivo | Propósito |
|---------|-----------|
| `finanzas.md` | **Documento principal — fuente de verdad** ⭐ |
| `DOCUMENTACION_CONSOLIDADA.md` | Resumen de la consolidación (este proyecto) |
| `QA_CHECKLIST_INCREMENTO_5.md` | 62 items de validación manual (reutilizable) |
| `QA_E2E_TEST_RESULTS.md` | Resultados específicos de E2E tests |
| `PRODUCTION_VALIDATION_SCREENSHOTS.md` | Guía paso a paso de validación |
| `PRODUCTION_MONITORING_RUNBOOK.md` | Comandos de monitoreo y troubleshooting |
| `SKILL_GUIDE_POR_INCREMENTO.md` | Guía para planning de nuevo trabajo |
| `RELEASE_5.0.md` | Release notes v5.0 (histórico) |

---

## 🗂️ Estructura

```
/var/www/finanzas-hogar/
├── finanzas.md                           ← 📌 DOCUMENTO PRINCIPAL
├── DOCUMENTACION_CONSOLIDADA.md          ← Resumen de consolidación
├── docs/
│   └── archive/                          ← Documentación histórica
│       ├── README.md                     ← Este archivo
│       ├── INCREMENTO_*.md               ← Prompts/reportes viejos
│       ├── QUICK_REFERENCE.md            ← Quick ref v1
│       ├── test-results/                 ← Resultados tests históricos
│       └── test-results.json
├── QA_CHECKLIST_INCREMENTO_5.md          ← Aún útil
├── QA_E2E_TEST_RESULTS.md                ← Aún útil
├── PRODUCTION_VALIDATION_SCREENSHOTS.md  ← Aún útil
├── PRODUCTION_MONITORING_RUNBOOK.md      ← Aún útil
├── SKILL_GUIDE_POR_INCREMENTO.md         ← Aún útil
└── RELEASE_5.0.md                        ← Aún útil
```

---

## 📝 Notas

- Los archivos archivados contienen información **consolidada** en `finanzas.md` — no están perdidos, solo organizados
- Si necesitas ver cómo se hizo algo específico de un incremento, busca aquí
- Para nueva documentación de incrementos, **agregar a finanzas.md § Historial de Cambios**, no crear archivo nuevo

---

**Última actualización:** 2026-08-06  
**Mantenido por:** Documentation System
