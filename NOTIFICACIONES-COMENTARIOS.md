# Plan: notificaciones de comentarios no leidos (campanita + contador rojo)

Fecha: 2026-08-31
Documento de planificacion (no implementado). Depende directamente de la
funcionalidad de comentarios en `registro_horas` (ver
[PORTAL-CLIENTE.md](PORTAL-CLIENTE.md), seccion 3.5 y 5) que ya esta
implementada: cada registro de horas tiene `comentarios: jsonb`, un
arreglo de solo-agregar `{ fecha, usuario_id, usuario_nombre, nota }`.

## 1. El problema real: "no leido" no existe hoy en el modelo

Los comentarios son un arreglo append-only dentro de cada
`registro_horas`. No hay ningun concepto de "quien ya vio esto" -- eso es
por usuario, no por comentario, y hay que agregarlo.

## 2. Modelo de datos: tabla de "vistos" por usuario

Se necesita una tabla nueva que registre, por usuario y por registro de
horas, cuantos comentarios de ese registro ya vio:

```sql
create table if not exists comentarios_vistos (
    usuario_id          uuid not null references usuarios(id) on delete cascade,
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    cantidad_vista      integer not null default 0,
    updated_at          timestamptz not null default now(),
    primary key (usuario_id, registro_horas_id)
);
```

`cantidad_vista` es simplemente "cuantos elementos del arreglo
`comentarios` de ese registro ya vio este usuario". Como el arreglo solo
crece (nunca se edita ni se borra, ver PORTAL-CLIENTE.md), comparar
`jsonb_array_length(rh.comentarios) > cv.cantidad_vista` alcanza para
saber si hay comentarios nuevos para ese usuario en ese registro -- no
hace falta guardar fechas ni ids individuales.

Por que no una tabla de "notificaciones" con una fila por comentario:
seria mas normal en otros sistemas, pero acá cada registro ya trae su
propia lista de comentarios (con fecha, autor y nota) -- duplicarla en
otra tabla es redundante. La tabla de "vistos" es el minimo necesario.

## 3. Backend

### 3.1 Regla de alcance (que registros le importan a cada usuario)

Mismo alcance que ya existe para listar registros de horas:
- rol `cliente`: registros cuyo contrato pertenece a su `cliente_id`.
- resto de roles: todos los registros de la empresa activa.

### 3.2 Marcar como visto (cuando abre el drawer de comentarios)

```js
// POST /api/horas/:id/comentarios/marcar-visto
async function marcarComentariosVistos(req, res, next) {
  try {
    const registro = await pool.query(
      'select jsonb_array_length(comentarios) as total from registro_horas where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!registro.rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });

    await pool.query(
      `insert into comentarios_vistos (usuario_id, registro_horas_id, cantidad_vista)
       values ($1, $2, $3)
       on conflict (usuario_id, registro_horas_id)
       do update set cantidad_vista = excluded.cantidad_vista, updated_at = now()`,
      [req.usuario.id, req.params.id, registro.rows[0].total]
    );
    res.status(204).send();
  } catch (err) { next(err); }
}
```

Se llama automaticamente cuando el frontend abre el drawer de
comentarios de un registro (`abrirComentarios(r)` en
`registro-horas.component.ts`, que ya existe).

### 3.3 Al agregar un comentario propio, marcarlo como visto para uno mismo

En el `agregarComentario` que ya existe (`registroHoras.controller.js`),
justo despues del `update ... comentarios = comentarios || $1`, hacer el
mismo upsert de la seccion 3.2 para `req.usuario.id` con la nueva
longitud del arreglo -- si yo escribo un comentario, obviamente ya lo vi,
no debo notificarme a mi mismo.

### 3.4 Contador de no leidos

```js
// GET /api/horas/notificaciones/no-leidos
async function contarComentariosNoLeidos(req, res, next) {
  try {
    const valores = [req.empresaId, req.usuario.id];
    let filtroCliente = '';
    if (req.clienteId) {
      valores.push(req.clienteId);
      filtroCliente = 'and c.cliente_id = $3';
    }
    const { rows } = await pool.query(
      `select count(*)::int as no_leidos
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       left join comentarios_vistos cv
              on cv.registro_horas_id = rh.id and cv.usuario_id = $2
       where rh.empresa_id = $1 ${filtroCliente}
         and jsonb_array_length(rh.comentarios) > coalesce(cv.cantidad_vista, 0)`,
      valores
    );
    res.json({ no_leidos: rows[0].no_leidos });
  } catch (err) { next(err); }
}
```

Nota: esto cuenta **registros con al menos un comentario nuevo**, no la
cantidad total de comentarios nuevos (mas simple e igual de util para un
badge). Si prefieres el conteo exacto de comentarios nuevos (sumando
`jsonb_array_length - cantidad_vista` en vez de contar filas), es un
cambio de una linea en el `select` (`sum(...)` en vez de `count(*)`) --
decidir cual de los dos se ve mejor en el badge.

