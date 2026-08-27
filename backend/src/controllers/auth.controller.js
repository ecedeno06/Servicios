const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y password son requeridos' });
    }

    const { rows } = await pool.query(
      'select id, nombre, email, password_hash, rol, activo from usuarios where email = $1',
      [email]
    );
    const usuario = rows[0];

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: 'Credenciales invalidas' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ mensaje: 'Credenciales invalidas' });
    }

    const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({ token, usuario: payload });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/register  (crear usuarios del sistema - normalmente solo un admin)
async function register(req, res, next) {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'nombre, email y password son requeridos' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `insert into usuarios (nombre, email, password_hash, rol)
       values ($1, $2, $3, coalesce($4, 'tecnico'))
       returning id, nombre, email, rol, activo, created_at`,
      [nombre, email, password_hash, rol]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select id, nombre, email, rol, activo, created_at from usuarios where id = $1',
      [req.usuario.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, me };
