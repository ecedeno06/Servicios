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
      'select id, nombre, email, password_hash, rol, activo, avatar from usuarios where email = $1',
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

    const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, avatar: usuario.avatar };
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }, process.env.JWT_SECRET, {
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
      'select id, nombre, email, rol, activo, avatar, created_at from usuarios where id = $1',
      [req.usuario.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/me  { avatar }  -> actualiza el avatar (base64) del usuario autenticado
async function actualizarPerfil(req, res, next) {
  try {
    const { avatar } = req.body;
    const { rows } = await pool.query(
      `update usuarios set avatar = $1 where id = $2
       returning id, nombre, email, rol, activo, avatar`,
      [avatar ?? null, req.usuario.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/password  { password_actual, password_nueva } -> cambia la password propia
async function cambiarPassword(req, res, next) {
  try {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ mensaje: 'password_actual y password_nueva son requeridos' });
    }
    if (password_nueva.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva contrasena debe tener al menos 6 caracteres' });
    }

    const { rows } = await pool.query('select password_hash from usuarios where id = $1', [req.usuario.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const passwordOk = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!passwordOk) {
      return res.status(401).json({ mensaje: 'La contrasena actual no es correcta' });
    }

    const password_hash = await bcrypt.hash(password_nueva, 10);
    await pool.query('update usuarios set password_hash = $1 where id = $2', [password_hash, req.usuario.id]);

    res.json({ mensaje: 'Contrasena actualizada correctamente' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, me, actualizarPerfil, cambiarPassword };