### 3.5 Lista para el dropdown de la campanita

```js
// GET /api/horas/notificaciones  (los N mas recientes con comentarios sin leer)
async function listarNotificaciones(req, res, next) {
  try {
    const valores = [req.empresaId, req.usuario.id];
    let filtroCliente = '';
    if (req.clienteId) { valores.push(req.clienteId); filtroCliente = 'and c.cliente_id = $3'; }

    const { rows } = await pool.query(
      `select rh.id, rh.comentarios, c.numero_contrato, cl.nombre as cliente_nombre,
              coalesce(cv.cantidad_vista, 0) as ya_vistos
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       join clientes cl on cl.id = c.cliente_id
       left join comentarios_vistos cv
              on cv.registro_horas_id = rh.id and cv.usuario_id = $2
       where rh.empresa_id = $1 ${filtroCliente}
         and jsonb_array_length(rh.comentarios) > coalesce(cv.cantidad_vista, 0)
       order by rh.updated_at desc
       limit 10`,
      valores
    );
    // El "ultimo comentario nuevo" de cada fila es comentarios[ya_vistos..] -- se arma en JS
    const notificaciones = rows.map((r) => ({
      registro_horas_id: r.id,
      numero_contrato: r.numero_contrato,
      cliente_nombre: r.cliente_nombre,
      comentarios_nuevos: r.comentarios.slice(r.ya_vistos),
    }));
    res.json(notificaciones);
  } catch (err) { next(err); }
}
```

### 3.6 Rutas

```js
router.get('/notificaciones', ctrl.listarNotificaciones);        // antes de /:id
router.get('/notificaciones/no-leidos', ctrl.contarComentariosNoLeidos); // antes de /:id
router.post('/:id/comentarios/marcar-visto', ctrl.marcarComentariosVistos);
```

Sin `requireRol`: cualquier rol autenticado consulta sus propias
notificaciones (el filtro de alcance ya limita los datos).

## 4. Frontend

### 4.1 Servicio

```ts
// registro-horas.service.ts
notificacionesNoLeidas(): Observable<{ no_leidos: number }> {
  return this.http.get<{ no_leidos: number }>(`${this.base}/notificaciones/no-leidos`);
}
listarNotificaciones(): Observable<NotificacionComentario[]> {
  return this.http.get<NotificacionComentario[]>(`${this.base}/notificaciones`);
}
marcarComentariosVistos(id: string): Observable<void> {
  return this.http.post<void>(`${this.base}/${id}/comentarios/marcar-visto`, {});
}
```

### 4.2 Campanita en el header (`layout.component.html`)

Se agrega en el `.topbar`, a la izquierda del `user-menu` existente (ver
linea con `<div class="user-menu">`):

```html
<div class="notif-bell" (click)="notifAbiertas.set(!notifAbiertas())">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/>
    <path d="M10 21a2 2 0 0 0 4 0"/>
  </svg>
  @if (noLeidos() > 0) {
    <span class="notif-badge">{{ noLeidos() > 9 ? '9+' : noLeidos() }}</span>
  }
</div>

@if (notifAbiertas()) {
  <div class="dropdown-backdrop" (click)="notifAbiertas.set(false)"></div>
  <div class="dropdown-menu notif-dropdown">
    @for (n of notificaciones(); track n.registro_horas_id) {
      <a class="dropdown-item" (click)="irAComentario(n)">
        <strong>{{ n.cliente_nombre }} &middot; {{ n.numero_contrato }}</strong>
        <div class="text-muted text-sm">{{ n.comentarios_nuevos[0].usuario_nombre }}: {{ n.comentarios_nuevos[0].nota }}</div>
      </a>
    } @empty {
      <div class="dropdown-item text-muted">Sin comentarios nuevos.</div>
    }
  </div>
}
```

CSS nuevo en `styles.css` (siguiendo el patron ya usado por
`.user-pill`/`.dropdown-menu`):

```css
.notif-bell { position: relative; cursor: pointer; color: var(--slate-500); padding: 6px; }
.notif-badge {
  position: absolute; top: 0; right: 0;
  background: var(--red-600); color: white;
  font-size: 10px; font-weight: 700; line-height: 1;
  min-width: 16px; height: 16px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 3px;
}
```

### 4.3 `layout.component.ts`

