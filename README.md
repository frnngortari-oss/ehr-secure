# EHR Secure (Next.js + Prisma + PostgreSQL)

Sistema de historias clinicas con:
- autenticacion por roles (`ADMIN`, `MEDICO`, `RECEPCION`)
- pacientes, agenda del dia, evoluciones y auditoria
- agenda con calendario mensual + grilla por hora para cargar turnos
- dashboard KPI (`/kpi`) con metricas de turnos, problemas y motivos de consulta
- menu lateral con iconos y vista responsive para celular/tablet
- descarga de backup desde panel admin

## Requisitos
- Node.js 20+
- PostgreSQL (Neon recomendado)

## Instalacion
```bash
npm install
cp .env.example .env
```

Configura en `.env`:
- `DATABASE_URL` (Neon pooler)
- `DIRECT_URL` (Neon direct)
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
- Entrar como `ADMIN`
- Abrir `/admin/offline`
- Click en `Descargar backup`
