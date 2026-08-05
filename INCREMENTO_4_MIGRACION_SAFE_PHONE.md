# INCREMENTO 4: Migración Segura - Agregar Campo `phone` a User

**Objetivo:** Agregar el campo `phone` al modelo `User` en Prisma SIN eliminar datos existentes.

**Estado actual:**
- Schema Prisma ya actualizado con campo `phone` en modelo User
- Base de datos en PostgreSQL: `finanzas_hogar` en `localhost:5432`
- Datos existentes: TODOS deben preservarse
- Usuarios registrados: 3+ (admin, editor, viewer)

---

## 📋 PLAN DE MIGRACIÓN SEGURA

### Paso 1: Crear migración SQL manual (sin reset)

Ejecutar en terminal:
```bash
npx prisma migrate dev --name add_phone_to_user --create-only
```

Esto crea el archivo de migración SIN aplicarlo.

### Paso 2: Editar archivo de migración

Ubicación: `prisma/migrations/[timestamp]_add_phone_to_user/migration.sql`

**Contenido a escribir:**
```sql
-- AddColumn phone to User table
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Optional: Add index for WhatsApp lookups (mejora performance)
CREATE INDEX "User_phone_idx" ON "User"("phone");
```

**Explicación:**
- `TEXT` permite valores NULL (usuarios existentes quedarán con phone = NULL)
- No hay constraint NOT NULL, así que es safe para datos existentes
- El índice acelera búsquedas por teléfono

### Paso 3: Aplicar migración (preserva datos)

```bash
npx prisma migrate deploy
```

Esto:
✅ Ejecuta SOLO la migración new (no toca nada más)
✅ Preserva TODOS los datos existentes
✅ Agrega columna `phone` como NULL para usuarios actuales
✅ Usuarios pueden luego actualizar su teléfono via API

### Paso 4: Generar Prisma Client

```bash
npx prisma generate
```

### Paso 5: Verificación

```bash
# Conectar a BD y verificar
psql -U postgres -d finanzas_hogar -c "SELECT id, name, email, phone FROM \"User\" LIMIT 5;"
```

**Resultado esperado:**
```
                  id                  |   name    |          email          | phone
--------------------------------------+-----------+-------------------------+-------
 clx1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6 | Alexis    | alexis@hogar.com        | (null)
 clx2a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6 | Beatriz   | beatriz@hogar.com       | (null)
 clx3a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6 | Viewer    | viewer@hogar.com        | (null)
```

---

## 🔍 VERIFICACIÓN POST-MIGRACIÓN

### 1. Verificar schema en Prisma

```bash
npx prisma db pull
```

Debería mostrar: `Column added: phone (String?)`

### 2. Probar API de actualizar teléfono

```bash
# Login y obtener token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alexis@hogar.com","password":"admin123"}'

# Actualizar teléfono
curl -X PUT http://localhost:4000/api/personal/user/phone \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+56912345678"}'

# Response esperado:
# {"id":"...", "name":"Alexis", "email":"alexis@hogar.com", "phone":"+56912345678"}
```

### 3. Verificar en BD nuevamente

```bash
psql -U postgres -d finanzas_hogar -c "SELECT id, name, email, phone FROM \"User\" LIMIT 5;"
```

Debería mostrar: phone actualizado para usuarios que lo configuraron, NULL para otros.

### 4. Build y tests

```bash
npm run build          # TypeScript clean check
npm run test:unit      # Si existen tests unitarios
```

---

## ⚠️ ROLLBACK (Si algo falla)

Si necesitas revertir:

```bash
# Ver migraciones aplicadas
npx prisma migrate status

# Revertir SOLO la última migración (requiere --skip-generate para dev)
npx prisma migrate resolve --rolled-back add_phone_to_user
```

O manualmente:
```sql
-- En psql, ejecutar:
ALTER TABLE "User" DROP COLUMN "phone";
DROP INDEX "User_phone_idx";
```

---

## 📝 ARCHIVOS INVOLUCRADOS

**Creados/Modificados:**
- ✅ `prisma/schema.prisma` — Agregado campo `phone` a modelo User
- ✅ `src/app/api/personal/user/phone/route.ts` — Endpoint PUT para actualizar teléfono
- ✅ `src/app/api/personal/debts/[id]/notifications/test/route.ts` — Test notification endpoint
- ✅ `src/app/api/personal/notifications/history/route.ts` — Notification history endpoint
- 🔄 `prisma/migrations/[timestamp]_add_phone_to_user/migration.sql` — **A crear en Paso 1**

---

## ✅ DEFINICIÓN DE HECHO

- [ ] Migración SQL creada (step 1)
- [ ] Migración SQL editada con contenido correcto (step 2)
- [ ] `npx prisma migrate deploy` ejecutado exitosamente (step 3)
- [ ] `npx prisma generate` ejecutado (step 4)
- [ ] Verificación SQL muestra 5 usuarios con phone = NULL (step 5.1)
- [ ] `npx prisma db pull` no reporta cambios (step 5.2)
- [ ] API PUT `/api/personal/user/phone` funciona y actualiza (step 5.2)
- [ ] Build `npm run build` sin errores TypeScript (step 5.4)
- [ ] Commit creado: `feat(db): add phone field to user model with safe migration`

---

## 🚀 ORDEN DE EJECUCIÓN

1. Create-only migration
2. Edit migration.sql
3. Deploy migration
4. Generate Prisma Client
5. Run verification queries
6. Test API
7. Build
8. Commit

**Duración estimada:** 10-15 minutos  
**Riesgo:** BAJO (solo ADD COLUMN, sin drop/alter de datos)  
**Rollback:** Posible en cualquier momento con SQL DROP

---

## 📚 REFERENCIAS

- [Prisma Migrate - Manual Migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/add-a-new-field-to-an-existing-table)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Prisma Schema - String Types](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#string)

---

**Creado:** 2026-08-05  
**Para:** Software Architecture Expert  
**Contexto:** INCREMENTO 4 Sesión 3 - Notificaciones UI + Cron + E2E Tests
