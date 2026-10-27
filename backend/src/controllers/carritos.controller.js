const { pool } = require('../config/db');
const { enviarCorreo } = require('../utils/correo');

const ORDEN_ESTADOS = ['en_construccion', 'en_revision', 'aprobada', 'cerrada'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ETIQUETAS_ESTADO = {
  en_construccion: 'En Construccion',
  en_revision: 'En Revision',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
};

const COLOR_ESTADO = {
  en_construccion: '#64748B',
  en_revision: '#D97706',
  aprobada: '#16A34A',
  cerrada: '#64748B',
};

const PRIMARY = '#1F4E78';
const LIGHT = '#D9E1F2';
const GREY = '#EAEAEA';
const GREY_TEXT = '#6B6B6B';

function formatearMoneda(valor) {
  return Number(valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatearFecha(fecha) {
  if (!fecha) return null;
  return new Date(fecha).toLocaleDateString('es', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatearFechaHora(fecha) {
  if (!fecha) return null;
  return new Date(fecha).toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function idCorto(id) {
  return id.slice(0, 8).toUpperCase();
}

// Arma el mismo resumen visual que el PDF (encabezado con logo, barra de
// titulo, datos, tabla de equipos, totales, historico) pero como HTML
// incrustado en el cuerpo del correo -- los clientes de correo ignoran
// <style>, asi que todo va con estilos inline y tablas.
function construirHtmlCorreo({ empresa, carrito, detalles, historico, urlCarrito }) {
  const estadoEtiqueta = ETIQUETAS_ESTADO[carrito.estado];
  const estadoColor = COLOR_ESTADO[carrito.estado];
  const ultimoMovimiento = historico[0];
  const movimientosCronologicos = [...historico].reverse();

  const filasLineas = detalles.map((d) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${d.url ? `<a href="${escapeHtml(d.url)}" style="color:${PRIMARY};text-decoration:underline;">${escapeHtml(d.marca)} ${escapeHtml(d.modelo)}</a>` : `${escapeHtml(d.marca)} ${escapeHtml(d.modelo)}`}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${escapeHtml(d.categoria_nombre || '-')}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${escapeHtml(d.proveedor_nombre || '-')}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;text-align:center;">${d.cantidad_propuesta}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;text-align:center;">${d.cantidad_aprobada ?? '-'}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;text-align:right;">${d.costo_estimado != null ? formatearMoneda(d.costo_estimado) : '-'}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;text-align:right;font-weight:bold;background:${GREY};">${formatearMoneda((d.cantidad_aprobada ?? 0) * (d.costo_estimado ?? 0))}</td>
    </tr>`).join('');

  const filasMovimientos = movimientosCronologicos.map((h) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${h.estado_anterior ? `${ETIQUETAS_ESTADO[h.estado_anterior]} -&gt; ${ETIQUETAS_ESTADO[h.estado_nuevo]}` : `Creado como ${ETIQUETAS_ESTADO[h.estado_nuevo]}`}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${escapeHtml(h.registrado_por_nombre)}</td>
      <td style="padding:6px;border-bottom:1px solid #B7B7B7;font-size:12px;">${formatearFechaHora(h.fecha_cambio)}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#222;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        ${empresa?.logo ? `<td style="width:60px;"><img src="${empresa.logo}" width="50" height="50" style="object-fit:contain;" alt="" /></td>` : ''}
        <td style="font-size:15px;font-weight:bold;color:${PRIMARY};vertical-align:middle;">${escapeHtml(empresa?.nombre || '')}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="10" cellspacing="0" style="background:${PRIMARY};margin-bottom:16px;">
      <tr><td style="color:#fff;font-size:15px;font-weight:bold;text-align:center;">SOLICITUD DE COMPRA &middot; ID ${idCorto(carrito.id)}</td></tr>
    </table>

    <table width="100%" cellpadding="4" cellspacing="0" style="font-size:12.5px;margin-bottom:14px;">
      <tr>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Titulo:</td>
        <td colspan="3">${escapeHtml(carrito.titulo)}</td>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Estado:</td>
        <td style="font-weight:bold;color:${estadoColor};white-space:nowrap;">${estadoEtiqueta}</td>
      </tr>
      <tr>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Fecha Solicitud:</td>
        <td>${formatearFecha(carrito.fecha_solicitud) || '-'}</td>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Fecha Aprobacion:</td>
        <td>${formatearFecha(carrito.fecha_aprobacion) || '-'}</td>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Creado por:</td>
        <td>${escapeHtml(carrito.creado_por_nombre || '-')}</td>
      </tr>
      <tr>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Ultimo cambio por:</td>
        <td>${escapeHtml(ultimoMovimiento?.registrado_por_nombre || carrito.creado_por_nombre || '-')}</td>
        <td style="color:${GREY_TEXT};font-weight:bold;white-space:nowrap;">Fecha del cambio:</td>
        <td colspan="3">${formatearFechaHora(ultimoMovimiento?.fecha_cambio || carrito.created_at) || '-'}</td>
      </tr>
    </table>

    ${carrito.observacion ? `<p style="font-size:12.5px;margin:0 0 14px;"><strong style="color:${GREY_TEXT};">Observacion:</strong><br/>${escapeHtml(carrito.observacion)}</p>` : ''}

    <h3 style="color:${PRIMARY};font-size:13px;margin:0 0 6px;">EQUIPOS DE LA SOLICITUD</h3>
    ${detalles.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px;">
      <tr style="background:${PRIMARY};">
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Equipo</th>
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Categoria</th>
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Proveedor</th>
        <th style="padding:6px;color:#fff;font-size:11px;">Cant. Propuesta</th>
        <th style="padding:6px;color:#fff;font-size:11px;">Cant. Aprobada</th>
        <th style="padding:6px;color:#fff;font-size:11px;">Costo Unit.</th>
        <th style="padding:6px;color:#fff;font-size:11px;">Total</th>
      </tr>
      ${filasLineas}
    </table>` : `<p style="font-size:12.5px;font-style:italic;">No se agregaron equipos a esta solicitud.</p>`}

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px auto;width:320px;">
      <tr>
        <td style="padding:6px;font-size:12px;font-weight:bold;color:${GREY_TEXT};text-align:right;">TOTAL COSTO ESTIMADO PROPUESTO</td>
        <td style="padding:6px;font-size:12.5px;font-weight:bold;text-align:right;background:${LIGHT};">${formatearMoneda(carrito.costo_estimado_propuesto_total)}</td>
      </tr>
      <tr>
        <td style="padding:6px;font-size:12px;font-weight:bold;color:${GREY_TEXT};text-align:right;">TOTAL COSTO ESTIMADO APROBADO</td>
        <td style="padding:6px;font-size:12.5px;font-weight:bold;text-align:right;background:${LIGHT};">${formatearMoneda(carrito.costo_estimado_aprobado_total)}</td>
      </tr>
    </table>

    <h3 style="color:${PRIMARY};font-size:13px;margin:0 0 6px;">HISTORICO DE MOVIMIENTOS</h3>
    ${historico.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
      <tr style="background:${PRIMARY};">
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Movimiento</th>
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Registrado por</th>
        <th style="padding:6px;color:#fff;font-size:11px;text-align:left;">Fecha</th>
      </tr>
      ${filasMovimientos}
    </table>` : `<p style="font-size:12.5px;font-style:italic;">Sin movimientos registrados.</p>`}

    <p style="font-size:11px;color:${GREY_TEXT};">Ver esta solicitud en la aplicacion: <a href="${urlCarrito}">${urlCarrito}</a></p>
  </div>`;
}

const SELECT_BASE = `
  select
    c.*,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    -- Dos columnas independientes y siempre visibles (no una sola que
    -- cambia de significado segun el estado): una proyecta el costo sobre
    -- lo PROPUESTO, la otra sobre lo realmente APROBADO por linea.
    (select coalesce(sum(d.costo_estimado * d.cantidad_propuesta), 0)::numeric from carrito_detalles d where d.carrito_id = c.id) as costo_estimado_propuesto_total,
    (select coalesce(sum(d.costo_estimado * coalesce(d.cantidad_aprobada, 0)), 0)::numeric from carrito_detalles d where d.carrito_id = c.id) as costo_estimado_aprobado_total
  from carritos c
  join usuarios uc on uc.id = c.creado_por
  left join usuarios um on um.id = c.modificado_por
`;

const SELECT_DETALLE = `
  select
    d.*,
    p.nombre as producto_nombre,
    p.categoria_id as categoria_id,
    cat.nombre as categoria_nombre,
    pr.nombre as proveedor_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from carrito_detalles d
  join productos p on p.id = d.producto_id
  left join categorias cat on cat.id = p.categoria_id
  left join proveedores pr on pr.id = d.proveedor_id
  join usuarios uc on uc.id = d.creado_por
  left join usuarios um on um.id = d.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.empresa_id = $1 order by c.created_at desc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/carritos/reporte?desde=&hasta=&estado=
// Dos arreglos en una sola respuesta: "cabeceras" (una fila por carrito,
// con sus totales, para la tabla en pantalla) y "detalles" (una fila por
// linea de equipo, con el carrito al que pertenece) -- para que el
// PDF/Excel pueda mostrar el detalle de equipos sin perder de que orden
// de solicitud viene cada uno.
async function reporte(req, res, next) {
  try {
    const { desde, hasta, estado } = req.query;
    const valores = [req.empresaId, desde || null, hasta || null, estado || null];
    const condiciones = `
      where c.empresa_id = $1
        and ($2::date is null or c.fecha_solicitud >= $2::date)
        and ($3::date is null or c.fecha_solicitud <= $3::date)
        and ($4::text is null or c.estado = $4::text)
    `;

    const { rows: cabeceras } = await pool.query(
      `select
         c.*,
         uc.nombre as creado_por_nombre,
         um.nombre as modificado_por_nombre,
         (select coalesce(sum(d.costo_estimado * d.cantidad_propuesta), 0)::numeric from carrito_detalles d where d.carrito_id = c.id) as costo_estimado_propuesto_total,
         (select coalesce(sum(d.costo_estimado * coalesce(d.cantidad_aprobada, 0)), 0)::numeric from carrito_detalles d where d.carrito_id = c.id) as costo_estimado_aprobado_total,
         -- Quien ejecuto la transicion a "aprobada" -- si se devolvio y se
         -- volvio a aprobar, toma la mas reciente.
         (select u.nombre
          from historico_movimiento_carrito h
          join usuarios u on u.id = h.registrado_por
          where h.carrito_id = c.id and h.estado_nuevo = 'aprobada'
          order by h.fecha_cambio desc
          limit 1) as aprobado_por_nombre
       from carritos c
       join usuarios uc on uc.id = c.creado_por
       left join usuarios um on um.id = c.modificado_por
       ${condiciones}
       order by c.fecha_solicitud desc`,
      valores
    );

    const { rows: detalles } = await pool.query(
      `select
         cd.id,
         cd.carrito_id,
         c.titulo as carrito_titulo,
         c.estado as carrito_estado,
         c.fecha_solicitud as carrito_fecha_solicitud,
         cat.nombre as categoria_nombre,
         cd.marca,
         cd.modelo,
         prov.nombre as proveedor_nombre,
         cd.cantidad_propuesta,
         cd.cantidad_aprobada,
         cd.costo_estimado
       from carrito_detalles cd
       join carritos c on c.id = cd.carrito_id
       left join productos p on p.id = cd.producto_id
       left join categorias cat on cat.id = p.categoria_id
       left join proveedores prov on prov.id = cd.proveedor_id
       ${condiciones}
       order by c.fecha_solicitud desc, cd.created_at asc`,
      valores
    );

    res.json({ cabeceras, detalles });
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where c.id = $1 and c.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows: detalles } = await pool.query(
      `${SELECT_DETALLE} where d.carrito_id = $1 order by d.created_at asc`,
      [req.params.id]
    );

    res.json({ ...rows[0], detalles });
  } catch (err) { next(err); }
}

// Registra una entrada en el historico -- mismo patron que
// equipos_historial, se llena a mano en cada punto donde el estado
// realmente cambia, nunca con un trigger.
async function registrarMovimiento(carritoId, estadoAnterior, estadoNuevo, usuarioId) {
  await pool.query(
    `insert into historico_movimiento_carrito (carrito_id, estado_anterior, estado_nuevo, registrado_por)
     values ($1, $2, $3, $4)`,
    [carritoId, estadoAnterior, estadoNuevo, usuarioId]
  );
}

async function crear(req, res, next) {
  try {
    const { titulo, fecha_solicitud, observacion } = req.body;
    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ mensaje: 'El titulo es requerido' });
    }

    const { rows } = await pool.query(
      `insert into carritos (empresa_id, titulo, fecha_solicitud, observacion, creado_por)
       values ($1, $2, coalesce($3, current_date), $4, $5)
       returning id`,
      [req.empresaId, titulo.trim(), fecha_solicitud || null, observacion ? observacion.trim() : null, req.usuario.id]
    );
    await registrarMovimiento(rows[0].id, null, 'en_construccion', req.usuario.id);

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { titulo, fecha_solicitud, observacion } = req.body;
    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ mensaje: 'El titulo es requerido' });
    }

    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (actual[0].estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se puede editar un carrito mientras esta "En Construccion"' });
    }

    await pool.query(
      `update carritos set titulo = $1, fecha_solicitud = coalesce($2, fecha_solicitud), observacion = $3, modificado_por = $4
       where id = $5 and empresa_id = $6`,
      [titulo.trim(), fecha_solicitud || null, observacion ? observacion.trim() : null, req.usuario.id, req.params.id, req.empresaId]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// La contrasena de la sesion actual ya se verifico en el middleware
// requirePassword (ver carritos.routes.js) antes de llegar aqui.
async function eliminar(req, res, next) {
  try {
    const { rowCount } = await pool.query(
      'delete from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    res.json({ ok: true, mensaje: 'Carrito eliminado correctamente' });
  } catch (err) { next(err); }
}

// POST /:id/avanzar  { estado }
// El frontend solo ofrece un boton con el UNICO siguiente estado valido,
// pero igual se revalida aqui contra el estado actual en BD -- asi
// saltarse pasos queda estructuralmente imposible, no solo validado.
async function avanzarEstado(req, res, next) {
  try {
    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const idxActual = ORDEN_ESTADOS.indexOf(actual[0].estado);
    const siguiente = ORDEN_ESTADOS[idxActual + 1];
    if (!siguiente) return res.status(400).json({ mensaje: 'El carrito ya esta en su ultimo estado' });
    if (req.body.estado !== siguiente) {
      return res.status(400).json({ mensaje: `Solo se puede avanzar a "${siguiente}" desde el estado actual` });
    }

    const esAprobacion = siguiente === 'aprobada';
    const { rows } = await pool.query(
      `update carritos set
         estado = $1,
         fecha_aprobacion = case when $2 then coalesce(fecha_aprobacion, current_date) else fecha_aprobacion end,
         modificado_por = $3
       where id = $4 and empresa_id = $5
       returning id`,
      [siguiente, esAprobacion, req.usuario.id, req.params.id, req.empresaId]
    );
    await registrarMovimiento(rows[0].id, actual[0].estado, siguiente, req.usuario.id);

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// POST /:id/retroceder  { estado }
// Permite corregir un avance equivocado, salvo la transicion final: una
// vez "cerrada" el carrito queda bloqueado para siempre (ver
// ORDEN_ESTADOS -- no hay "anterior" valido desde el ultimo estado).
async function retrocederEstado(req, res, next) {
  try {
    const { rows: actual } = await pool.query(
      'select estado from carritos where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    if (actual[0].estado === 'cerrada') {
      return res.status(400).json({ mensaje: 'Un carrito "Cerrado" no se puede reabrir' });
    }

    const idxActual = ORDEN_ESTADOS.indexOf(actual[0].estado);
    const anterior = ORDEN_ESTADOS[idxActual - 1];
    if (!anterior) return res.status(400).json({ mensaje: 'El carrito ya esta en su primer estado' });
    if (req.body.estado !== anterior) {
      return res.status(400).json({ mensaje: `Solo se puede devolver a "${anterior}" desde el estado actual` });
    }

    // Al devolver desde "aprobada" se limpia fecha_aprobacion -- si mas
    // adelante se vuelve a aprobar, debe quedar la fecha de ESA
    // aprobacion, no la de un intento anterior que se corrigio.
    const limpiarFechaAprobacion = actual[0].estado === 'aprobada';
    const { rows } = await pool.query(
      `update carritos set
         estado = $1,
         fecha_aprobacion = case when $2 then null else fecha_aprobacion end,
         modificado_por = $3
       where id = $4 and empresa_id = $5
       returning id`,
      [anterior, limpiarFechaAprobacion, req.usuario.id, req.params.id, req.empresaId]
    );
    await registrarMovimiento(rows[0].id, actual[0].estado, anterior, req.usuario.id);

    const { rows: completo } = await pool.query(`${SELECT_BASE} where c.id = $1`, [rows[0].id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

// GET /:id/historico
async function listarHistorico(req, res, next) {
  try {
    if (!(await verificarCarrito(req))) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows } = await pool.query(
      `select h.*, u.nombre as registrado_por_nombre
       from historico_movimiento_carrito h
       join usuarios u on u.id = h.registrado_por
       where h.carrito_id = $1
       order by h.fecha_cambio desc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /destinatarios -- usuarios de la empresa activa para elegir a quien
// mandarle una solicitud por correo. Endpoint propio (no el de /usuarios)
// para que baste el permiso de carrito_compras y no el de usuarios.
async function listarDestinatarios(req, res, next) {
  try {
    const { rows } = await pool.query(
      `select u.id, u.nombre, u.email
       from usuarios u
       join usuarios_empresas_rol uer on uer.usuario_id = u.id
       where uer.empresa_id = $1 and u.activo = true
       order by u.nombre`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// POST /:id/enviar-correo  { destinatarios: string[] }
// A diferencia del checklist (que manda un PDF ya armado por el
// frontend), aqui todo el contenido sale de la BD -- se arma el mismo
// resumen visual que el PDF pero como HTML incrustado en el cuerpo.
async function enviarPorCorreoHtml(req, res, next) {
  try {
    const destinatarios = Array.isArray(req.body?.destinatarios)
      ? req.body.destinatarios.map((d) => String(d || '').trim()).filter(Boolean)
      : [];
    if (!destinatarios.length || !destinatarios.every((d) => EMAIL_REGEX.test(d))) {
      return res.status(400).json({ mensaje: 'Selecciona al menos un destinatario valido' });
    }

    const { rows: carritoRows } = await pool.query(
      `${SELECT_BASE} where c.id = $1 and c.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!carritoRows[0]) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    const carrito = carritoRows[0];

    // Asunto y observacion se pueden ajustar solo para este envio -- no
    // se guardan de vuelta en el carrito, son del correo nada mas.
    const asuntoPersonalizado = typeof req.body?.asunto === 'string' ? req.body.asunto.trim() : '';
    if (typeof req.body?.observacion === 'string') {
      carrito.observacion = req.body.observacion.trim() || null;
    }

    const { rows: detalles } = await pool.query(
      `${SELECT_DETALLE} where d.carrito_id = $1 order by d.created_at asc`,
      [req.params.id]
    );
    const { rows: historico } = await pool.query(
      `select h.*, u.nombre as registrado_por_nombre
       from historico_movimiento_carrito h
       join usuarios u on u.id = h.registrado_por
       where h.carrito_id = $1
       order by h.fecha_cambio desc`,
      [req.params.id]
    );
    const { rows: empresaRows } = await pool.query('select nombre, logo from empresas where id = $1', [req.empresaId]);

    const urlCarrito = `${process.env.CORS_ORIGIN || 'http://localhost:4200'}/carrito-compras?id=${carrito.id}`;
    const html = construirHtmlCorreo({ empresa: empresaRows[0], carrito, detalles, historico, urlCarrito });
    const asunto = asuntoPersonalizado || `Solicitud de Compra - ID ${idCorto(carrito.id)}`;

    await enviarCorreo({
      destinatario: destinatarios,
      asunto,
      texto: `Solicitud de compra "${carrito.titulo}". Verla en la aplicacion: ${urlCarrito}`,
      html,
    });

    res.json({ ok: true, mensaje: 'Correo enviado correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// DETALLES (lineas de equipos a comprar)
// -------------------------------------------------------------

async function verificarCarrito(req) {
  const { rows } = await pool.query(
    'select id, estado from carritos where id = $1 and empresa_id = $2',
    [req.params.id, req.empresaId]
  );
  return rows[0] || null;
}

async function listarDetalles(req, res, next) {
  try {
    if (!(await verificarCarrito(req))) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows } = await pool.query(
      `${SELECT_DETALLE} where d.carrito_id = $1 order by d.created_at asc`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (carrito.estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se pueden agregar lineas mientras el carrito esta "En Construccion"' });
    }

    const { producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion } = req.body;
    if (!producto_id || !marca || !marca.trim() || !modelo || !modelo.trim()) {
      return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
    }
    if (!cantidad_propuesta || Number(cantidad_propuesta) <= 0) {
      return res.status(400).json({ mensaje: 'La cantidad propuesta debe ser mayor a cero' });
    }
    if (costo_estimado !== undefined && costo_estimado !== null && Number(costo_estimado) < 0) {
      return res.status(400).json({ mensaje: 'El costo estimado no puede ser negativo' });
    }

    const { rows: prod } = await pool.query('select id from productos where id = $1', [producto_id]);
    if (!prod[0]) return res.status(400).json({ mensaje: 'El producto seleccionado no existe' });

    if (proveedor_id) {
      const { rows: prov } = await pool.query(
        'select id from proveedores where id = $1 and empresa_id = $2',
        [proveedor_id, req.empresaId]
      );
      if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });
    }

    const { rows } = await pool.query(
      `insert into carrito_detalles
         (carrito_id, producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion, creado_por)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        req.params.id,
        producto_id,
        marca.trim(),
        modelo.trim(),
        url ? url.trim() : null,
        proveedor_id || null,
        cantidad_propuesta,
        costo_estimado ?? null,
        observacion ? observacion.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_DETALLE} where d.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });

    const { rows: det } = await pool.query(
      'select id from carrito_detalles where id = $1 and carrito_id = $2',
      [req.params.detalleId, req.params.id]
    );
    if (!det[0]) return res.status(404).json({ mensaje: 'Linea no encontrada' });

    // Dos tipos de edicion sobre la misma linea: la edicion COMPLETA del
    // equipo (producto/marca/modelo/etc, via el popup) solo mientras esta
    // en_construccion; y la carga rapida de cantidad_aprobada/observacion
    // (inline, en la tarjeta), permitida en cualquier estado anterior a
    // "aprobada" -- se distinguen por si el body trae producto_id o no.
    const esEdicionCompleta = req.body.producto_id !== undefined;

    if (esEdicionCompleta) {
      if (carrito.estado !== 'en_construccion') {
        return res.status(400).json({ mensaje: 'Solo se puede editar el equipo completo mientras el carrito esta "En Construccion"' });
      }

      const { producto_id, marca, modelo, url, proveedor_id, cantidad_propuesta, costo_estimado, observacion } = req.body;
      if (!producto_id || !marca || !marca.trim() || !modelo || !modelo.trim()) {
        return res.status(400).json({ mensaje: 'producto_id, marca y modelo son requeridos' });
      }
      if (!cantidad_propuesta || Number(cantidad_propuesta) <= 0) {
        return res.status(400).json({ mensaje: 'La cantidad propuesta debe ser mayor a cero' });
      }
      if (costo_estimado !== undefined && costo_estimado !== null && Number(costo_estimado) < 0) {
        return res.status(400).json({ mensaje: 'El costo estimado no puede ser negativo' });
      }

      const { rows: prod } = await pool.query('select id from productos where id = $1', [producto_id]);
      if (!prod[0]) return res.status(400).json({ mensaje: 'El producto seleccionado no existe' });

      if (proveedor_id) {
        const { rows: prov } = await pool.query(
          'select id from proveedores where id = $1 and empresa_id = $2',
          [proveedor_id, req.empresaId]
        );
        if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });
      }

      await pool.query(
        `update carrito_detalles set
           producto_id = $1, marca = $2, modelo = $3, url = $4, proveedor_id = $5,
           cantidad_propuesta = $6, costo_estimado = $7, observacion = $8, modificado_por = $9
         where id = $10`,
        [
          producto_id,
          marca.trim(),
          modelo.trim(),
          url ? url.trim() : null,
          proveedor_id || null,
          cantidad_propuesta,
          costo_estimado ?? null,
          observacion ? observacion.trim() : null,
          req.usuario.id,
          req.params.detalleId,
        ]
      );
    } else {
      if (carrito.estado === 'aprobada' || carrito.estado === 'cerrada') {
        return res.status(400).json({ mensaje: 'Las lineas de un carrito "Aprobado" o "Cerrado" no se pueden editar' });
      }

      const { cantidad_aprobada, observacion } = req.body;
      if (cantidad_aprobada !== undefined && cantidad_aprobada !== null && Number(cantidad_aprobada) < 0) {
        return res.status(400).json({ mensaje: 'La cantidad aprobada no puede ser negativa' });
      }

      // Solo se actualiza el campo que realmente llego en el body -- el
      // inline de cantidad aprobada y el de observacion se guardan cada
      // uno por separado (onBlur), as que uno no debe pisar al otro.
      const campos = [];
      const valores = [];
      if ('cantidad_aprobada' in req.body) {
        campos.push(`cantidad_aprobada = $${campos.length + 1}`);
        valores.push(cantidad_aprobada ?? null);
      }
      if ('observacion' in req.body) {
        campos.push(`observacion = $${campos.length + 1}`);
        valores.push(observacion ? observacion.trim() : null);
      }
      campos.push(`modificado_por = $${campos.length + 1}`);
      valores.push(req.usuario.id);
      valores.push(req.params.detalleId);

      await pool.query(
        `update carrito_detalles set ${campos.join(', ')} where id = $${valores.length}`,
        valores
      );
    }

    const { rows: completo } = await pool.query(`${SELECT_DETALLE} where d.id = $1`, [req.params.detalleId]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarDetalle(req, res, next) {
  try {
    const carrito = await verificarCarrito(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito no encontrado' });
    if (carrito.estado !== 'en_construccion') {
      return res.status(400).json({ mensaje: 'Solo se pueden eliminar lineas mientras el carrito esta "En Construccion"' });
    }

    const { rowCount } = await pool.query(
      'delete from carrito_detalles where id = $1 and carrito_id = $2',
      [req.params.detalleId, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Linea no encontrada' });
    res.json({ ok: true, mensaje: 'Linea eliminada correctamente' });
  } catch (err) { next(err); }
}

// -------------------------------------------------------------
// COTIZACIONES (propuestas de precio por linea -- mas de una, cada una
// de un proveedor, para comparar antes de aprobar)
// -------------------------------------------------------------

const SELECT_COTIZACION = `
  select
    q.*,
    pr.nombre as proveedor_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre
  from carrito_cotizaciones q
  join proveedores pr on pr.id = q.proveedor_id
  join usuarios uc on uc.id = q.creado_por
  left join usuarios um on um.id = q.modificado_por
`;

// Verifica el carrito (empresa) y que la linea realmente le pertenezca --
// mismo criterio de dos pasos que verificarCarrito, uno mas abajo en la
// jerarquia (cotizacion -> linea -> carrito).
async function verificarDetalle(req) {
  const carrito = await verificarCarrito(req);
  if (!carrito) return null;
  const { rows } = await pool.query(
    'select id from carrito_detalles where id = $1 and carrito_id = $2',
    [req.params.detalleId, req.params.id]
  );
  return rows[0] ? carrito : null;
}

async function listarCotizaciones(req, res, next) {
  try {
    if (!(await verificarDetalle(req))) return res.status(404).json({ mensaje: 'Carrito o linea no encontrada' });

    const { rows } = await pool.query(
      `${SELECT_COTIZACION} where q.carrito_detalle_id = $1 order by q.created_at asc`,
      [req.params.detalleId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function crearCotizacion(req, res, next) {
  try {
    const carrito = await verificarDetalle(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito o linea no encontrada' });
    if (carrito.estado === 'aprobada' || carrito.estado === 'cerrada') {
      return res.status(400).json({ mensaje: 'Las cotizaciones de un carrito "Aprobado" o "Cerrado" no se pueden editar' });
    }

    const { proveedor_id, costo_unitario, fecha, numero_cotizacion, url, contacto_nombre, contacto_correo, contacto_telefono, observacion } = req.body;
    if (!proveedor_id) return res.status(400).json({ mensaje: 'El proveedor es requerido' });
    if (costo_unitario === undefined || costo_unitario === null || Number(costo_unitario) < 0) {
      return res.status(400).json({ mensaje: 'El costo unitario debe ser mayor o igual a cero' });
    }

    const { rows: prov } = await pool.query(
      'select id from proveedores where id = $1 and empresa_id = $2',
      [proveedor_id, req.empresaId]
    );
    if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });

    const { rows } = await pool.query(
      `insert into carrito_cotizaciones
         (carrito_detalle_id, proveedor_id, costo_unitario, fecha, numero_cotizacion, url, contacto_nombre, contacto_correo, contacto_telefono, observacion, creado_por)
       values ($1, $2, $3, coalesce($4, current_date), $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        req.params.detalleId,
        proveedor_id,
        costo_unitario,
        fecha || null,
        numero_cotizacion ? numero_cotizacion.trim() : null,
        url ? url.trim() : null,
        contacto_nombre ? contacto_nombre.trim() : null,
        contacto_correo ? contacto_correo.trim() : null,
        contacto_telefono ? contacto_telefono.trim() : null,
        observacion ? observacion.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_COTIZACION} where q.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizarCotizacion(req, res, next) {
  try {
    const carrito = await verificarDetalle(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito o linea no encontrada' });
    if (carrito.estado === 'aprobada' || carrito.estado === 'cerrada') {
      return res.status(400).json({ mensaje: 'Las cotizaciones de un carrito "Aprobado" o "Cerrado" no se pueden editar' });
    }

    const { rows: cot } = await pool.query(
      'select id from carrito_cotizaciones where id = $1 and carrito_detalle_id = $2',
      [req.params.cotizacionId, req.params.detalleId]
    );
    if (!cot[0]) return res.status(404).json({ mensaje: 'Cotizacion no encontrada' });

    const { proveedor_id, costo_unitario, fecha, numero_cotizacion, url, contacto_nombre, contacto_correo, contacto_telefono, observacion } = req.body;
    if (!proveedor_id) return res.status(400).json({ mensaje: 'El proveedor es requerido' });
    if (costo_unitario === undefined || costo_unitario === null || Number(costo_unitario) < 0) {
      return res.status(400).json({ mensaje: 'El costo unitario debe ser mayor o igual a cero' });
    }

    const { rows: prov } = await pool.query(
      'select id from proveedores where id = $1 and empresa_id = $2',
      [proveedor_id, req.empresaId]
    );
    if (!prov[0]) return res.status(400).json({ mensaje: 'El proveedor seleccionado no existe o no pertenece a la empresa' });

    await pool.query(
      `update carrito_cotizaciones set
         proveedor_id = $1, costo_unitario = $2, fecha = coalesce($3, fecha), numero_cotizacion = $4,
         url = $5, contacto_nombre = $6, contacto_correo = $7, contacto_telefono = $8, observacion = $9, modificado_por = $10
       where id = $11`,
      [
        proveedor_id,
        costo_unitario,
        fecha || null,
        numero_cotizacion ? numero_cotizacion.trim() : null,
        url ? url.trim() : null,
        contacto_nombre ? contacto_nombre.trim() : null,
        contacto_correo ? contacto_correo.trim() : null,
        contacto_telefono ? contacto_telefono.trim() : null,
        observacion ? observacion.trim() : null,
        req.usuario.id,
        req.params.cotizacionId,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_COTIZACION} where q.id = $1`, [req.params.cotizacionId]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminarCotizacion(req, res, next) {
  try {
    const carrito = await verificarDetalle(req);
    if (!carrito) return res.status(404).json({ mensaje: 'Carrito o linea no encontrada' });
    if (carrito.estado === 'aprobada' || carrito.estado === 'cerrada') {
      return res.status(400).json({ mensaje: 'Las cotizaciones de un carrito "Aprobado" o "Cerrado" no se pueden editar' });
    }

    const { rowCount } = await pool.query(
      'delete from carrito_cotizaciones where id = $1 and carrito_detalle_id = $2',
      [req.params.cotizacionId, req.params.detalleId]
    );
    if (!rowCount) return res.status(404).json({ mensaje: 'Cotizacion no encontrada' });
    res.json({ ok: true, mensaje: 'Cotizacion eliminada correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  reporte,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  avanzarEstado,
  retrocederEstado,
  listarHistorico,
  enviarPorCorreoHtml,
  listarDestinatarios,
  listarDetalles,
  crearDetalle,
  actualizarDetalle,
  eliminarDetalle,
  listarCotizaciones,
  crearCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
};
