# Análisis: Soporte Multicompañía (Multi-tenant)

Fecha: 2026-08-27
Alcance: BackEnd (Node.js/Express + PostgreSQL) y FrontEnd (Angular)

## 1. Estado actual

La aplicación es **mono-tenant**: no existe ningún concepto de "empresa" en el
modelo de datos, en el backend ni en el frontend. Todo lo que hay en la base
de datos (usuarios, clientes, tipos de servicio, contratos, registro de
horas) pertenece implícitamente a una sola organización.

Resumen de la arquitectura relevante:

- **BackEnd/database/schema.sql**: tablas `usuarios`, `clientes`,
  `tipos_servicio`, `contratos`, `contrato_servicios`, `registro_horas` y la
  vista `vista_consumo_horas`. Ninguna tiene columna de tenant.
- **BackEnd/src/middleware/auth.js**: el JWT solo lleva
  `{ id, nombre, email, rol }`. `requireRol` solo valida rol, no organización.
- **BackEnd/src/controllers/*.controller.js**: todos los `SELECT/INSERT/
  UPDATE/DELETE` son globales (no filtran por ningún tenant). Ej.:
  `clientes.controller.js`, `contratos.controller.js`,
  `registroHoras.controller.js`, `usuarios.controller.js`,
  `tiposServicio.controller.js`. Además, la función `eliminar()` de los
  cinco controladores hace hoy un `delete from <tabla> where id = $1`
  **físico** — no hay eliminación lógica en ningún lado del sistema.
- **FrontEnd/src/app/core/models/models.ts**: interfaces sin `empresa_id`.
- **FrontEnd/src/app/core/services/auth.service.ts**: guarda `usuario` y
  `token` en `localStorage`, sin noción de empresa activa.

Es decir, para llegar a multicompañía hay que tocar **las cuatro capas**: BD,
autenticación, controladores/rutas, y frontend (modelos, servicios, guards y
alguna pantalla de administración).

## 2. Decisión de estrategia

Hay tres estrategias típicas de multi-tenancy:

| Estrategia | Descripción | Aptitud para este proyecto |
|---|---|---|
| **A. Columna `empresa_id` compartida** (row-level) | Todas las empresas comparten las mismas tablas; cada fila lleva `empresa_id`. | ✅ Recomendada. Cambios acotados, un solo esquema que mantener, encaja con el pool de conexión único que ya existe (`db.js`), fácil de migrar sin downtime largo. |
| **B. Esquema por tenant** (`schema` de Postgres por empresa) | Cada empresa tiene su propio `schema`. | Más aislamiento, pero mucho más complejo de mantener (migraciones × N esquemas, pool de conexiones dinámico). Sobredimensionado para el tamaño actual del proyecto. |
| **C. Base de datos por tenant** | Una BD física por empresa. | Solo se justifica con requisitos fuertes de aislamiento/compliance o de escalado por cliente. No aplica aquí. |

**Recomendación: Estrategia A (row-level multi-tenancy con `empresa_id`)**,
reforzada con Row Level Security (RLS) de Postgres como red de seguridad
adicional a nivel de base de datos (el propio `schema.sql` ya deja una nota
de que hoy RLS está deshabilitado porque el control de acceso vive en la
API — con multicompañía conviene activarlo).

## 3. Cambios en base de datos (`schema.sql`)

### 3.1 Nueva tabla `empresas`

```sql
create table if not exists empresas (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    identificacion  text unique,          -- RUC / NIT / Cedula juridica de la empresa
    email           text,
    telefono        text,
    direccion       text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
```

### 3.2 Agregar `empresa_id` a las tablas existentes (excepto `usuarios`)

**Decisión confirmada:** `usuarios` es una tabla **global**, no pertenece a
una única empresa. Un mismo usuario (misma fila, mismo `id`, mismo email)
puede estar asociado a varias empresas, incluso con roles distintos en cada
una. Por lo tanto `usuarios` **no** recibe columna `empresa_id`.

Sí reciben `empresa_id uuid not null references empresas(id)` (porque son
entidades que sí pertenecen a una sola empresa):

- `clientes`
- `tipos_servicio`
- `contratos`
- `registro_horas`

`contrato_servicios` no necesita columna propia: hereda el tenant a través de
`contrato_id` (pero conviene validar en el backend que `contrato_id` y
`tipo_servicio_id` pertenezcan a la misma `empresa_id`).

### 3.2.1 Nueva tabla intermedia `usuarios_empresas_rol`

Reemplaza la columna `usuarios.rol` actual (que hoy es un atributo único y
global del usuario) por una relación N:M entre `usuarios` y `empresas`,
donde el **rol es por empresa** (el mismo usuario puede ser `admin` en la
Empresa A y `tecnico` en la Empresa B):

```sql
create table if not exists usuarios_empresas_rol (
    id              uuid primary key default gen_random_uuid(),
    usuario_id      uuid not null references usuarios(id) on delete cascade,
    empresa_id      uuid not null references empresas(id) on delete cascade,
    rol             text not null check (rol in ('admin', 'supervisor', 'tecnico')) default 'tecnico',
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (usuario_id, empresa_id)
);

create index if not exists idx_usuarios_empresas_rol_usuario on usuarios_empresas_rol(usuario_id);
create index if not exists idx_usuarios_empresas_rol_empresa on usuarios_empresas_rol(empresa_id);
```

Consecuencias de este cambio de modelo:

- La columna `usuarios.rol` y su `check` (`'admin' | 'supervisor' |
  'tecnico'`) se **eliminan** de `usuarios`; el rol vive únicamente en
  `usuarios_empresas_rol`.
- Todas las columnas de `registro_horas.usuario_id`, y cualquier `join`
  contra `usuarios`, siguen funcionando igual (siguen apuntando al mismo
  `usuarios.id` global) — lo único que cambia es de dónde sale el **rol**.
- `req.usuario.rol` ya no puede leerse de una columna fija de `usuarios`:
  se deriva de la fila de `usuarios_empresas_rol` correspondiente a
  `(usuario_id, empresa_activa_id)` — ver 4.1 y 4.4.
- Dar de baja a un usuario de una empresa puntual ya no es "borrar el
  usuario": es poner `activo = false` en su fila de
  `usuarios_empresas_rol` para esa empresa (nunca un `delete` físico, ver
  3.8). El usuario sigue existiendo globalmente y conservando su acceso a
  otras empresas.

### 3.3 Ajustar restricciones `unique`

- `usuarios.email` → se **mantiene única globalmente** (`unique (email)`,
  como ya está hoy), porque `usuarios` es una tabla global: el email
  identifica a la persona en todo el sistema, no por empresa.
- `usuarios_empresas_rol` → `unique (usuario_id, empresa_id)` (ver 3.2.1),
  para que un usuario no pueda tener dos roles distintos simultáneos en la
  misma empresa.
- `clientes.identificacion` → `unique (empresa_id, identificacion)`
- `tipos_servicio.nombre` → `unique (empresa_id, nombre)`
- `contratos.numero_contrato` → `unique (empresa_id, numero_contrato)`

### 3.4 Índices

Agregar índice sobre `empresa_id` en cada tabla nueva-columna (y
idealmente índices compuestos `(empresa_id, <fecha/estado>)` en las tablas
más consultadas: `contratos`, `registro_horas`).

### 3.5 Vista `vista_consumo_horas`

Debe propagar `empresa_id` (tomarlo de `c.empresa_id`, ya que `contratos`
es la tabla ancla) para poder filtrar el reporte por tenant.

### 3.6 Row Level Security (recomendado)

Activar RLS en las tablas con `empresa_id` y crear policies del tipo:

```sql
alter table clientes enable row level security;
create policy clientes_tenant_isolation on clientes
  using (empresa_id = current_setting('app.empresa_id')::uuid);
```

El backend tendría que hacer `set_config('app.empresa_id', ..., true)` al
inicio de cada request/transacción (usando el `pool` de `db.js`). Esto es
una capa de defensa en profundidad: aunque un controlador se olvide del
`WHERE empresa_id = ...`, la base de datos igual bloquea el cruce de datos
entre empresas.

### 3.7 Datos existentes (migración)

Como hoy no existe el concepto de empresa, la migración debe:

1. Crear una empresa "por defecto" (la organización actual).
2. Poblar `empresa_id` de todas las filas existentes de `clientes`,
   `tipos_servicio`, `contratos` y `registro_horas` con el id de esa
   empresa por defecto.
3. Para `usuarios`: por cada usuario existente, insertar una fila en
   `usuarios_empresas_rol (usuario_id, empresa_id, rol)` usando la empresa
   por defecto y el valor que hoy tiene `usuarios.rol`.
4. Recién después: aplicar `not null` y las restricciones `unique`
   compuestas en `clientes`/`tipos_servicio`/`contratos`/`registro_horas`,
   y eliminar la columna `usuarios.rol` (ya migrada al paso 3).

### 3.8 Eliminación lógica (soft delete) en lugar de borrado físico

**Decisión confirmada:** ningún endpoint debe borrar filas físicamente
(`delete from ...`). Todo "eliminar" pasa a ser un `update` que marca la
fila como inactiva/eliminada. Esto es aún más importante con
multicompañía porque:

- Preserva el historial para auditoría y reportes (`vista_consumo_horas`,
  horas ya ejecutadas, contratos vencidos) incluso si un cliente, contrato
  o tipo de servicio se da de baja.
- Evita que un `delete` en cascada (`on delete cascade` en
  `contrato_servicios`/`registro_horas`) borre sin querer el historial de
  ejecución de un contrato de una empresa por una acción hecha en otra
  parte del árbol.
- Es el mismo patrón que ya usa el proyecto hoy para `usuarios`,
  `clientes` y `tipos_servicio` (las tres ya tienen columna `activo`) —
  el problema es que sus controladores **no la usan** para `eliminar()`,
  hacen `delete` físico igual. Con multicompañía conviene corregir esto de
  una vez y extenderlo a las tablas que todavía no tienen el campo.

Cambios de esquema necesarios:

- `contratos`: agregar `activo boolean not null default true`. Se
  mantiene **separado** de la columna `estado`
  (`activo|vencido|cancelado|finalizado`), porque son conceptos distintos:
  `estado` es el ciclo de vida del negocio, `activo` es si el registro
  sigue existiendo en el sistema. Un contrato `finalizado` sigue teniendo
  `activo = true` hasta que alguien decida borrarlo.
- `registro_horas`: agregar `activo boolean not null default true` (hoy no
  tiene ninguna columna de este tipo).
- `contrato_servicios`: agregar `activo boolean not null default true`
  (hoy tampoco la tiene) — así "quitar una bolsa de horas de un contrato"
  no destruye la validación histórica de los registros de horas que ya se
  cargaron contra esa bolsa.
- `empresas` y `usuarios_empresas_rol` (tablas nuevas, 3.1 y 3.2.1) ya se
  definieron con `activo boolean not null default true` desde el inicio.

Cambios de comportamiento que esto implica:

- **Todo `listar()`/`obtener()`** debe agregar `where activo = true` (o
  `and activo = true` si ya hay otros filtros) por defecto. Si se necesita
  ver inactivos (ej. una pantalla de "papelera" o auditoría para
  super-admin), debe ser explícito vía un query param (`?incluirInactivos=true`),
  nunca el comportamiento por defecto.
- **`eliminar()`** en los cinco controladores existentes
  (`clientes`, `contratos`, `tipos_servicio`, `registro_horas`,
  `usuarios`/`usuarios_empresas_rol`) deja de hacer `delete from ...` y
  pasa a hacer `update <tabla> set activo = false where id = $1 and
  empresa_id = $2 returning *` (para `usuarios_empresas_rol` el filtro es
  `usuario_id = $1 and empresa_id = $2`, ver 4.2). Se recomienda devolver
  `200` con la fila actualizada en vez de `204 No Content`, para que el
  frontend pueda reflejar el cambio sin otro round-trip.
- **`vista_consumo_horas`** debe filtrar `rh.activo` al sumar horas
  ejecutadas (`left join registro_horas rh on ... and rh.activo`), para
  que un registro de horas dado de baja lógicamente no siga consumiendo la
  bolsa de horas contratadas.
- **Restricciones `unique`** (3.3) deben convertirse en **índices únicos
  parciales** (`where activo`) en vez de `unique` de tabla completa, para
  que un valor "liberado" por una baja lógica se pueda reutilizar en un
  registro nuevo. Ejemplo:

```sql
create unique index if not exists uq_clientes_empresa_identificacion
  on clientes (empresa_id, identificacion) where activo;

create unique index if not exists uq_contratos_empresa_numero
  on contratos (empresa_id, numero_contrato) where activo;

create unique index if not exists uq_tipos_servicio_empresa_nombre
  on tipos_servicio (empresa_id, nombre) where activo;
```

  `usuarios.email` es un caso distinto: al ser el identificador de acceso
  de una persona real, normalmente **no** conviene liberarlo al dar de
  baja (para evitar que alguien nuevo se registre con el email de una
  cuenta desactivada y "herede" su historial); se recomienda mantenerlo
  `unique` a nivel de tabla completa, sin condición `where activo`.
  Análogamente, en `usuarios_empresas_rol` una baja lógica debe
  **reactivar** la fila existente (`update ... set activo = true, rol =
  $x`) si el usuario vuelve a ser invitado a la misma empresa, en vez de
  insertar una fila duplicada — así el `unique (usuario_id, empresa_id)`
  puede quedar como restricción normal, sin necesidad de índice parcial.
- Las cláusulas `on delete cascade`/`on delete restrict` del esquema
  (3.2.1) dejan de ser el camino normal de borrado (ya no se ejecutan
  `delete` desde la aplicación) y quedan como una salvaguarda para casos
  excepcionales de purga física de datos (ej. una solicitud legal de
  borrado total), no para el flujo cotidiano de la UI.

## 4. Cambios en el backend

### 4.1 Autenticación y JWT (`auth.controller.js`, `middleware/auth.js`)

Como el rol ahora depende de la empresa activa (`usuarios_empresas_rol`,
3.2.1), el login deja de ser un solo paso que arma el JWT directamente
desde `usuarios`. Flujo propuesto:

1. **`POST /auth/login`** (email + password): valida credenciales contra
   `usuarios` (igual que hoy) y además consulta
   `select empresa_id, rol from usuarios_empresas_rol where usuario_id = $1 and activo = true`.
   - Si el usuario tiene **una sola empresa activa** → arma el JWT
     directamente con esa `empresa_id`/`rol` (no hace falta un paso extra,
     mantiene la UX actual para el caso común).
   - Si tiene **más de una empresa** → devuelve una respuesta intermedia
     (sin token final, o con un token "parcial") con la lista de empresas
     a las que pertenece, para que el frontend muestre un selector.
   - Si no tiene **ninguna** empresa activa (y no es `super_admin`, ver
     4.5) → `401`, no puede operar.
2. **`POST /auth/seleccionar-empresa`** (nuevo endpoint, `{ empresa_id }`,
   protegido por el token parcial del paso 1): valida que exista la fila
   `usuarios_empresas_rol(usuario_id, empresa_id, activo=true)` y emite el
   JWT final con `{ id, nombre, email, rol, empresa_id }`.
3. **Cambio de empresa en caliente** (si el usuario ya está logueado y
   quiere cambiar de empresa activa sin volver a poner password): mismo
   endpoint `seleccionar-empresa`, pero aceptando también el JWT completo
   vigente en vez de uno parcial, y devolviendo un JWT nuevo con la
   `empresa_id`/`rol` actualizados.
- `register()` deja de crear siempre un usuario nuevo: primero busca si ya
  existe un usuario global con ese `email`; si existe, solo agrega una fila
  en `usuarios_empresas_rol` para la empresa/rol indicados; si no existe,
  crea el usuario en `usuarios` y luego la fila en `usuarios_empresas_rol`.
  Este endpoint pasa a vivir mejor en `usuarios.controller.js` (ver 4.2)
  que en `auth.controller.js`, ya que es más "alta de usuario en una
  empresa" que "registro de cuenta".
- El middleware `requireAuth` sigue igual (decodifica el JWT), pero ahora
  `req.usuario.rol` y `req.usuario.empresa_id` son válidos **solo para la
  empresa activa** de esa sesión, no un atributo fijo del usuario.
- Nuevo middleware/helper `requireEmpresa` que exponga `req.empresaId =
  req.usuario.empresa_id` para que los controladores de `clientes`,
  `contratos`, `tipos_servicio`, `registro_horas` no cambien su forma de
  uso respecto al diseño original (siguen filtrando por
  `req.empresaId`, sin enterarse de que ahora `usuarios` es global).

### 4.2 Controladores: agregar filtro de tenant en TODAS las queries

Patrón a replicar en `clientes.controller.js`, `contratos.controller.js`,
`registroHoras.controller.js`, `tiposServicio.controller.js`,
`usuarios.controller.js`:

- **listar/obtener**: agregar `where empresa_id = $1` (o `and empresa_id = $n`
  si ya hay otros filtros), usando `req.empresaId`.
- **crear**: incluir `empresa_id` en el `insert` con el valor de
  `req.empresaId` (nunca confiar en un `empresa_id` que venga del body).
- **actualizar**: agregar `and empresa_id = $n` en el `where` para que un
  usuario no pueda modificar registros de otra empresa aunque adivine el
  `id` (UUID).
- **eliminar**: deja de ser `delete from ... where id = $1` y pasa a ser
  `update ... set activo = false where id = $1 and empresa_id = $2
  returning *` (borrado lógico, ver 3.8) — mismo cuidado con el filtro por
  `empresa_id` que en `actualizar`.
- **contratos.controller.js** (`agregarServicio`, `actualizarServicio`,
  `eliminarServicio`) y **registroHoras.controller.js** (`crear`): además
  del filtro por `empresa_id`, validar que `contrato_id` y
  `tipo_servicio_id` pertenezcan a la misma empresa del usuario antes de
  cruzarlos (hoy `crear()` en `registroHoras.controller.js` ya hace un
  `select` de `contrato_servicios` para validar la "bolsa de horas" —
  ese mismo query debe agregar `and c.empresa_id = $x` haciendo join con
  `contratos`).
- **vista_consumo_horas** (`consumoGeneral`, `consumoPorContrato`): agregar
  `where empresa_id = $1`.

`usuarios.controller.js` es un caso aparte porque `usuarios` ya no tiene
`empresa_id` propio (3.2):

- **listar**: en vez de `where empresa_id = $1`, debe hacer
  `join usuarios_empresas_rol uer on uer.usuario_id = u.id` y filtrar por
  `uer.empresa_id = $1 and uer.activo = true`, trayendo también `uer.rol`
  en el `select` (reemplaza al `usuarios.rol` que se elimina).
- **crear**: ver el flujo descrito en 4.1 (buscar por email primero; si no
  existe, crear en `usuarios`; siempre insertar/actualizar la fila en
  `usuarios_empresas_rol` para `req.empresaId`).
- **actualizar**: separar claramente qué se actualiza en `usuarios`
  (`nombre`, `password`, `avatar` — datos de la persona, no de la
  relación) de qué se actualiza en `usuarios_empresas_rol` (`rol`,
  `activo` — datos de la relación con la empresa). Un `PUT
  /usuarios/:id` con `{ rol }` no debe tocar la tabla `usuarios`.
- **eliminar**: por defecto debe interpretarse como "quitar al usuario de
  la empresa activa" — `update usuarios_empresas_rol set activo = false
  where usuario_id = :id and empresa_id = req.empresaId` (borrado lógico,
  nunca `delete`, ver 3.8), y **nunca** tocar la fila de `usuarios`
  (borrarla, aunque fuera lógicamente, afectaría al usuario en todas las
  demás empresas a las que pertenece).

### 4.3 Rutas (`routes/*.js`)

Todas ya pasan por `requireAuth` (`clientes.routes.js`,
`contratos.routes.js`, `registroHoras.routes.js`, `tiposServicio.routes.js`,
`usuarios.routes.js`), así que no requieren cambio de path: basta con que
`requireAuth` (o un middleware nuevo `requireEmpresa` encadenado justo
después) deje `req.empresaId` disponible antes de llegar al controlador.

Un caso particular es `auth.routes.js`: hoy `POST /auth/register` exige rol
`admin` (`requireRol('admin')`) pero es **global**, no por empresa — con
multicompañía debe seguir creando usuarios dentro de la empresa del admin
que hace la petición (`req.empresaId`), nunca con un `empresa_id` que venga
en el body.

Las rutas nuevas de `empresas.routes.js` (alta/edición/baja de empresas) no
deben usar `requireRol('admin')` sino un rol distinto (`super_admin`, ver
4.5), ya que un admin de una empresa no debería poder crear o editar otras
empresas.

### 4.4 Modelo de pertenencia usuario–empresa (confirmado)

**Decisión ya tomada:** `usuarios` es global y un mismo usuario puede
pertenecer a **varias empresas**, cada una con su propio rol, a través de
`usuarios_empresas_rol` (3.2.1). Esto habilita casos como un supervisor o
un técnico que presta servicios para más de una organización cliente del
sistema, sin necesitar una cuenta/login distinta por empresa.

Implicaciones directas para el resto del diseño (ya reflejadas en 4.1 y
4.2):

- El login puede requerir un paso de selección de empresa cuando el
  usuario tiene más de una activa.
- El JWT sigue llevando una sola `empresa_id`/`rol` a la vez — el "tenant
  activo" de la sesión — no la lista completa; la lista completa se pide
  aparte (`GET /auth/mis-empresas` o similar) para poblar el selector.
- El rol (`admin`/`supervisor`/`tecnico`) es un atributo **de la relación**
  usuario-empresa, no de la persona: el mismo usuario puede ser `admin` en
  una empresa y `tecnico` en otra.
- `requireRol(...)` en las rutas no cambia de firma (sigue mirando
  `req.usuario.rol`), porque ese valor ya viene resuelto para la empresa
  activa desde el login/selección de empresa.

### 4.5 Rol "super-admin" / administración de empresas

Se necesita un nivel de acceso por encima de `admin` (que ahora es admin de
una empresa puntual, vía `usuarios_empresas_rol`) para poder:

- Crear/editar/desactivar empresas (`empresas.controller.js` +
  `empresas.routes.js` nuevos).
- Ver/gestionar usuarios a través de empresas (soporte, onboarding de
  nuevos clientes del SaaS).

Con `usuarios` ya global, esto es más simple que en el diseño anterior: al
no depender `usuarios` de `empresa_id`, basta con agregar una columna
booleana **global** a `usuarios`, por ejemplo `es_super_admin boolean not
null default false`, en vez de forzar un rol dentro de
`usuarios_empresas_rol` (que por definición está atado a una empresa). Un
super-admin puede incluso no tener ninguna fila en `usuarios_empresas_rol`
y aun así gestionar todas las empresas.

**Arranque de una empresa nueva (bootstrapping):** una empresa recien
creada no tiene ningun usuario asociado todavia, y la pantalla de
"Usuarios" solo opera sobre la empresa activa de la sesion — por lo que
hace falta poder "entrar" a esa empresa antes de poder darle de alta su
primer usuario real. Por eso:

- `GET /auth/mis-empresas` para un `es_super_admin` devuelve **todas** las
  empresas activas del sistema (no solo las que tiene como membresia real
  en `usuarios_empresas_rol`), con un rol sintetico `admin` para las que
  todavia no tiene membresia.
- `POST /auth/seleccionar-empresa` permite a un `es_super_admin` activar
  cualquier empresa aunque no exista fila en `usuarios_empresas_rol` para
  el, emitiendo el JWT con `rol: 'admin'` para esa sesion. Esto **no**
  crea una fila en `usuarios_empresas_rol` — es acceso de sesion, no una
  membresia persistida. Una vez "adentro", puede usar la pantalla de
  Usuarios normalmente para agregar al primer usuario real, lo cual si
  crea la fila correspondiente.

## 5. Cambios en el frontend (Angular)

### 5.1 Modelos (`core/models/models.ts`)

- Nueva interfaz `Empresa` (espejo de la tabla).
- `Usuario` deja de tener un `rol` fijo como atributo propio de la persona:
  pasa a representar el **rol en la empresa activa** (lo que devuelve el
  login/JWT), y se agrega una interfaz nueva `UsuarioEmpresaRol { usuario_id,
  empresa_id, empresa_nombre, rol, activo }` para listar/administrar las
  empresas de un usuario (pantalla de usuarios y selector de empresa).
- Agregar `empresa_id` a `Cliente`, `TipoServicio`, `Contrato`,
  `RegistroHora` donde aplique (principalmente para mostrarlo en pantallas
  de super-admin; en el uso normal del día a día el filtro es transparente
  porque lo resuelve el backend vía el token). `Usuario` no lleva
  `empresa_id` porque es global.

### 5.2 Autenticación (`auth.service.ts`)

Como un usuario puede pertenecer a varias empresas (4.4), el selector de
empresa activa **no es opcional**: es parte del flujo de login.

- Guardar `empresa_id`/`empresa_nombre`/`rol` (de la empresa activa) junto
  con `usuario` y `token` en el objeto persistido en `localStorage`
  (`STORAGE_KEY = 'hs_auth'`).
- `login()` debe manejar la respuesta intermedia del backend cuando el
  usuario tiene más de una empresa (4.1, paso 1): en ese caso no hay token
  final todavía, y el componente de login debe mostrar un selector de
  empresa antes de continuar.
- Nuevo método `seleccionarEmpresa(empresaId)` que llame a
  `POST /auth/seleccionar-empresa` y complete el login guardando el JWT
  final.
- Un `signal` de "empresa activa" (`empresaActiva`) derivado del usuario
  guardado, para que el resto de la app (layout, guards) sepa en qué
  contexto está operando.
- Un método `cambiarEmpresaActiva(empresaId)` (mismo endpoint que arriba,
  pero con sesión ya iniciada) para cambiar de contexto sin cerrar sesión,
  y un selector visible en el layout (`layout.component.ts`) para
  usuarios con más de una empresa asociada.

### 5.3 Interceptor (`core/interceptors/auth.interceptor.ts`)

No necesita cambios si el tenant viaja embebido en el JWT (recomendado).
Solo si se permite cambiar de empresa sin re-loguear habría que añadir un
header adicional (ej. `X-Empresa-Id`) — pero es más seguro mantener el
tenant derivado del JWT en el backend y no de un header que el cliente
podría manipular.

### 5.4 Guards (`core/guards/auth.guard.ts`)

Hoy `app.routes.ts` solo tiene `authGuard` (verifica que haya sesión, no
verifica rol); la protección por rol existe únicamente del lado del
backend (`requireRol` en las rutas) y de forma visual en el frontend vía
`auth.service.puedeEditar()/puedeEliminar()` (botones que se ocultan, pero
la ruta sigue siendo navegable). Para la pantalla nueva de empresas hace
falta un guard **nuevo** —no existe uno de rol hoy—, ej. `superAdminGuard`,
que se agregue a `app.routes.ts` en la ruta `empresas` para bloquear la
navegación directa de usuarios sin ese rol, no solo ocultar el botón.

### 5.5 Nueva pantalla de administración

Un feature `features/empresas/empresas.component.ts` (solo visible para
`super_admin`) con CRUD de empresas, similar en estructura a
`features/clientes/clientes.component.ts`.

### 5.6 Pantallas existentes

`clientes`, `contratos`, `tipos-servicio` y `horas` **no requieren cambios
visibles**: el filtrado por empresa ocurre en el backend de forma
transparente vía el token.

`usuarios.component.ts` sí cambia: al crear un usuario debe permitir
buscar por email un usuario ya existente en el sistema (para solo
asociarlo con un rol a la empresa activa) en vez de asumir siempre "usuario
nuevo"; y la edición de rol/baja debe dejar claro que aplica **a la
empresa activa**, no a la cuenta global de la persona.

El layout (`layout.component.ts`) necesita el selector de "empresa activa"
mencionado en 5.2, visible para cualquier usuario con más de una empresa
asociada (no solo para super-admin).

## 6. Plan de implementación sugerido (por fases)

1. **Fase 1 — Base de datos**: crear tabla `empresas` y
   `usuarios_empresas_rol`, agregar `empresa_id` a `clientes`/
   `tipos_servicio`/`contratos`/`registro_horas`, agregar `activo` a
   `contratos`/`registro_horas`/`contrato_servicios` para soportar borrado
   lógico (3.8), migrar datos existentes a una "empresa por defecto"
   (incluye backfill de `usuarios_empresas_rol` desde `usuarios.rol`),
   convertir los `unique` compuestos en índices únicos parciales
   (`where activo`), eliminar `usuarios.rol`, actualizar la vista
   `vista_consumo_horas` para filtrar por `activo`, agregar índices y
   (opcional pero recomendado) RLS.
2. **Fase 2 — Backend**: flujo de login con selección de empresa
   (`POST /auth/seleccionar-empresa`), middleware de tenant, filtro
   `empresa_id` en los controladores empresa-scoped, cambiar todos los
   `eliminar()` de `delete from` a `update ... set activo = false`
   (3.8), agregar `where activo = true` por defecto en `listar`/
   `obtener`, rediseño de `usuarios.controller.js` sobre
   `usuarios_empresas_rol`, nuevo CRUD de `empresas`, columna
   `es_super_admin`.
3. **Fase 3 — Frontend**: modelos (`Empresa`, `UsuarioEmpresaRol`),
   `auth.service` con selector de empresa activa, pantalla de gestión de
   empresas, guard de super-admin, ajustes en `usuarios.component.ts`.
4. **Fase 4 — Pruebas de aislamiento**: verificar explícitamente que un
   usuario de la Empresa A no puede leer/editar/borrar datos de la Empresa
   B ni por API directa (ids adivinados) ni por UI, y que un usuario con
   acceso a A y B ve exactamente los datos de la empresa que tiene activa
   en cada momento.
5. **Fase 5 — Despliegue**: ejecutar migración de datos en producción
   dentro de una ventana controlada (crear empresa por defecto, backfill
   de `empresa_id` y de `usuarios_empresas_rol`, luego aplicar
   `not null`/`unique` compuestos y eliminar `usuarios.rol`).

## 7. Riesgos y puntos de atención

- **Fugas de datos entre empresas** si algún controlador queda sin el
  filtro `empresa_id` — por eso se recomienda RLS como segunda barrera,
  no solo confiar en el código de aplicación.
- **IDs adivinables por URL**: como todos los ids son UUID, el riesgo de
  enumeración es bajo, pero igual hay que filtrar por `empresa_id` en
  `update` (incluida la baja lógica, que también es un `update`), no solo
  en `select`, para no depender únicamente de la imposibilidad de adivinar
  el UUID.
- **Migración de datos existentes** sin downtime prolongado: agregar
  columnas como nullable primero, poblarlas, y solo después poner
  `not null`/`unique` compuestos.
- **Borrado lógico olvidado en algún endpoint**: si alguien agrega un
  endpoint nuevo (o un script de mantenimiento) que haga `delete from ...`
  directo, se pierde el historial y se puede romper `vista_consumo_horas`
  u otros reportes que dependen de las filas "eliminadas" para el cálculo
  de horas ejecutadas. Conviene revisar en code review que ningún
  controlador tenga `delete from` fuera de los casos excepcionales de 3.8.
- **`listar`/`obtener` sin filtrar `activo = true`**: si se agrega el
  campo `activo` a `contratos`/`registro_horas`/`contrato_servicios` (3.8)
  pero se olvida el filtro por defecto en alguna consulta, los registros
  dados de baja lógicamente reaparecerían en listados y reportes como si
  siguieran vigentes.
- **Contratos/registro de horas cruzando tenants**: al crear un registro de
  horas hay que validar que el `contrato_id` y `tipo_servicio_id` recibidos
  pertenezcan a la empresa del usuario autenticado, no solo que existan.
- **Rol dependiente del contexto**: con `usuarios` global y el rol viviendo
  en `usuarios_empresas_rol`, hay que revisar cualquier lugar del código
  (actual o futuro) que asuma "un usuario tiene un solo rol fijo" — por
  ejemplo reportes, auditoría o notificaciones que hoy podrían tentar a
  leer un rol directo de `usuarios` en vez de resolverlo contra la empresa
  activa de la sesión.
- **Borrado de usuario global vs baja de una empresa**: `DELETE
  /usuarios/:id` debe interpretarse siempre como "quitar de la empresa
  activa" (desactivar lógicamente la fila en `usuarios_empresas_rol`,
  nunca borrarla físicamente, ver 3.8), y nunca como tocar la fila de
  `usuarios` — afectar la fila global impactaría el acceso del usuario a
  *todas* las empresas a las que pertenece, y además rompería la
  integridad referencial de `registro_horas.usuario_id` en contratos de
  otras empresas.
- **Onboarding de usuario ya existente**: al dar de alta un usuario en una
  empresa hay que buscar primero por email en la tabla global `usuarios`
  antes de asumir que es una persona nueva; si ya existe, solo se agrega
  una fila en `usuarios_empresas_rol` (nunca se debe permitir crear dos
  filas de `usuarios` con el mismo email).
