# 01 — Sitemap Funcional

## Árbol de rutas (App Router)

```
/ (root)
├── /login                          AUTH — Pantalla de acceso
│
└── (app) — Requiere sesión activa
    │
    ├── /dashboard                  Finanzas en Pareja · Dashboard global
    ├── /payments                   Finanzas en Pareja · Pagos del hogar
    ├── /categories                 Finanzas en Pareja · Categorías globales
    ├── /pantry                     Finanzas en Pareja · Despensa
    │
    ├── /personal
    │   ├── /personal/dashboard     Mis Finanzas · Mi dashboard personal
    │   ├── /personal/payments      Mis Finanzas · Mis pagos personales
    │   ├── /personal/categories    Mis Finanzas · Mis categorías personales
    │   ├── /personal/cards         Mis Finanzas · Mis tarjetas y cuentas
    │   └── /personal/statements    Mis Finanzas · Estados de cuenta bancarios
    │
    ├── /financial
    │   └── /financial/recovery-plan  Mis Finanzas · Plan para ponerme al corriente
    │
    └── /users                      Administración · Gestión de usuarios (solo ADMIN)
```

---

## Grupos de navegación (Sidebar)

El sidebar implementa dos grupos colapsables y una sección de administración condicional.

### Grupo 1: Finanzas en Pareja (ícono corazón rosa)
| Ruta | Label | Ícono SVG | Estado activo |
|------|-------|-----------|---------------|
| `/dashboard` | Dashboard | Casa / home | `bg-indigo-700 text-white` |
| `/payments` | Pagos | Billete | `bg-indigo-700 text-white` |
| `/pantry` | Despensa | Caja/almacén | `bg-indigo-700 text-white` |
| `/categories` | Categorías | Etiqueta | `bg-indigo-700 text-white` |

### Grupo 2: Mis Finanzas (ícono persona cielo)
| Ruta | Label | Ícono SVG |
|------|-------|-----------|
| `/personal/dashboard` | Mi Dashboard | Velocímetro |
| `/personal/payments` | Mis Pagos | Billete |
| `/personal/categories` | Mis Categorías | Etiqueta |
| `/personal/cards` | Mis Tarjetas | Tarjeta |
| `/personal/statements` | Estados de Cuenta | Documento |
| `/financial/recovery-plan` | Plan de Recuperación | Barras ascendentes |

### Sección Admin (solo `role === "ADMIN"`)
| Ruta | Label |
|------|-------|
| `/users` | Usuarios |

---

## Estados del sidebar

| Breakpoint | Comportamiento |
|------------|----------------|
| `< md` (móvil) | Oculto; se abre con botón hamburguesa en Header; overlay + slide desde izquierda |
| `≥ md` (desktop) | Fijo a la izquierda; colapsable a 64px (solo íconos) o expandido 256px |

**Collapsed (64px):** Solo íconos centrados, tooltip con `title` al hover. Logo reducido. El botón de toggle rota 180°.  
**Expanded (256px):** Logo + nombre de app + grupos con headers colapsables + nombre/rol del usuario en footer.

---

## APIs por módulo

| Módulo | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/[...nextauth]` |
| Dashboard hogar | `GET /api/dashboard?from&to&granularity` |
| Pagos hogar | `GET/POST /api/payments`, `PATCH/DELETE /api/payments/[id]` |
| Categorías | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/[id]` |
| Despensa | `GET/POST /api/pantry`, CRUD `/api/pantry/[id]`, compras `/api/pantry/[id]/purchases` |
| Pagos personales | `GET/POST /api/personal/payments`, `PATCH/DELETE /api/personal/payments/[id]`, `PATCH /api/personal/payments/[id]/mark-paid` |
| Tarjetas | `GET/POST /api/personal/cards`, `PATCH/DELETE /api/personal/cards/[id]` |
| Categorías personales | `GET/POST /api/personal/categories`, `PATCH/DELETE /api/personal/categories/[id]` |
| Dashboard personal | `GET /api/personal/dashboard` |
| Estados de cuenta | `GET /api/financial/statements`, `GET /api/financial/transactions` |
| Importación | `POST /api/financial/statements` (vía internal upload) |
| Plan recuperación | `GET /api/financial/recovery-plan?months=` |
| Sync financiero | `POST /api/financial/sync` |
| Usuarios | `GET/POST /api/users`, `PATCH/DELETE /api/users/[id]` |
| Subida archivos | `POST /api/upload`, `GET /api/receipt/[file]` |
