# Finanzas del Hogar

Sistema de control de finanzas personales y del hogar. Next.js 16, Prisma, PostgreSQL, Tailwind CSS.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| ORM | Prisma 7 |
| Base de datos | PostgreSQL |
| Autenticación | NextAuth.js v4 (JWT + Credentials) |
| Formularios | React Hook Form + Zod |
| Tablas | TanStack Table v8 |
| Gráficas | Recharts |

## Instalación local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Variables de entorno
```bash
cp .env.example .env
```
Edita `.env` con tu cadena de conexión PostgreSQL:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/finanzas_hogar"
NEXTAUTH_SECRET="genera-con: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Crear base de datos y aplicar schema
```bash
psql -U postgres -c "CREATE DATABASE finanzas_hogar;"
npm run db:push
npm run db:generate
```

### 4. Poblar con datos de ejemplo
```bash
npm run db:seed
```

### 5. Levantar el servidor
```bash
npm run dev
```

## Credenciales de acceso (demo)

| Rol | Email | Password |
|---|---|---|
| Admin | admin@hogar.com | admin123 |
| Editor | editor@hogar.com | editor123 |
| Viewer | viewer@hogar.com | viewer123 |

## Scripts

```bash
npm run dev           # Desarrollo
npm run build         # Build producción
npm run db:push       # Sync schema sin migraciones
npm run db:migrate    # Crear migraciones
npm run db:seed       # Poblar datos de ejemplo
npm run db:studio     # Prisma Studio (GUI DB)
npm run db:generate   # Regenerar cliente Prisma
```

## Despliegue en Vercel

1. Push a GitHub
2. Importar en vercel.com
3. Crear Postgres en Vercel Storage
4. Agregar variables de entorno: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
5. Después del deploy: `npm run db:push && npm run db:seed`

Para comprobantes en producción, instala `@vercel/blob` y actualiza `/src/app/api/upload/route.ts`.

## Permisos por rol

| Acción | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Ver/crear/editar pagos | ✅ | ✅ | ver |
| Eliminar pagos | ✅ | ❌ | ❌ |
| Ver/crear/editar despensa | ✅ | ✅ | ver |
| Gestionar categorías | ✅ | ✅ | ver |
| Gestionar usuarios | ✅ | ❌ | ❌ |
