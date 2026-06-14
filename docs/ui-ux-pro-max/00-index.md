# Finanzas del Hogar — Documentación UX/UI Pro Max

> Auditoría y documentación completa del producto. Basada en lectura directa del código fuente (junio 2026).  
> URL de producción: https://finanzas.torrax.cloud  
> Stack: Next.js 15 App Router · TypeScript · Tailwind CSS v4 · Prisma 7 · PostgreSQL · NextAuth · Recharts

---

## Índice de documentos

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [Sitemap funcional](./01-sitemap.md) | Árbol de rutas, grupos de navegación, accesos por rol |
| 02 | [Flujos principales](./02-flows.md) | 10 flujos documentados paso a paso |
| 03 | [Matriz de módulos](./03-module-matrix.md) | Módulo → usuario → problema → datos → acción → vacío → error → KPI |
| 04 | [Design System financiero](./04-design-system.md) | Tokens, estados de riesgo, componentes, tipografía, charts |
| 05 | [Eventos analíticos](./05-analytics.md) | Definición GA4/Firebase de 10 eventos clave |
| 06 | [Backlog priorizado](./06-backlog.md) | Quick Wins · UX · UI · Analytics · Accesibilidad · Riesgos |

---

## Contexto del producto

**Finanzas del Hogar** es una aplicación privada de gestión financiera para parejas y hogares. Combina dos planos paralelos:

- **Finanzas en Pareja** — gastos compartidos del hogar, despensa, categorías y dashboard global
- **Mis Finanzas** — pagos personales, tarjetas bancarias, estados de cuenta bancarios y plan de recuperación

### Personas objetivo

| Persona | Contexto |
|---------|----------|
| **Administrador del hogar** | Gestiona categorías globales, pagos compartidos y usuarios. Rol: ADMIN |
| **Miembro del hogar** | Registra y consulta pagos compartidos. Rol: EDITOR o VIEWER |
| **Individuo financiero** | Gestiona sus propios pagos, tarjetas y estado de cuenta personal. Cualquier rol |

### Principios de diseño aplicados

1. **Claridad financiera primero** — los números son el contenido, no el decorado
2. **Jerarquía de urgencia** — rojo > ámbar > verde, siempre consistente
3. **Acción visible** — la acción principal debe ser la más fácil de encontrar
4. **Estado vacío útil** — guiar al usuario hacia la primera acción
5. **Responsive desde 375px** — mobile-first con tabla ↔ cards según breakpoint
