# Plan: rol "cliente" (portal de cliente) + comentarios en registro de horas

Fecha: 2026-08-31
Documento de planificación (no implementado todavia). Cubre dos cosas
relacionadas que pediste juntas:

1. Un nuevo rol `cliente`: un usuario que al loguearse solo ve la
   informacion de **un cliente puntual** dentro de la empresa (sus
   contratos, sus horas), no toda la empresa.
2. Comentarios en `registro_horas` (jsonb: fecha, usuario, nota), para que
   ese usuario cliente (y opcionalmente otros roles) pueda dejar
   comentarios sobre un registro de horas ejecutado.

## 1. Por que esto no es trivial con el modelo actual

Hoy el aislamiento de datos es por **empresa** (`empresa_id` en cada
tabla, `usuarios_empresas_rol` con rol = admin/supervisor/tecnico). No
existe el concepto de "este usuario solo puede ver un cliente dentro de
la empresa". Agregar el rol `cliente` requiere aislamiento **por
cliente_id**, un nivel mas granular que se debe filtrar en cada consulta,
no solo confiar en el rol.

Esto es el punto critico de seguridad de toda la funcionalidad: si un
solo endpoint se olvida de filtrar por `cliente_id`, un usuario cliente
podria ver contratos u horas de otro cliente de la misma empresa.

## 2. Modelo de datos

### 2.1 `usuarios_empresas_rol`: agregar `cliente_id`

```sql
alter table usuarios_empresas_rol
  add column cliente_id uuid references clientes(id) on delete cascade;

-- Solo tiene sentido cuando el rol es 'cliente', y es obligatorio en ese caso
alter table usuarios_empresas_rol
  add constraint chk_cliente_id_segun_rol check (
    (rol = 'cliente' and cliente_id is not null) or
    (rol <> 'cliente' and cliente_id is null)
  );

alter table usuarios_empresas_rol
  drop constraint if exists usuarios_empresas_rol_rol_check;
alter table usuarios_empresas_rol
  add constraint usuarios_empresas_rol_rol_check
  check (rol in ('admin','supervisor','tecnico','cliente'));
```

Un mismo usuario podria en teoria ser "cliente" de una empresa y
"tecnico" de otra (la relacion ya es N:M), eso no cambia.

### 2.2 `registro_horas`: agregar `comentarios`

```sql
alter table registro_horas
  add column comentarios jsonb not null default '[]'::jsonb;
```

Forma de cada entrada del arreglo:
```json
{ "fecha": "2026-08-31T14:32:00.000Z", "usuario_id": "...", "usuario_nombre": "Ana Perez", "nota": "Confirmado con el cliente." }
```

No se anida en `documentos` (que es para archivos) ni se mezcla con
`descripcion` (que la escribe quien ejecuto el trabajo) -- son
comentarios de seguimiento, potencialmente de varias personas a lo largo
del tiempo, por eso arreglo y no un campo de texto simple.

## 3. Backend

### 3.1 JWT: incluir `cliente_id` cuando el rol es 'cliente'

En `auth.controller.js`, tanto `login()` (cuando el usuario tiene una
sola empresa) como `seleccionarEmpresa()` arman el payload del JWT con
`{ id, nombre, email, rol, empresa_id, es_super_admin }`. Hay que sumar
`cliente_id: fila.cliente_id ?? null` ahi mismo, leyendo la columna nueva
de `usuarios_empresas_rol`.

### 3.2 Middleware: exponer `req.clienteId`

En `middleware/auth.js`, extender (o duplicar) `requireEmpresa` para
dejar disponible el scope de cliente:

```js
function requireEmpresa(req, res, next) {
  if (!req.usuario || !req.usuario.empresa_id) {
    return res.status(403).json({ mensaje: 'La sesion no tiene una empresa activa seleccionada' });
  }
  req.empresaId = req.usuario.empresa_id;
  req.clienteId = req.usuario.rol === 'cliente' ? req.usuario.cliente_id : null;
  next();
}
```

Y un helper para bloquear escritura a este rol en las rutas que hoy
aceptan "cualquier usuario autenticado":

```js
function bloquearCliente(req, res, next) {
  if (req.usuario?.rol === 'cliente') {
    return res.status(403).json({ mensaje: 'Tu usuario no tiene permisos de edicion' });
  }
  next();
}
```

### 3.3 Filtrar TODAS las consultas de lectura por `cliente_id`

Regla: en cada controller, si `req.clienteId` esta presente, agregar
`and c.cliente_id = $N` (contratos) o el equivalente via join. Puntos a
tocar:

