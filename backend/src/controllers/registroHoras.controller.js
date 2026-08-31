const { pool } = require('../config/db');

// Calcula las horas ejecutadas (decimal) a partir de "HH:MM" - "HH:MM".
// Retorna null si el rango es invalido (fin <= inicio).
function calcularHoras(horaInicio, horaFin) {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutos <= 0) return null;
  return Math.round((minutos / 60) * 100) / 100;
}

// Confirma que el registro de horas exista, sea de la empresa activa y (si
// el rol activo es 'cliente') pertenezca a su cliente_id. Devuelve el id o
// null. Se reusa en los endpoints de comentarios.
async function idRegistroEnAlcance(req, id) {
  const valores = [id, req.empresaId];
  let filtroCliente = '';
  if (req.clienteId) {
    valores.push(req.clienteId);
    filtroCliente = 'and contrato_id in (select id from contratos where cliente_id = $3)';
  }
  const { rows } = await pool.query(
    `select id from registro_horas where id = $1 and empresa_id = $2 ${filtroCliente}`,
    valores
  );
  return rows[0]?.id ?? null;
}

// GET /api/horas?contrato_id=&tipo_servicio_id=&usuario_id=&desde=&hasta=
async function listar(req, res, next) {
  try {
    const { contrato_id, tipo_servicio_id, usuario_id, desde, hasta } = req.query;
    const condiciones = ['rh.empresa_id = $1'];
    const valores = [req.empresaId];

    if (contrato_id) { valores.push(contrato_id); condiciones.push(`rh.contrato_id = $${valores.length}`); }
    if (tipo_servicio_id) { valores.push(tipo_servicio_id); condiciones.push(`rh.tipo_servicio_id = $${valores.length}`); }
    if (usuario_id) { valores.push(usuario_id); condiciones.push(`rh.usuario_id = $${valores.length}`); }
    if (desde) { valores.push(desde); condiciones.push(`rh.fecha >= $${valores.length}`); }
    if (hasta) { valores.push(hasta); condiciones.push(`rh.fecha <= $${valores.length}`); }
    // Un usuario "cliente" solo ve horas de contratos de su propio cliente,
    // sin importar que filtros haya pedido -- esto es lo que evita que un
    // ?contrato_id= de otro cliente le muestre datos ajenos.
    if (req.clienteId) { valores.push(req.clienteId); condiciones.push(`c.cliente_id = $${valores.length}`); }

    const where = `where ${condiciones.join(' and ')}`;

    const { rows } = await pool.query(
      `select rh.*, c.numero_contrato, cl.nombre as cliente_nombre,
              ts.nombre as tipo_servicio_nombre, u.nombre as usuario_nombre,
              coalesce(cc.total, 0)::int as comentarios_count
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       join clientes cl on cl.id = c.cliente_id
       join tipos_servicio ts on ts.id = rh.tipo_servicio_id
       join usuarios u on u.id = rh.usuario_id
       left join lateral (select count(*) as total from comentarios where registro_horas_id = rh.id) cc on true
       ${where}
       order by rh.fecha desc, rh.created_at desc`,
      valores
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtener(req, res, next) {
  try {
    const valores = [req.params.id, req.empresaId];
    let filtroCliente = '';
    if (req.clienteId) {
      valores.push(req.clienteId);
      filtroCliente = 'and contrato_id in (select id from contratos where cliente_id = $3)';
    }
    const { rows } = await pool.query(
      `select * from registro_horas where id = $1 and empresa_id = $2 ${filtroCliente}`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

// POST /api/horas
// Valida que exista una "bolsa" de horas (contrato_servicios) para ese
// contrato + tipo de servicio, que el contrato pertenezca a la empresa
// activa, y que el contrato este vigente segun sus fechas y estado.
async function crear(req, res, next) {
  try {
    const { contrato_id, tipo_servicio_id, fecha, hora_inicio, hora_fin, descripcion, documentos } = req.body;
    const usuario_id = req.body.usuario_id || req.usuario.id; // por defecto quien ejecuta la peticion

    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({ mensaje: 'Hora de inicio y hora de fin son requeridas.' });
    }
    const horas = calcularHoras(hora_inicio, hora_fin);
    if (horas === null) {
      return res.status(400).json({ mensaje: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    const bolsa = await pool.query(
      `select cs.id, cs.horas_contratadas, c.estado,
              to_char(c.fecha_inicio, 'DD/MM/YYYY') as fecha_inicio_fmt,
              to_char(c.fecha_fin, 'DD/MM/YYYY') as fecha_fin_fmt,
              (c.fecha_inicio <= coalesce($4::date, current_date)) as ya_inicio,
              (c.fecha_fin is null or c.fecha_fin >= coalesce($4::date, current_date)) as no_vencido
       from contrato_servicios cs
       join contratos c on c.id = cs.contrato_id
       where cs.contrato_id = $1 and cs.tipo_servicio_id = $2 and c.empresa_id = $3`,
      [contrato_id, tipo_servicio_id, req.empresaId, fecha || null]
    );
    if (!bolsa.rows[0]) {
      return res.status(400).json({
        mensaje: 'Este contrato no tiene horas establecidas para el tipo de servicio indicado. Agrega primero las horas contratadas.',
      });
    }

    const contrato = bolsa.rows[0];
    if (contrato.estado === 'cancelado' || contrato.estado === 'finalizado') {
      return res.status(400).json({ mensaje: `Este contrato esta ${contrato.estado} y no admite nuevas horas.` });
    }
    if (!contrato.ya_inicio) {
      return res.status(400).json({ mensaje: `Este contrato aun no esta vigente (inicia el ${contrato.fecha_inicio_fmt}).` });
    }
    if (!contrato.no_vencido) {
      return res.status(400).json({ mensaje: `Este contrato ya vencio (finalizo el ${contrato.fecha_fin_fmt}).` });
    }

    const { rows } = await pool.query(
      `insert into registro_horas (empresa_id, contrato_id, tipo_servicio_id, usuario_id, fecha, hora_inicio, hora_fin, horas, descripcion, documentos)
       values ($1,$2,$3,$4, coalesce($5, current_date), $6, $7, $8, $9, coalesce($10,'[]'::jsonb)) returning *`,
      [req.empresaId, contrato_id, tipo_servicio_id, usuario_id, fecha, hora_inicio, hora_fin, horas, descripcion, documentos ? JSON.stringify(documentos) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { fecha, hora_inicio, hora_fin, descripcion, documentos } = req.body;

    let horas = null;
    if (hora_inicio && hora_fin) {
      horas = calcularHoras(hora_inicio, hora_fin);
      if (horas === null) {
        return res.status(400).json({ mensaje: 'La hora de fin debe ser posterior a la hora de inicio.' });
      }
    }

    const { rows } = await pool.query(
      `update registro_horas set
         fecha = coalesce($1, fecha),
         hora_inicio = coalesce($2, hora_inicio),
         hora_fin = coalesce($3, hora_fin),
         horas = coalesce($4, horas),
         descripcion = coalesce($5, descripcion),
         documentos = coalesce($6, documentos)
       where id = $7 and empresa_id = $8 returning *`,
      [fecha, hora_inicio, hora_fin, horas, descripcion, documentos ? JSON.stringify(documentos) : null, req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from registro_horas where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    res.status(204).send();
  } catch (err) { next(err); }
}

// GET /api/horas/consumo  -> resumen de horas por servicio de la empresa activa
async function consumoGeneral(req, res, next) {
  try {
    const valores = [req.empresaId];
    let filtroCliente = '';
    if (req.clienteId) { valores.push(req.clienteId); filtroCliente = 'and cliente_id = $2'; }
    const { rows } = await pool.query(
      `select * from vista_consumo_horas where empresa_id = $1 ${filtroCliente} order by cliente_nombre, tipo_servicio_nombre`,
      valores
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/horas/consumo/:contratoId  -> resumen de horas por servicio de un contrato
async function consumoPorContrato(req, res, next) {
  try {
    const valores = [req.params.contratoId, req.empresaId];
    let filtroCliente = '';
    if (req.clienteId) { valores.push(req.clienteId); filtroCliente = 'and cliente_id = $3'; }
    const { rows } = await pool.query(
      `select * from vista_consumo_horas where contrato_id = $1 and empresa_id = $2 ${filtroCliente} order by tipo_servicio_nombre`,
      valores
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/horas/:id/comentarios
async function listarComentarios(req, res, next) {
  try {
    const id = await idRegistroEnAlcance(req, req.params.id);
    if (!id) return res.status(404).json({ mensaje: 'Registro no encontrado' });

    const { rows } = await pool.query(
      `select c.id, c.usuario_id, u.nombre as usuario_nombre, c.nota, c.created_at as fecha
       from comentarios c
       join usuarios u on u.id = c.usuario_id
       where c.registro_horas_id = $1
       order by c.created_at asc`,
      [id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// POST /api/horas/:id/comentarios  { nota }
// Bitacora de solo-agregar: cualquier rol autenticado puede comentar un
// registro de horas al que tenga acceso (para 'cliente', solo los suyos).
async function agregarComentario(req, res, next) {
  try {
    const nota = (req.body.nota || '').trim();
    if (!nota) return res.status(400).json({ mensaje: 'La nota no puede estar vacia' });

    const id = await idRegistroEnAlcance(req, req.params.id);
    if (!id) return res.status(404).json({ mensaje: 'Registro no encontrado' });

    const { rows } = await pool.query(
      `insert into comentarios (registro_horas_id, usuario_id, nota)
       values ($1, $2, $3)
       returning id, usuario_id, nota, created_at as fecha`,
      [id, req.usuario.id, nota]
    );

    // Quien comenta, obviamente ya vio su propio comentario -- no debe
    // notificarsele a si mismo.
    await marcarVisto(req.usuario.id, id);

    res.status(201).json({ ...rows[0], usuario_nombre: req.usuario.nombre });
  } catch (err) { next(err); }
}

// POST /api/horas/:id/comentarios/marcar-visto
async function marcarComentariosVistos(req, res, next) {
  try {
    const id = await idRegistroEnAlcance(req, req.params.id);
    if (!id) return res.status(404).json({ mensaje: 'Registro no encontrado' });
    await marcarVisto(req.usuario.id, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

async function marcarVisto(usuarioId, registroHorasId) {
  await pool.query(
    `insert into comentarios_vistos (usuario_id, registro_horas_id, visto_hasta)
     values ($1, $2, now())
     on conflict (usuario_id, registro_horas_id) do update set visto_hasta = now()`,
    [usuarioId, registroHorasId]
  );
}

// GET /api/horas/notificaciones/no-leidos
// Cuenta registros (no comentarios individuales) con al menos un
// comentario que este usuario todavia no vio, dentro de su alcance.
async function contarComentariosNoLeidos(req, res, next) {
  try {
    const valores = [req.empresaId, req.usuario.id];
    let filtroCliente = '';
    if (req.clienteId) { valores.push(req.clienteId); filtroCliente = 'and c.cliente_id = $3'; }

    const { rows } = await pool.query(
      `select count(distinct rh.id)::int as no_leidos
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       join comentarios cm on cm.registro_horas_id = rh.id
       left join comentarios_vistos cv on cv.registro_horas_id = rh.id and cv.usuario_id = $2
       where rh.empresa_id = $1 ${filtroCliente}
         and cm.created_at > coalesce(cv.visto_hasta, '-infinity'::timestamptz)`,
      valores
    );
    res.json({ no_leidos: rows[0].no_leidos });
  } catch (err) { next(err); }
}

// GET /api/horas/notificaciones  -> hasta 10 registros con comentarios sin leer
async function listarNotificaciones(req, res, next) {
  try {
    const valores = [req.empresaId, req.usuario.id];
    let filtroCliente = '';
    if (req.clienteId) { valores.push(req.clienteId); filtroCliente = 'and c.cliente_id = $3'; }

    const { rows } = await pool.query(
      `select rh.id as registro_horas_id, c.numero_contrato, cl.nombre as cliente_nombre,
              coalesce(cv.visto_hasta, '-infinity'::timestamptz) as visto_hasta
       from registro_horas rh
       join contratos c on c.id = rh.contrato_id
       join clientes cl on cl.id = c.cliente_id
       left join comentarios_vistos cv on cv.registro_horas_id = rh.id and cv.usuario_id = $2
       where rh.empresa_id = $1 ${filtroCliente}
         and exists (
           select 1 from comentarios cm
           where cm.registro_horas_id = rh.id and cm.created_at > coalesce(cv.visto_hasta, '-infinity'::timestamptz)
         )
       order by rh.updated_at desc
       limit 10`,
      valores
    );

    const notificaciones = await Promise.all(rows.map(async (r) => {
      const nuevos = await pool.query(
        `select c.usuario_id, u.nombre as usuario_nombre, c.nota, c.created_at as fecha
         from comentarios c join usuarios u on u.id = c.usuario_id
         where c.registro_horas_id = $1 and c.created_at > $2
         order by c.created_at asc`,
        [r.registro_horas_id, r.visto_hasta]
      );
      return {
        registro_horas_id: r.registro_horas_id,
        numero_contrato: r.numero_contrato,
        cliente_nombre: r.cliente_nombre,
        comentarios_nuevos: nuevos.rows,
      };
    }));

    res.json(notificaciones);
  } catch (err) { next(err); }
}

module.exports = {
  listar, obtener, crear, actualizar, eliminar, consumoPorContrato, consumoGeneral,
  listarComentarios, agregarComentario, marcarComentariosVistos,
  contarComentariosNoLeidos, listarNotificaciones,
};
