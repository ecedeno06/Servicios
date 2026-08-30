# Guía: Desarrollo 100% local (BackEnd + Postgres propio) sin afectar producción

Fecha: 2026-08-27
Objetivo: que el FrontEnd y el BackEnd corran en tu máquina/red local y se
conecten a la base de datos Postgres en `192.168.0.29`, sin tocar ni
arriesgar el backend que hoy está desplegado en Render (que usa Supabase).

## 1. Cómo está conectado el proyecto hoy

- **BackEnd** ([db.js](BackEnd/src/config/db.js)): usa `pg.Pool` con
  `connectionString: process.env.DATABASE_URL` y
  `ssl: { rejectUnauthorized: false }` **hardcodeado** (necesario para
  Supabase, que exige SSL). No hay archivo `.env` en el proyecto — hoy esas
  variables solo existen configuradas del lado de Render.
- **FrontEnd**: [environment.ts](FrontEnd/src/environments/environment.ts)
  (el que usa `ng serve` por defecto) ya apunta directamente al backend de
  producción: `apiUrl: 'https://servicioshoras.onrender.com/api'`.
  [environment.prod.ts](FrontEnd/src/environments/environment.prod.ts)
  existe pero tiene un placeholder (`TU-BACKEND-DESPLEGADO.com`) sin
  terminar de configurar.
- **Hallazgo importante**: en [angular.json](FrontEnd/angular.json) el
  `architect.build.configurations.production` **no tiene `fileReplacements`
  configurado**. Eso significa que, tal como está el proyecto, Angular
  **nunca** cambia automáticamente de `environment.ts` a
  `environment.prod.ts` — ni en `ng serve` ni en un build de producción.
  Hoy "funciona" solo porque `environment.ts` ya trae la URL de Render
  escrita a mano. Si en el futuro cambias `environment.ts` para
  desarrollo local y luego alguien hace un build de producción sin arreglar
  esto, el build de producción también apuntaría a `localhost`. Ver la
  sección 3.2 para la forma segura de resolverlo.
- **No hay `git`/`.gitignore` en este directorio de trabajo** (se verificó
  que no existe ni `.git` ni `.gitignore` en ningún nivel del proyecto).
  Esto es bueno en el sentido de que ningún cambio que hagas aquí se
  sincroniza solo a producción, pero también significa que si más adelante
  conectas este folder a un repositorio, hay que crear un `.gitignore`
  antes de commitear cualquier `.env` con credenciales (ver 3.3).

## 2. Backend local → Postgres en `192.168.0.29`

### 2.1 Requisitos de red/Postgres del lado del servidor `192.168.0.29`

Antes de tocar el código, confirma que ese Postgres acepta conexiones
remotas desde tu máquina de desarrollo:

1. **`postgresql.conf`** (en el servidor 192.168.0.29): `listen_addresses`
   debe incluir la IP de esa máquina o `'*'` (no `localhost` solamente).
2. **`pg_hba.conf`**: debe tener una línea que permita la IP/subred de tu
   máquina de desarrollo, ej.:
   ```
   host    all    all    192.168.0.0/24    scram-sha-256
   ```
   (ajusta el método de autenticación al que ya use ese servidor).
3. **Firewall**: puerto `5432` (o el que use esa instancia) abierto hacia
   tu subred.
4. **Prueba de conectividad** desde tu máquina, antes de tocar el backend:
   ```powershell
   Test-NetConnection -ComputerName 192.168.0.29 -Port 5432
   psql "postgresql://usuario:password@192.168.0.29:5432/nombre_bd" -c "select 1;"
   ```

### 2.2 Cargar el esquema en esa base (si aún no existe)

El esquema del proyecto está en
[schema.sql](BackEnd/database/schema.sql) (tablas `usuarios`, `clientes`,
`tipos_servicio`, `contratos`, `contrato_servicios`, `registro_horas`,
vista `vista_consumo_horas`). Si la base en `192.168.0.29` está vacía,
ejecútalo una sola vez:

```bash
psql "postgresql://usuario:password@192.168.0.29:5432/nombre_bd" -f BackEnd/database/schema.sql
```

### 2.3 Crear `BackEnd/.env` (nuevo archivo, solo local)

El proyecto ya usa `dotenv` ([server.js](BackEnd/src/server.js) llama
`require('dotenv').config()`), pero no existe ningún `.env` en el repo hoy
— hay que crearlo:

```env
# BackEnd/.env  (NO subir a git / NO es el mismo que usa Render)
DATABASE_URL=postgresql://usuario:password@192.168.0.29:5432/nombre_bd
DB_SSL=false
PORT=3000
JWT_SECRET=pon-aqui-un-secreto-local-cualquiera
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:4200
```

### 2.4 Hacer que el SSL sea configurable en `db.js`

Hoy [db.js](BackEnd/src/config/db.js) fuerza SSL siempre (`ssl: {
rejectUnauthorized: false }`), porque Supabase lo exige. Un Postgres local
en `192.168.0.29` normalmente **no** tiene SSL habilitado, así que con la
configuración actual la conexión fallaría. Hay que hacerlo condicional por
variable de entorno, para que el mismo código sirva para ambos casos
(local sin SSL y Render/Supabase con SSL) sin tener que tocar código al
cambiar de entorno:

```js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});
```

Con `DB_SSL=false` en tu `.env` local, la conexión al Postgres de
`192.168.0.29` va sin SSL; en Render, como esa variable no existiría (o se
deja en `true`), se sigue comportando exactamente igual que hoy.