```ts
noLeidos = signal(0);
notifAbiertas = signal(false);
notificaciones = signal<NotificacionComentario[]>([]);

private cargarNoLeidos(): void {
  this.horasSrv.notificacionesNoLeidas().subscribe((r) => this.noLeidos.set(r.no_leidos));
}

ngOnInit(): void {
  this.cargarNoLeidos();
  // Poll simple -- no hay websockets en este proyecto.
  interval(60000).subscribe(() => this.cargarNoLeidos());
}

toggleNotificaciones(): void {
  const abrir = !this.notifAbiertas();
  this.notifAbiertas.set(abrir);
  if (abrir) this.horasSrv.listarNotificaciones().subscribe((data) => this.notificaciones.set(data));
}

irAComentario(n: NotificacionComentario): void {
  this.notifAbiertas.set(false);
  this.horasSrv.marcarComentariosVistos(n.registro_horas_id).subscribe(() => this.cargarNoLeidos());
  this.router.navigate(['/horas'], { queryParams: { registro_id: n.registro_horas_id } });
}
```

`interval(60000)` es sondeo cada 60s -- sencillo, sin infraestructura
nueva (websockets, SSE) que este proyecto no tiene. Si mas adelante se
quiere "tiempo real" de verdad, ese es un cambio de arquitectura aparte
(no cubierto aqui).

### 4.4 Abrir el comentario correcto desde la notificacion

`registro-horas.component.ts` ya tiene `filtroContratoId`/
`filtroTipoServicioId` leidos de query params (ver
`route.queryParamMap.subscribe(...)`). Se agrega el mismo patron para un
nuevo query param `registro_id`: si viene, se llama automaticamente a
`abrirComentarios(r)` con ese registro apenas termine de cargar
`registros()` (y se marca visto ahi mismo, reutilizando el metodo que ya
existe).

### 4.5 Marcar como visto tambien al abrir el drawer manualmente

En `registro-horas.component.ts`, dentro de `abrirComentarios(r)` (ya
existe), agregar la llamada a `this.srv.marcarComentariosVistos(r.id)`
justo al abrir -- asi tambien se marca como visto si el usuario entra por
su cuenta a la pantalla de Registro de horas y abre el drawer, sin pasar
por la notificacion.

## 5. Checklist de implementacion

1. Migracion `010_comentarios_vistos.sql`: crear tabla
   `comentarios_vistos`. Actualizar `schema.sql`.
2. `registroHoras.controller.js`: `marcarComentariosVistos`,
   `contarComentariosNoLeidos`, `listarNotificaciones`; y actualizar
   `agregarComentario` para que se auto-marque como visto para quien
   comenta.
3. `registroHoras.routes.js`: registrar las 3 rutas nuevas (las de
   `/notificaciones*` **antes** de `/:id`, mismo cuidado que ya se tuvo
   con `/empresas/usuarios-globales` en este proyecto).
4. `registro-horas.service.ts`: los 3 metodos nuevos del frontend.
5. `layout.component.ts/html`: campanita + badge + dropdown + polling.
6. `registro-horas.component.ts`: leer `registro_id` de query params,
   auto-abrir su drawer; marcar visto tambien al abrir manualmente.
7. Probar: agregar un comentario con un usuario, confirmar que el
   contador sube para los demas usuarios de la empresa (o el cliente
   dueño del contrato) pero **no** para quien lo escribio; abrir el
   drawer y confirmar que el contador baja.

## 6. Alternativa de diseño: tabla `comentarios` en vez de jsonb

Pregunta valida: en vez del arreglo jsonb dentro de `registro_horas`,
¿usar una tabla `comentarios` normal? El UX visible para el usuario
**no cambia en nada** -- mismo drawer, misma lista, mismo boton de
agregar, sigue sin poder editar/borrar. Es una decision puramente interna
de modelado de datos. Impacto real de cada lado:

### Por que jsonb fue lo mas rapido de implementar

- Un solo `update ... set comentarios = comentarios || $1::jsonb` para
  agregar, sin tabla ni migracion adicional.
- `registro_horas.*` ya trae los comentarios incluidos en cualquier
  `select` existente (`listar()`, `obtener()`) -- cero cambios en esas
  consultas.
- Cero JOINs nuevos.

### Donde una tabla aparte es mejor

```sql
create table if not exists comentarios (
    id                  uuid primary key default gen_random_uuid(),
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    usuario_id          uuid not null references usuarios(id) on delete restrict,
    nota                text not null,
    created_at          timestamptz not null default now()
);
create index if not exists idx_comentarios_registro on comentarios(registro_horas_id, created_at);
```

1. **"No leido" deja de ser un hack de posicion.** Hoy (seccion 2)
   `comentarios_vistos.cantidad_vista` es un contador de posicion
   ("vi los primeros N") que solo funciona porque el arreglo nunca se
   reordena ni se borra nada. Con una tabla, "no leido" es
   `comentarios.created_at > usuario_visto.ultima_fecha_vista` (o
   `comentarios.id > ultimo_id_visto`) -- una comparacion real sobre una
   clave estable, no una cuenta de posicion fragil. Si alguna vez se
   permite borrar un comentario (hoy no, pero es el tipo de regla que
   cambia), el conteo por posicion queda mal (desincroniza "cuantos hay"
   vs "cuantos vi"); la comparacion por fecha/id no se rompe.

