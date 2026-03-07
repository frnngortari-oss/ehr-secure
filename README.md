# EHR Secure (Next.js + Prisma + PostgreSQL)

Sistema de historias clinicas con:
- autenticacion por roles (`ADMIN`, `MEDICO`, `RECEPCION`)
- pacientes, agenda del dia, evoluciones y auditoria
- backup e importacion desde UI admin
- modo offline con PostgreSQL local

## Requisitos
- Node.js 20+
- PostgreSQL (Neon para nube, opcional PostgreSQL local para offline)
- PostgreSQL client tools (`pg_dump`, `pg_restore`) para sincronizacion offline

## Instalacion
```bash
npm install
cp .env.example .env
```

Configura en `.env`:
- `DATABASE_URL` (Neon pooler)
- `DIRECT_URL` (Neon direct)
- `LOCAL_DATABASE_URL` (PostgreSQL local)
- `AUTH_SECRET` (minimo 16 chars)

## Base de datos
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

## Ejecutar
```bash
npm run dev
```

## Usuarios seed
- `Fgortariadmin` / `Qwerty"852963`
- `Fgortari` / `Qwerty"852963`
- `recepcion@ehr.local` / `Recepcion123!`

## Backup desde web
Ruta admin: `/admin/offline`

- `Descargar backup JSON`: baja una copia completa
- `Importar backup`: restaura una copia (reemplaza toda la base)

## Offline en tu PC
1. Sincronizar Neon -> local:
```bash
npm run offline:sync
```

2. Levantar app usando base local:
```bash
npm run offline:dev
```

Cuando vuelvas a tener internet, vuelve a usar `npm run dev` normal.
