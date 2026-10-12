const { pool } = require('../config/db');

const SELECT_BASE = `
  select
    p.*,
    coalesce(sec.nombre, p.sector) as sector_nombre,
    uc.nombre as creado_por_nombre,
    um.nombre as modificado_por_nombre,
    (select count(*)::int from servicios_proveedores sp where sp.proveedor_id = p.id) as servicios_count
  from proveedores p
  left join sectores_proveedores sec on sec.id = p.sector_id
  join usuarios uc on uc.id = p.creado_por
  left join usuarios um on um.id = p.modificado_por
`;

async function listar(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where p.empresa_id = $1 order by p.nombre asc`,
      [req.empresaId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function obtenerPorId(req, res, next) {
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} where p.id = $1 and p.empresa_id = $2`,
      [req.params.id, req.empresaId]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, contactos, sector, sector_id, url } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del proveedor es requerido' });
    }

    let sectorIdFinal = sector_id || null;
    let sectorNombreFinal = sector || null;

    if (sectorIdFinal) {
      const { rows: sec } = await pool.query(
        'select nombre from sectores_proveedores where id = $1 and empresa_id = $2',
        [sectorIdFinal, req.empresaId]
      );
      if (sec[0]) sectorNombreFinal = sec[0].nombre;
    }

    const contactosJson = JSON.stringify(Array.isArray(contactos) ? contactos : []);

    const { rows } = await pool.query(
      `insert into proveedores
         (empresa_id, nombre, descripcion, contactos, sector, sector_id, url, creado_por)
       values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       returning id`,
      [
        req.empresaId,
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        contactosJson,
        sectorNombreFinal || 'Otro',
        sectorIdFinal,
        url ? url.trim() : null,
        req.usuario.id,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where p.id = $1`, [rows[0].id]);
    res.status(201).json(completo[0]);
  } catch (err) { next(err); }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, descripcion, contactos, sector, sector_id, url } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del proveedor es requerido' });
    }

    const { rows: actual } = await pool.query(
      'select id from proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );
    if (!actual[0]) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });

    let sectorIdFinal = sector_id || null;
    let sectorNombreFinal = sector || null;

    if (sectorIdFinal) {
      const { rows: sec } = await pool.query(
        'select nombre from sectores_proveedores where id = $1 and empresa_id = $2',
        [sectorIdFinal, req.empresaId]
      );
      if (sec[0]) sectorNombreFinal = sec[0].nombre;
    }

    const contactosJson = JSON.stringify(Array.isArray(contactos) ? contactos : []);

    await pool.query(
      `update proveedores set
         nombre = $1,
         descripcion = $2,
         contactos = $3::jsonb,
         sector = $4,
         sector_id = $5,
         url = $6,
         modificado_por = $7
       where id = $8 and empresa_id = $9`,
      [
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        contactosJson,
        sectorNombreFinal || 'Otro',
        sectorIdFinal,
        url ? url.trim() : null,
        req.usuario.id,
        req.params.id,
        req.empresaId,
      ]
    );

    const { rows: completo } = await pool.query(`${SELECT_BASE} where p.id = $1`, [req.params.id]);
    res.json(completo[0]);
  } catch (err) { next(err); }
}

async function eliminar(req, res, next) {
  try {
    const { rows: servicios } = await pool.query(
      'select count(*)::int as count from servicios_proveedores where proveedor_id = $1',
      [req.params.id]
    );

    if (servicios[0] && servicios[0].count > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar el proveedor porque tiene ${servicios[0].count} servicio(s) asociado(s).`
      });
    }

    const { rowCount } = await pool.query(
      'delete from proveedores where id = $1 and empresa_id = $2',
      [req.params.id, req.empresaId]
    );

    if (!rowCount) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json({ ok: true, mensaje: 'Proveedor eliminado correctamente' });
  } catch (err) { next(err); }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};