- `contratos.controller.js` -> `listar()`, `obtener()`: agregar filtro.
- `registroHoras.controller.js` -> `listar()`, `obtener()`,
  `consumoGeneral()`, `consumoPorContrato()`: agregar filtro (via join a
  `contratos c` para llegar a `c.cliente_id`; `vista_consumo_horas` ya
  trae `cliente_id`, asi que ahi es directo: `and cliente_id = $N`).
- `clientes.controller.js` -> `obtener()`: si el rol es cliente, solo
  puede pedir su propio `cliente_id` (o exponer un `/clientes/me` en vez
  de reusar `/clientes/:id`). `listar()` no deberia usarse para este rol.
- `dashboard` (no tiene controller propio, el frontend arma todo con
  `clientesSrv.listar()` + `contratosSrv.listar()` +
  `horasSrv.consumoGeneral()` -- al quedar esos tres filtrados en el
  backend, el dashboard queda filtrado gratis).

### 3.4 Bloquear escritura para el rol cliente

Revisar cada ruta que hoy no exige `requireRol(...)`:

- `registroHoras.routes.js` -> `POST /` ("cualquier usuario autenticado
  registra sus horas ejecutadas"): agregar `bloquearCliente` (un cliente
  no ejecuta trabajo, no debe poder crear registros).
- `contratos.routes.js`, `clientes.routes.js`, `tipos-servicio.routes.js`:
  confirmar que create/update/delete ya exigen `requireRol('admin',
  'supervisor')` -- si es asi, el rol `cliente` queda bloqueado
  automaticamente al no estar en la lista. Si alguna ruta no tiene el
  guard, agregarlo.
- `usuarios.routes.js`, `empresas.routes.js`: ya restringidas a admin /
  super-admin, no requieren cambio.

### 3.5 Nuevo endpoint: agregar comentario

```js
// POST /api/horas/:id/comentarios  { nota }
async function agregarComentario(req, res, next) {
  try {
    const { nota } = req.body;
    if (!nota?.trim()) return res.status(400).json({ mensaje: 'La nota no puede estar vacia' });

    // Si es un usuario "cliente", validar que el registro pertenezca a su cliente_id
    const registro = await pool.query(
      `select rh.id from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       where rh.id = $1 and rh.empresa_id = $2
       ${req.clienteId ? 'and c.cliente_id = $3' : ''}`,
      req.clienteId ? [req.params.id, req.empresaId, req.clienteId] : [req.params.id, req.empresaId]
    );
    if (!registro.rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });

    const comentario = {
      fecha: new Date().toISOString(),
      usuario_id: req.usuario.id,
      usuario_nombre: req.usuario.nombre,
      nota: nota.trim(),
    };

    const { rows } = await pool.query(
      `update registro_horas set comentarios = comentarios || $1::jsonb
       where id = $2 returning *`,
      [JSON.stringify([comentario]), req.params.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}
```

Ruta: `router.post('/:id/comentarios', ctrl.agregarComentario);` --
**disponible para cualquier rol autenticado** (admin, supervisor,
tecnico y cliente, decidido), sin `requireRol`; la validacion de a qué
registro puede comentar ya la hace la query de arriba.

**Los comentarios son de solo-agregar (decidido): no hay `PUT`/`DELETE`
para editarlos o borrarlos.** Es una bitacora de seguimiento, no un chat
editable -- una vez agregado un comentario queda fijo. No se planea
ningun endpoint de edicion/borrado para esto.

## 4. Frontend

### 4.1 Modelo y tipos

```ts
export type Rol = 'admin' | 'supervisor' | 'tecnico' | 'cliente';

export interface Comentario {
  fecha: string;
  usuario_id: string;
  usuario_nombre: string;
  nota: string;
}
```

Agregar `comentarios?: Comentario[]` a `RegistroHora`.

### 4.2 `AuthService`

```ts
esCliente = computed(() => this.usuario()?.rol === 'cliente');
```

Y ajustar `puedeEditar()`/`puedeEliminar()` para que sigan devolviendo
`false` para `cliente` (ya lo hacen, porque solo listan admin/supervisor
explicitamente -- confirmar que ningun lugar chequee "rol !== tecnico"
en vez de una lista explicita, para no dejar pasar `cliente` por
accidente).

### 4.3 Asociar un usuario como "cliente" de una empresa