### 2.5 Levantar el backend local

```bash
cd BackEnd
npm install         # si no lo habías corrido en esta copia
npm run dev          # nodemon, recarga automática, lee BackEnd/.env
```

Debe quedar escuchando en `http://localhost:3000` (o el `PORT` que hayas
puesto), y `GET http://localhost:3000/health` debe responder
`{ ok: true, ... }`.

## 3. Frontend → apuntar al backend local

### 3.1 Opción rápida (para probar ya, con riesgo si te olvidas de revertir)

Editar temporalmente
[environment.ts](FrontEnd/src/environments/environment.ts):

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
};
```

Como se explicó en la sección 1, este archivo es el que usa tanto
`ng serve` como (por la falta de `fileReplacements`) cualquier build de
producción que se haga desde este mismo proyecto. Si usas esta opción,
**recuerda revertir el valor a la URL de Render antes de generar o subir
cualquier build de producción**, o mejor, usa la opción 3.2.

### 3.2 Opción recomendada: arreglar los entornos de Angular correctamente

Esto resuelve el hallazgo de la sección 1 de una vez, y elimina el riesgo
de "olvidarte de revertir":

1. Dejar `environment.ts` (desarrollo) apuntando siempre a local:
   ```ts
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:3000/api',
   };
   ```
2. Completar `environment.prod.ts` con la URL real de Render:
   ```ts
   export const environment = {
     production: true,
     apiUrl: 'https://servicioshoras.onrender.com/api',
   };
   ```
3. Agregar `fileReplacements` en
   [angular.json](FrontEnd/angular.json), dentro de
   `architect.build.configurations.production`:
   ```json
   "production": {
     "fileReplacements": [
       { "replace": "src/environments/environment.ts", "with": "src/environments/environment.prod.ts" }
     ],
     "budgets": [ ... ],
     "outputHashing": "all"
   }
   ```

Con esto: `ng serve` (desarrollo, por defecto) siempre habla con tu backend
local; `ng build --configuration production` siempre reemplaza el archivo
y apunta a Render, sin depender de que alguien recuerde cambiar una URL a
mano. **Importante**: antes de aplicar este cambio, confirma cómo se
construye/despliega hoy el frontend de producción (qué comando de build
corre esa plataforma) para asegurarte de que use `--configuration
production` — si no lo usa, este cambio no tendría efecto ahí y seguiría
haciendo falta coordinarlo con quien administra ese despliegue.

### 3.3 Levantar el frontend local

```bash
cd FrontEnd
npm install
ng serve
```

Con el `CORS_ORIGIN=http://localhost:4200` del `.env` del backend (2.3),
las peticiones desde `http://localhost:4200` al backend en
`http://localhost:3000` quedan permitidas.

## 3.4 Evitar que esto contamine producción

- Las variables de entorno de Render (`DATABASE_URL` de Supabase, etc.) se
  configuran en el dashboard de Render, **no** en un archivo del repo —
  crear/editar `BackEnd/.env` localmente no las toca ni las sobreescribe.
- Si en algún momento conectas este proyecto a un repositorio Git,
  **crea un `.gitignore` con `.env`** antes del primer commit — hoy no
  existe ninguno en el proyecto, así que no hay barrera automática que
  impida subir credenciales por accidente.
- El cambio de `db.js` (2.4) es seguro para producción porque es
  retro-compatible: si `DB_SSL` no está definida (como en Render), el
  comportamiento es idéntico al actual (`ssl: { rejectUnauthorized:
  false }`).
- Si adoptas la opción 3.2, un build de producción sigue apuntando a
  Render automáticamente; si usas la opción 3.1 (rápida), el riesgo real
  es solo olvidarte de revertir `environment.ts` antes de un build/deploy
  de producción.

## 4. Checklist resumido

1. Confirmar acceso de red al Postgres en `192.168.0.29` (firewall,
   `pg_hba.conf`, `listen_addresses`).
2. Cargar `schema.sql` en esa base si todavía no tiene las tablas.
3. Crear `BackEnd/.env` con `DATABASE_URL` apuntando a `192.168.0.29` y
   `DB_SSL=false`.
4. Ajustar `db.js` para que el SSL dependa de `DB_SSL` (código en 2.4).
5. `npm run dev` en `BackEnd/`.
6. Ajustar `environment.ts` del FrontEnd a `http://localhost:3000/api`
   (opción rápida 3.1) o arreglar `fileReplacements` +
   `environment.prod.ts` (opción recomendada 3.2).
7. `ng serve` en `FrontEnd/`.
8. Verificar login/listados contra la base local antes de dar por
   terminada la migración de ese flujo de trabajo.

## 5. Problemas comunes

- **`ECONNREFUSED` o timeout al conectar**: casi siempre es
  `pg_hba.conf`/`listen_addresses`/firewall en `192.168.0.29`, no el
  código del backend.
- **`no encryption` / error de SSL**: falta poner `DB_SSL=false` en el
  `.env` local, o el cambio de 2.4 no se aplicó.
- **CORS bloqueado en el navegador**: revisar `CORS_ORIGIN` en el `.env`
  del backend — debe coincidir exactamente con el origen desde el que
  sirve `ng serve` (por defecto `http://localhost:4200`).
- **El frontend sigue mostrando datos de producción**: revisar que
  `environment.ts` realmente tenga la URL local y que el navegador no esté
  sirviendo una build vieja desde caché (hard refresh).
