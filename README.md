# entrenamientos-app

App personal de registro de entrenamientos (estilo Strong) para la preparación física
de oposición de bombero. Importa las fases, días y planes semanales desde
`plantilla_bombero_v9.xlsx` y permite registrar las series reales en cada sesión.

**Stack**: React + Vite + PWA · Supabase (Postgres + Auth) · desplegado en Vercel.
**Coste**: 0 €/mes (free tiers).

---

## 1. Setup local

```bash
cd C:\Users\rafael\dev\entrenamientos-app
npm install      # ya hecho
```

Crea un archivo `.env.local` a partir de `.env.example` (ver paso 2 para los valores).

```bash
npm run dev      # abre http://localhost:5173
```

---

## 2. Supabase (una vez)

1. Entra en <https://supabase.com/dashboard> con tu cuenta de GitHub/Apple.
2. **New project** → nombre `entrenamientos`, región más cercana (EU-West-2/3),
   contraseña fuerte para la DB. Tarda ~2 min en aprovisionarse.
3. Una vez listo:
   - En **Settings → API** copia `Project URL` y `anon public`. Pégalos en `.env.local`
     como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
   - En **Settings → API → Service role (secret)** copia ese token. Va en `.env.local` como
     `SUPABASE_SERVICE_ROLE_KEY` (solo lo usa el script de importación; nunca se envía al frontend).
4. **Aplicar el esquema**:
   - Pestaña **SQL Editor** → *New query* → pega el contenido de
     `supabase/migrations/0001_init.sql` → *Run*.
5. **Auth (magic link)**: en **Authentication → Providers** el provider *Email* viene
   habilitado por defecto. Opcional: personaliza el remitente en **Auth → Email Templates**.
6. **Crear tu usuario**: arranca el frontend (`npm run dev`), introduce tu email en la
   pantalla de login y sigue el enlace del correo. Esto crea la fila en `auth.users`.
7. **Obtener tu user id**: en Supabase ve a **Authentication → Users**, abre tu usuario,
   copia el UUID. Pégalo en `.env.local` como `IMPORT_USER_ID`.

---

## 3. Importar el Excel

```bash
npx tsx scripts/import-to-supabase.ts "G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx"
```

El script:

- Lee las 4 pestañas `F1_HIPERTROFIA`, `F2_TRANSICION`, `F3_ESPECIALIZ`, `F4_PUESTA_PUNTO`.
- Upsertea ~100 ejercicios únicos en `exercises`.
- Crea fases, días (LUN/MIÉ/VIE/SÁB), ejercicios planificados y plan semanal (S1..S26) en Postgres.
- Es idempotente: borra y recrea las fases del usuario en cada ejecución (los ejercicios se conservan por upsert).

Después, recarga `http://localhost:5173` → verás tus fases y días listos.

---

## 4. GitHub + Vercel (deploy en producción)

```bash
gh repo create entrenamientos-app --private --source=. --push
```

Luego:

1. Entra en <https://vercel.com/new> con GitHub.
2. Importa `rafaelrsalinas/entrenamientos-app`.
3. Framework: *Vite* (autodetectado).
4. En **Environment Variables** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. *Deploy*. Tendrás una URL pública tipo `https://entrenamientos-app.vercel.app`.
6. **Redirect URL**: en Supabase → **Authentication → URL Configuration** añade la URL
   de Vercel (y `http://localhost:5173` para desarrollo) a *Redirect URLs*.

---

## 5. Instalar como app en iPhone

1. Abre la URL de Vercel en Safari.
2. Toca el botón *Compartir* → *Añadir a pantalla de inicio*.
3. El icono aparecerá como una app más; al abrirla irá a pantalla completa.

En Mac: mismo proceso desde Chrome/Edge (icono *Instalar app* en la barra de dirección).

---

## 6. Estructura del proyecto

```
entrenamientos-app/
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts          Cliente Supabase
│  │  └─ database.types.ts    Tipos de las tablas
│  ├─ hooks/useAuth.ts
│  ├─ components/SetRow.tsx   Fila editable de una serie
│  ├─ routes/
│  │  ├─ Login.tsx            Magic link
│  │  ├─ Home.tsx             Selector fase + semana + día
│  │  ├─ Session.tsx          Sesión en curso (listar ejercicios · loggear sets)
│  │  └─ History.tsx          Últimas 50 sesiones
│  ├─ App.tsx                 Layout + auth guard
│  ├─ main.tsx                Router
│  └─ index.css
├─ scripts/
│  ├─ parse-workbook.ts       Parser Excel → objetos JS (pure)
│  ├─ parse-cli.ts            CLI: imprime el JSON parseado (debug)
│  ├─ inspect-xlsx.ts         CLI: volcado crudo por hoja (debug)
│  └─ import-to-supabase.ts   Sube los objetos al Postgres del usuario
├─ supabase/migrations/
│  └─ 0001_init.sql           Esquema inicial
├─ public/favicon.svg
├─ vite.config.ts             Incluye vite-plugin-pwa
└─ .env.example
```

### Modelo de datos

```
phases             F1_HIPERTROFIA (s1-26), F2_TRANSICION (s27-52), ...
  └─ workout_days  LUNES LOWER, MIÉ UPPER A, VIE UPPER B, SÁB SPRINT
       └─ planned_exercises   Orden + bloque + pauta + descanso + RIR + notas
            └─ weekly_plan    Valor plan por semana (S1..S26)

workout_sessions   Sesión ejecutada (fase + semana + día + inicio/fin)
  └─ workout_sets  Series logged (peso + reps + RIR/RPE)
```

---

## 7. Próximos pasos (roadmap)

- [ ] Timer de descanso en la pantalla de Session.
- [ ] Gráficos de progresión por ejercicio (recharts ya está instalado).
- [ ] Editor de rutinas desde la app (por ahora solo import Excel).
- [ ] Plantillas de entrada rápida: copiar último peso/reps con un toque.
- [ ] Apple Sign-In (requiere cuenta Apple Developer · de pago).
- [ ] Iconos PNG 192/512 para PWA (actualmente solo SVG favicon).

---

## Scripts útiles

```bash
npm run dev                # desarrollo con HMR
npm run build              # build producción (dist/)
npm run preview            # probar el build

# Debug del Excel
npx tsx scripts/inspect-xlsx.ts "G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx"
npx tsx scripts/parse-cli.ts    "G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx"

# Importar al Supabase del usuario configurado en IMPORT_USER_ID
npx tsx scripts/import-to-supabase.ts
```