En la pantalla de **Empresas** (donde ya se asocia un usuario existente
con un rol), agregar: cuando el select de rol tiene el valor `cliente`,
mostrar un segundo select "Cliente" poblado con
`clientesSrv.listar()` (de esa empresa), y mandar `cliente_id` junto con
`usuario_id`/`rol` a `POST /empresas/:id/usuarios`. `empresas.controller.js`
-> `asociarUsuario()` necesita aceptar y guardar `cliente_id`, validando
que pertenezca a la empresa indicada.

### 4.4 Navegacion para el rol cliente

**Contratos no es visible para este rol** (decidido). En
`layout.component.html`, ocultar para `auth.esCliente()`: Contratos,
Clientes, Tipos de servicio, Usuarios, Empresas, Reportes. Dejar
visibles: Resumen (filtrado), Registro de horas (filtrado, solo lectura +
comentarios).

Ocultar el link no alcanza: hay que bloquear tambien la ruta
`/contratos` y `/contratos/:id` con un guard (mismo patron que
`superAdminGuard`), y en el backend mantener el filtro/bloqueo de
`contratos.controller.js` igual (defensa en profundidad -- que la API
nunca devuelva contratos de otro cliente ni al rol cliente en general,
sin depender de que el frontend oculte el menu).

### 4.5 Registro de horas: ocultar acciones de escritura, agregar comentarios

En `registro-horas.component.html`, el boton "+ Registrar horas" y las
acciones "Editar"/"Eliminar" ya dependen de `auth.puedeEditar()` /
`auth.puedeEliminar()`, que devuelven `false` para `cliente` sin tocar
nada. Agregar un boton nuevo, visible para todos los roles:

```html
<button class="btn btn-outline btn-sm" (click)="abrirComentarios(r)">
  Comentarios @if (r.comentarios?.length) { ({{ r.comentarios?.length }}) }
</button>
```

Un drawer nuevo con la lista de `r.comentarios` (fecha, usuario_nombre,
nota) ordenados mas reciente primero, y un `<textarea>` + boton "Agregar
comentario" al final que llama a un nuevo metodo del servicio:

```ts
// registro-horas.service.ts
agregarComentario(id: string, nota: string): Observable<RegistroHora> {
  return this.http.post<RegistroHora>(`${this.base}/${id}/comentarios`, { nota });
}
```

## 5. Checklist de implementacion

1. Migracion `009_rol_cliente.sql`: columna `cliente_id` +
   constraint en `usuarios_empresas_rol`, columna `comentarios` en
   `registro_horas`. Actualizar `schema.sql` igual.
2. `auth.controller.js`: incluir `cliente_id` en el JWT (`login`,
   `seleccionarEmpresa`).
3. `middleware/auth.js`: `requireEmpresa` deja `req.clienteId`; nuevo
   `bloquearCliente`.
4. Filtrar por `cliente_id` en: `contratos.controller.js` (listar,
   obtener), `registroHoras.controller.js` (listar, obtener,
   consumoGeneral, consumoPorContrato), `clientes.controller.js`
   (obtener).
5. Agregar `bloquearCliente` en `POST /horas` y confirmar que el resto de
   rutas de escritura ya excluyen el rol por su whitelist de
   `requireRol`.
6. Nuevo endpoint `POST /horas/:id/comentarios`.
7. Frontend: tipos (`Rol`, `Comentario`, `RegistroHora.comentarios`),
   `AuthService.esCliente`.
8. Pantalla Empresas: selector de cliente al asociar un usuario con rol
   `cliente`.
9. `layout.component.html`: ocultar navegacion no aplicable al rol
   cliente (incluido Contratos).
10. Guard de rutas para bloquear `/contratos` y `/contratos/:id` al rol
    cliente (defensa en profundidad junto con el backend).
11. `registro-horas.component`: boton + drawer de comentarios.
12. Probar el caso critico de seguridad: loguear como cliente y
    confirmar por API directa (no solo por UI) que `/contratos`,
    `/horas`, `/horas/consumo` devuelven **unicamente** filas de su
    `cliente_id` (o nada, en el caso de `/contratos`), incluso pidiendo
    `?contrato_id=` de otro cliente a mano.

## 6. Decisiones confirmadas

- **Contratos no es visible para el rol cliente** (ni el menu ni la
  ruta) -- solo ve Resumen y Registro de horas, ambos filtrados a su
  `cliente_id`.
- **Cualquier rol puede agregar comentarios** (admin, supervisor,
  tecnico, cliente) -- no es exclusivo del rol cliente.
- **Los comentarios no se pueden editar ni borrar** -- solo agregar.
  Bitacora de solo-agregar, sin endpoints de edicion/borrado.
