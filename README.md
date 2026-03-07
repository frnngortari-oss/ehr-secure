# EHR Secure (Next.js + Prisma + PostgreSQL)

Sistema base de historias clinicas con:
- Autenticacion por roles (`ADMIN`, `MEDICO`, `RECEPCION`)
- Alta, edicion y listado de pacientes
- Busqueda avanzada de pacientes
- Agenda del dia con filtros y estados de turno
- Carga de evoluciones clinicas con problema asociado
- Auditoria de cambios persistida en base de datos

## 1) Requisitos
- Node.js 20+
- PostgreSQL (Neon recomendado)

## 2) Instalacion
```bash
npm install
cp .env.example .env
```

Configurar `.env`:
- `DATABASE_URL=...`
- `AUTH_SECRET=...` (minimo 16 caracteres)

## 3) Base de datos
```bash
npm run prisma:generate
npm run prisma:migrate -- --name auth_roles_audit
npm run prisma:seed
```

## 4) Ejecutar
```bash
npm run dev
```

Abrir: `http://localhost:3000`

## 5) Usuarios demo (seed)
- `admin@ehr.local` / `Admin123!`
- `medico@ehr.local` / `Medico123!`
- `recepcion@ehr.local` / `Recepcion123!`

## 6) Permisos
- `ADMIN`: acceso total + vista de auditoria (`/audit`)
- `MEDICO`: ver pacientes y cargar evoluciones
- `RECEPCION`: alta/edicion de pacientes