2. **Costo de traer datos que no hacen falta.** Hoy `GET /horas` (la
   tabla completa de Registro de horas) trae el arreglo `comentarios`
   **completo** de cada fila en cada carga de pantalla, aunque la UI solo
   muestra un numerito (`{{ r.comentarios?.length }}`) en el boton. Con
   una tabla, `GET /horas` pediria solo un conteo
   (`count(*) as comentarios_count` via subquery/JOIN LATERAL) y el
   contenido completo de la conversacion se pediria aparte, solo cuando
   el usuario abre el drawer (`GET /horas/:id/comentarios`) -- que es
   exactamente cuando hoy ya se muestra igual. Para pocos comentarios por
   registro esto no se nota; si algun registro llega a acumular decenas o
   cientos de comentarios en el tiempo, con jsonb ese peso viaja en
   *cada* carga de la tabla (para todos los usuarios, todo el tiempo),
   con tabla aparte no.

3. **Escritura mas barata a largo plazo.** Cada `... || $1::jsonb`
   reescribe el valor jsonb completo de esa columna (Postgres actualiza
   la fila entera, y si el jsonb crece lo suficiente entra en TOAST,
   compresion/descompresion de por medio). Un `insert` en una tabla
   aparte es independiente del historial acumulado: agregar el
   comentario #500 cuesta lo mismo que agregar el #1.

4. **Se abre la puerta a cosas futuras sin rediseñar de nuevo**:
   paginar comentarios de un registro con muchísimos, un moderador
   borrando una nota inapropiada, responder a un comentario puntual,
   ordenar/filtrar comentarios de forma independiente al registro. Ninguna
   de estas esta pedida ni se implementa ahora, pero con tabla quedan
   disponibles sin migrar de nuevo; con jsonb, el dia que se necesite algo
   de esto hay que migrar igual que se migraria ahora.

### Costo de cambiar (si se decide hacerlo)

- Una migracion mas (tabla + indice) y un `INSERT ... SELECT` para migrar
  los `comentarios` jsonb existentes a filas (en este momento serian
  practicamente cero filas reales, la funcionalidad es nueva -- **este es
  el mejor momento para cambiarlo si se va a cambiar**, antes de que haya
  datos reales acumulados).
- `agregarComentario()` pasa de un `update ... ||` a un `insert`.
- `listar()`/`obtener()` de `registroHoras.controller.js` necesitan un
  `left join lateral` o subquery con `count(*)` para el numerito del
  boton, en vez de traer el arreglo completo.
- Nuevo endpoint `GET /horas/:id/comentarios` para el contenido completo
  bajo demanda (el drawer de comentarios lo pide al abrir, en vez de leer
  `r.comentarios` que ya traia consigo).
- `RegistroHora.comentarios` (frontend) pasa de venir siempre poblado a
  ser opcional/cargado al abrir el drawer -- cambio pequeño en
  `registro-horas.component.ts` (`abrirComentarios()` pasa a llamar al
  endpoint nuevo antes de mostrar el drawer, con un estado de "cargando"
  brevisimo que hoy no existe pero que no cambia lo que el usuario ve una
  vez cargado).
- La seccion 3 de este documento (marcar visto / contar no leidos /
  listar notificaciones) se simplifica: las consultas con
  `jsonb_array_length(...)` se cambian por `count(*)`/`max(created_at)`
  sobre la tabla `comentarios`, mas simple de leer y de mantener.

### Recomendacion

Si esto va a crecer (mas empresas, mas historial, la notificacion de la
seccion anterior, quiza mas adelante paginar/moderar), **tabla aparte es
la opcion mas solida**, y el costo de migrar hoy es minimo porque no hay
datos reales todavia. Si el uso real termina siendo "2-3 comentarios por
registro, pocas veces", el jsonb actual es perfectamente suficiente y
cambiarlo seria trabajo sin beneficio practico. Es tu llamada segun cuanto
esperas que crezca esto.

## 7. Cosas a decidir contigo antes de implementar

- ¿El contador cuenta **registros con algo nuevo** (mas simple, lo que
  documenté arriba) o la **cantidad total de comentarios nuevos** sin
  importar en cuantos registros esten?
- ¿Cada cuanto debe refrescarse el contador mientras la app esta abierta
  (propuse 60s de sondeo)?
- ¿Quienes deben recibir estas notificaciones? Lo mas simple y lo que
  documenté es "todo el que puede ver ese registro de horas" (todo el
  equipo de la empresa + el cliente dueño del contrato) -- una
  alternativa mas acotada seria notificar solo al tecnico que ejecuto el
  registro + al cliente, sin incluir a todo el equipo.
