const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { pool } = require('../config/db');
const { obtenerPolitica, validarPassword, validarPista } = require('../utils/politicaPassword');
const { enviarCorreo } = require('../utils/correo');
const { obtenerIpCliente } = require('../utils/geoip');
const { crearSesion, reemplazarTokenSesion, cerrarSesionActual } = require('../utils/sesiones');
const { crearTokenReset } = require('../utils/passwordResetToken');
const { encriptar, desencriptar } = require('../utils/cifrado2fa');

function firmarToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '8h' });
}

function expiracionDeToken(token) {
  return new Date(jwt.decode(token).exp * 1000);
}

// POST /api/auth/login
// Si el usuario tiene 2FA activo, responde { requiere2FA, usuarioId } y el
// frontend debe llamar a /auth/2fa/verify-login con el codigo antes de
// continuar. Si no, sigue el flujo de siempre: si pertenece a una sola
// empresa activa, entrega el JWT final directamente; si pertenece a
// varias, entrega un token parcial + la lista de empresas, y el frontend
// debe llamar a /auth/seleccionar-empresa para completar el login.
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y password son requeridos' });
    }

    const { rows } = await pool.query(
      'select id, nombre, email, password_hash, activo, avatar, es_super_admin, debe_cambiar_password, two_factor_enabled from usuarios where email = $1',
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

    if (usuario.two_factor_enabled) {
      return res.json({ requiere2FA: true, usuarioId: usuario.id });
    }

    return await continuarLoginTrasPassword(usuario, req, res);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/verify-login  { usuarioId, code }  (publico -- el
// usuarioId ya viene validado por contrasena, lo devolvio POST /auth/login
// al detectar 2FA activo, asi que no hace falta pedir el email de nuevo).
async function verificar2FA(req, res, next) {
  try {
    const { usuarioId, code } = req.body;
    if (!usuarioId || !code) {
      return res.status(400).json({ mensaje: 'usuarioId y code son requeridos' });
    }

    const { rows } = await pool.query(
      'select id, nombre, email, activo, avatar, es_super_admin, debe_cambiar_password, two_factor_enabled, two_factor_secret from usuarios where id = $1',
      [usuarioId]
    );
    const usuario = rows[0];

    if (!usuario || !usuario.activo || !usuario.two_factor_enabled || !usuario.two_factor_secret) {
      return res.status(401).json({ mensaje: 'Sesion invalida, inicia sesion nuevamente' });
    }

    const secret = desencriptar(usuario.two_factor_secret);
    const esValido = authenticator.check(String(code).trim(), secret);
    if (!esValido) {
      return res.status(401).json({ mensaje: 'Codigo invalido' });
    }

    return await continuarLoginTrasPassword(usuario, req, res);
  } catch (err) {
    next(err);
  }
}

// Continua el login despues de validar password (o codigo 2FA): resuelve
// la(s) empresa(s) del usuario y emite el JWT final, o el token parcial de
// seleccion de empresa si tiene mas de una. Compartido entre login() y
// verificar2FA().
async function continuarLoginTrasPassword(usuario, req, res) {
  const ip = obtenerIpCliente(req);

  // Un super-admin elige SIEMPRE la empresa activa al iniciar sesion (incluso
  // si solo tiene una), viendo todas las empresas del sistema -- la unica
  // forma de cambiar de empresa activa es cerrando sesion y volviendo a
  // entrar (ver seleccionarEmpresa: no se permite el cambio "en caliente").
  if (usuario.es_super_admin) {
    const { rows: todasEmpresas } = await pool.query(
      `select e.id as empresa_id, e.nombre as empresa_nombre,
              coalesce(uer.rol, 'admin') as rol
       from empresas e
       left join usuarios_empresas_rol uer
              on uer.empresa_id = e.id and uer.usuario_id = $1
       where e.activo = true
       order by e.nombre`,
      [usuario.id]
    );

    if (todasEmpresas.length === 0) {
      const payload = {
        id: usuario.id, nombre: usuario.nombre, email: usuario.email,
        rol: null, empresa_id: null, empresa_nombre: null, empresa_logo: null,
        es_super_admin: true, avatar: usuario.avatar, debe_cambiar_password: usuario.debe_cambiar_password,
      };
      const token = firmarToken({
        id: payload.id, nombre: payload.nombre, email: payload.email,
        rol: null, empresa_id: null, es_super_admin: true, debe_cambiar_password: usuario.debe_cambiar_password,
      });
      await crearSesion({ token, usuarioId: usuario.id, empresaId: null, rol: null, ip, expiraEn: expiracionDeToken(token) });
      return res.json({ token, usuario: payload });
    }

    const tokenParcial = firmarToken(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, parcial: true },
      '10m'
    );
    return res.json({
      requiereSeleccionEmpresa: true,
      tokenParcial,
      empresas: todasEmpresas.map((e) => ({ empresa_id: e.empresa_id, empresa_nombre: e.empresa_nombre, rol: e.rol })),
    });
  }

  const { rows: empresas } = await pool.query(
    `select uer.empresa_id, uer.rol, uer.cliente_id, e.nombre as empresa_nombre, e.logo as empresa_logo
     from usuarios_empresas_rol uer
     join empresas e on e.id = uer.empresa_id
     where uer.usuario_id = $1 and e.activo = true
     order by e.nombre`,
    [usuario.id]
  );

  if (empresas.length === 0) {
    return res.status(401).json({ mensaje: 'El usuario no tiene ninguna empresa asignada' });
  }

  if (empresas.length > 1) {
    const tokenParcial = firmarToken(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, parcial: true },
      '10m'
    );
    return res.json({
      requiereSeleccionEmpresa: true,
      tokenParcial,
      empresas: empresas.map((e) => ({ empresa_id: e.empresa_id, empresa_nombre: e.empresa_nombre, rol: e.rol })),
    });
  }

  const empresaActiva = empresas[0];
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: empresaActiva ? empresaActiva.rol : null,
    empresa_id: empresaActiva ? empresaActiva.empresa_id : null,
    empresa_nombre: empresaActiva ? empresaActiva.empresa_nombre : null,
    empresa_logo: empresaActiva ? empresaActiva.empresa_logo : null,
    es_super_admin: usuario.es_super_admin,
    avatar: usuario.avatar,
    debe_cambiar_password: usuario.debe_cambiar_password,
  };
  const token = firmarToken({
    id: payload.id,
    nombre: payload.nombre,
    email: payload.email,
    rol: payload.rol,
    empresa_id: payload.empresa_id,
    cliente_id: empresaActiva ? empresaActiva.cliente_id : null,
    es_super_admin: payload.es_super_admin,
    debe_cambiar_password: payload.debe_cambiar_password,
  });
  await crearSesion({ token, usuarioId: usuario.id, empresaId: payload.empresa_id, rol: payload.rol, ip, expiraEn: expiracionDeToken(token) });

  return res.json({ token, usuario: payload });
}

// POST /api/auth/seleccionar-empresa  { empresa_id }
// Solo completa un login pendiente de seleccion de empresa (token parcial).
// No permite cambiar de empresa activa "en caliente" con una sesion ya
// completa -- para eso hay que cerrar sesion y volver a entrar.
async function seleccionarEmpresa(req, res, next) {
  try {
    if (!req.usuario.parcial) {
      return res.status(403).json({ mensaje: 'Para cambiar de empresa activa cierra sesion y vuelve a entrar.' });
    }

    const { empresa_id } = req.body;
    if (!empresa_id) return res.status(400).json({ mensaje: 'empresa_id es requerido' });

    const { rows: usuarioRows } = await pool.query(
      'select id, nombre, email, avatar, es_super_admin, debe_cambiar_password from usuarios where id = $1',
      [req.usuario.id]
    );
    const usuario = usuarioRows[0];

    const { rows: relacion } = await pool.query(
      `select uer.rol, uer.cliente_id, e.nombre as empresa_nombre, e.logo as empresa_logo
       from usuarios_empresas_rol uer
       join empresas e on e.id = uer.empresa_id
       where uer.usuario_id = $1 and uer.empresa_id = $2 and e.activo = true`,
      [req.usuario.id, empresa_id]
    );

    let rol, clienteId, empresaNombre, empresaLogo;
    if (relacion[0]) {
      rol = relacion[0].rol;
      clienteId = relacion[0].cliente_id;
      empresaNombre = relacion[0].empresa_nombre;
      empresaLogo = relacion[0].empresa_logo;
    } else if (usuario.es_super_admin) {
      // Un super-admin puede entrar a cualquier empresa aunque no tenga
      // membresia formal (ej. para dar de alta al primer usuario real de
      // una empresa recien creada). No se crea fila en usuarios_empresas_rol:
      // es acceso de sesion, no una membresia persistida.
      const { rows: empresaRows } = await pool.query('select nombre, logo from empresas where id = $1 and activo = true', [empresa_id]);
      if (!empresaRows[0]) return res.status(404).json({ mensaje: 'Empresa no encontrada' });
      rol = 'admin';
      clienteId = null;
      empresaNombre = empresaRows[0].nombre;
      empresaLogo = empresaRows[0].logo;
    } else {
      return res.status(403).json({ mensaje: 'No tienes acceso a esa empresa' });
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol,
      empresa_id,
      empresa_nombre: empresaNombre,
      empresa_logo: empresaLogo,
      es_super_admin: usuario.es_super_admin,
      avatar: usuario.avatar,
      debe_cambiar_password: usuario.debe_cambiar_password,
    };
    const token = firmarToken({
      id: payload.id,
      nombre: payload.nombre,
      email: payload.email,
      rol: payload.rol,
      empresa_id: payload.empresa_id,
      cliente_id: clienteId,
      es_super_admin: payload.es_super_admin,
      debe_cambiar_password: payload.debe_cambiar_password,
    });
    await crearSesion({
      token, usuarioId: usuario.id, empresaId: empresa_id, rol,
      ip: obtenerIpCliente(req), expiraEn: expiracionDeToken(token),
    });

    res.json({ token, usuario: payload });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/setup  (autenticado)
// Genera un secreto nuevo + QR de enrolamiento. No se guarda todavia --
// se confirma con /auth/2fa/enable una vez el usuario escanea y valida un
// codigo, para evitar guardar un secreto que el usuario nunca configuro.
async function setup2FA(req, res, next) {
  try {
    const { rows } = await pool.query('select email from usuarios where id = $1', [req.usuario.id]);
    const usuario = rows[0];
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(usuario.email, 'Servicio-Horas', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    res.json({ secret, qrCode });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/enable  { secret, code, frase_reto }  (autenticado)
// frase_reto es un secreto independiente de la contrasena (nunca se
// autocompleta con uno anterior -- siempre se pide en blanco): se exige
// para poder pedir la recuperacion de 2FA por correo (ver
// solicitarRecuperacion2FA), asi alguien con acceso solo al correo del
// usuario no puede desactivarle el 2FA sin conocer tambien esta frase.
async function enable2FA(req, res, next) {
  try {
    const { secret, code, frase_reto } = req.body;
    if (!secret || !code) return res.status(400).json({ mensaje: 'secret y code son requeridos' });
    const fraseLimpia = String(frase_reto || '').trim().toLowerCase();
    if (fraseLimpia.length < 4) return res.status(400).json({ mensaje: 'La frase-reto debe tener al menos 4 caracteres' });

    const esValido = authenticator.check(String(code).trim(), secret);
    if (!esValido) return res.status(400).json({ mensaje: 'Codigo invalido' });

    const secretCifrado = encriptar(secret);
    const fraseHash = await bcrypt.hash(fraseLimpia, 10);
    await pool.query(
      'update usuarios set two_factor_secret = $1, two_factor_enabled = true, two_factor_challenge_hash = $2 where id = $3',
      [secretCifrado, fraseHash, req.usuario.id]
    );

    res.json({ mensaje: '2FA activado correctamente' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/disable  { code }  (autenticado)
async function disable2FA(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ mensaje: 'code es requerido' });

    const { rows } = await pool.query('select two_factor_secret from usuarios where id = $1', [req.usuario.id]);
    const usuario = rows[0];
    if (!usuario || !usuario.two_factor_secret) {
      return res.status(400).json({ mensaje: 'El 2FA no esta activo' });
    }

    const secret = desencriptar(usuario.two_factor_secret);
    const esValido = authenticator.check(String(code).trim(), secret);
    if (!esValido) return res.status(400).json({ mensaje: 'Codigo invalido' });

    // Se limpia tambien la frase-reto: la proxima vez que se active el
    // 2FA (aca o en otro equipo) se debe definir una nueva, en blanco.
    await pool.query(
      'update usuarios set two_factor_secret = null, two_factor_enabled = false, two_factor_challenge_hash = null where id = $1',
      [req.usuario.id]
    );

    res.json({ mensaje: '2FA desactivado correctamente' });
  } catch (err) {
    next(err);
  }
}

function generarTokenRecuperacion2FA() {
  return 'r2f_' + crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/2fa/recovery  { usuarioId, frase_reto }  (publico, con
// rate-limit en la ruta) -- se llama desde la pantalla que pide el codigo
// de la app autenticadora ("perdi acceso a mi 2FA"), NO desde el login
// inicial. El usuarioId ya viene validado por contrasena (lo devolvio
// POST /auth/login al detectar 2FA activo), asi que no hace falta pedir
// el email de nuevo.
//
// frase_reto es un segundo secreto (definido al activar el 2FA, ver
// enable2FA) que hay que acertar ANTES de que se envie el correo -- de un
// solo intento, sin reintentos (si falla, el frontend vuelve al login sin
// llamar de nuevo a este endpoint). Cuentas que activaron el 2FA antes de
// que existiera este campo no tienen two_factor_challenge_hash: para
// ellas se salta el reto y se comporta como antes, para no bloquearlas.
async function solicitarRecuperacion2FA(req, res, next) {
  try {
    const usuarioId = String(req.body?.usuarioId || '').trim();
    if (!usuarioId) return res.status(400).json({ mensaje: 'usuarioId es requerido' });

    const { rows } = await pool.query(
      'select id, nombre, email, two_factor_challenge_hash from usuarios where id = $1 and activo = true and two_factor_enabled = true',
      [usuarioId]
    );
    const usuario = rows[0];

    if (usuario && usuario.two_factor_challenge_hash) {
      const fraseOk = await bcrypt.compare(String(req.body?.frase_reto || '').trim().toLowerCase(), usuario.two_factor_challenge_hash);
      if (!fraseOk) return res.status(400).json({ mensaje: 'Frase incorrecta.' });
    }

    if (usuario) {
      const token = generarTokenRecuperacion2FA();
      const expiraEn = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await pool.query(
        'insert into dos_factor_recovery_tokens (usuario_id, token, expira_en) values ($1, $2, $3)',
        [usuario.id, token, expiraEn]
      );

      const enlace = `${process.env.CORS_ORIGIN || 'http://localhost:4200'}/recuperar-2fa?token=${token}`;
      enviarCorreo({
        destinatario: usuario.email,
        asunto: 'Recuperar acceso (perdiste tu autenticador)',
        texto: `Hola ${usuario.nombre},\n\nRecibimos una solicitud para desactivar la verificacion en dos pasos de tu cuenta porque perdiste acceso a tu app autenticadora. Este enlace es valido por 1 hora:\n${enlace}\n\nUna vez confirmes, podras iniciar sesion solo con tu contrasena y, si quieres, activar el 2FA de nuevo en otro equipo.\n\nSi no fuiste tu, ignora este correo.`,
        html: `<p>Hola ${usuario.nombre},</p><p>Recibimos una solicitud para desactivar la verificacion en dos pasos de tu cuenta porque perdiste acceso a tu app autenticadora. Este enlace es valido por 1 hora:</p><p><a href="${enlace}">${enlace}</a></p><p>Una vez confirmes, podras iniciar sesion solo con tu contrasena y, si quieres, activar el 2FA de nuevo en otro equipo.</p><p>Si no fuiste tu, ignora este correo.</p>`,
      }).catch((err) => console.error('Error enviando correo de recuperacion de 2FA:', err.message));
    }

    res.json({ mensaje: 'Si la cuenta tiene el 2FA activo, enviamos un enlace a su correo para desactivarlo.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/recovery/confirm  { token }  (publico)
async function confirmarRecuperacion2FA(req, res, next) {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ mensaje: 'token es requerido' });

    const { rows } = await pool.query(
      `select id, usuario_id from dos_factor_recovery_tokens where token = $1 and usado = false and expira_en > now()`,
      [token]
    );
    const registro = rows[0];
    if (!registro) return res.status(400).json({ mensaje: 'El enlace es invalido o ya expiro. Solicita uno nuevo.' });

    // Se limpia tambien la frase-reto: la proxima vez que se active el
    // 2FA se debe definir una nueva, en blanco (ver enable2FA).
    await pool.query('update usuarios set two_factor_secret = null, two_factor_enabled = false, two_factor_challenge_hash = null where id = $1', [registro.usuario_id]);
    await pool.query('update dos_factor_recovery_tokens set usado = true where id = $1', [registro.id]);
    // Mismo criterio que reset-password: cierra las sesiones activas, por
    // si alguien mas tenia acceso.
    await pool.query(
      `update sesiones set activo = false, razon_salida = 'recuperacion_2fa',
         duracion_segundos = extract(epoch from (now() - creado_en))::integer
       where usuario_id = $1 and activo = true`,
      [registro.usuario_id]
    );

    res.json({ mensaje: 'Verificacion en dos pasos desactivada. Ya puedes iniciar sesion solo con tu contrasena.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/recovery/notificar-admin  { usuarioId }  (publico,
// con rate-limit en la ruta) -- boton de escape para el caso legitimo de
// que el usuario tambien olvido su frase-reto: avisa a los super admins
// por correo para que puedan desactivarle el 2FA a mano desde Usuarios.
// No revela nada sobre si el usuario existe -- respuesta generica siempre.
async function notificarIntentoFallido2FA(req, res, next) {
  try {
    const usuarioId = String(req.body?.usuarioId || '').trim();
    if (!usuarioId) return res.status(400).json({ mensaje: 'usuarioId es requerido' });

    const { rows } = await pool.query('select nombre, email from usuarios where id = $1', [usuarioId]);
    const usuario = rows[0];

    if (usuario) {
      const { rows: admins } = await pool.query(
        'select email from usuarios where es_super_admin = true and activo = true'
      );
      const fecha = new Date().toLocaleString('es-PA');
      for (const admin of admins) {
        enviarCorreo({
          destinatario: admin.email,
          asunto: 'Solicitud de ayuda: recuperacion de 2FA fallida',
          texto: `El usuario ${usuario.nombre} (${usuario.email}) intento recuperar el acceso a su 2FA el ${fecha}, pero no acerto su frase-reto.\n\nSi perdio legitimamente su dispositivo, puedes desactivarle el 2FA manualmente desde Usuarios.`,
          html: `<p>El usuario <strong>${usuario.nombre}</strong> (${usuario.email}) intento recuperar el acceso a su 2FA el ${fecha}, pero no acerto su frase-reto.</p><p>Si perdio legitimamente su dispositivo, puedes desactivarle el 2FA manualmente desde Usuarios.</p>`,
        }).catch((err) => console.error('Error enviando correo de aviso de 2FA a un admin:', err.message));
      }
    }

    res.json({ mensaje: 'Se notifico al equipo de soporte.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/pista?email=...  (publico, con rate-limit en la ruta)
async function obtenerPista(req, res, next) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ mensaje: 'email es requerido' });

    const { rows } = await pool.query('select pista from usuarios where email = $1 and activo = true', [email]);
    const pista = rows[0]?.pista;
    if (!pista) return res.status(404).json({ mensaje: 'No hay una pista configurada para ese usuario' });

    res.json({ pista });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password  { email }  (publico, con rate-limit en la ruta)
// Nunca revela si el correo existe o no (evita enumeracion de usuarios) --
// la respuesta es siempre el mismo mensaje generico, exista o no la cuenta.
async function olvidoPassword(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ mensaje: 'email es requerido' });

    const { rows } = await pool.query('select id, nombre from usuarios where email = $1 and activo = true', [email]);
    const usuario = rows[0];

    if (usuario) {
      const token = await crearTokenReset(usuario.id);
      const enlace = `${process.env.CORS_ORIGIN || 'http://localhost:4200'}/restablecer-password?token=${token}`;
      // El envio de correo no debe tumbar la respuesta si falla (Graph
      // caido, credenciales mal configuradas, etc.) -- de todas formas el
      // mensaje al cliente es generico.
      enviarCorreo({
        destinatario: email,
        asunto: 'Recuperar tu contrasena',
        texto: `Hola ${usuario.nombre},\n\nRecibimos una solicitud para restablecer tu contrasena. Este enlace es valido por 1 hora:\n${enlace}\n\nSi no fuiste tu, ignora este correo.`,
        html: `<p>Hola ${usuario.nombre},</p><p>Recibimos una solicitud para restablecer tu contrasena. Este enlace es valido por 1 hora:</p><p><a href="${enlace}">${enlace}</a></p><p>Si no fuiste tu, ignora este correo.</p>`,
      }).catch((err) => console.error('Error enviando correo de recuperacion de contrasena:', err.message));
    }

    res.json({ mensaje: 'Si el correo existe en nuestro sistema, recibiras un enlace para restablecer tu contrasena.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password  { token, password_nueva }  (publico)
async function restablecerPassword(req, res, next) {
  try {
    const { token, password_nueva } = req.body || {};
    if (!token || !password_nueva) return res.status(400).json({ mensaje: 'token y password_nueva son requeridos' });

    const erroresPassword = validarPassword(password_nueva, await obtenerPolitica());
    if (erroresPassword.length) return res.status(400).json({ mensaje: erroresPassword.join('. ') });

    const { rows } = await pool.query(
      `select id, usuario_id from password_reset_tokens where token = $1 and usado = false and expira_en > now()`,
      [token]
    );
    const registro = rows[0];
    if (!registro) return res.status(400).json({ mensaje: 'El enlace es invalido o ya expiro. Solicita uno nuevo.' });

    const password_hash = await bcrypt.hash(password_nueva, 10);
    await pool.query('update usuarios set password_hash = $1, debe_cambiar_password = false where id = $2', [password_hash, registro.usuario_id]);
    await pool.query('update password_reset_tokens set usado = true where id = $1', [registro.id]);

    res.json({ mensaje: 'Contrasena actualizada correctamente. Ya puedes iniciar sesion.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/mis-empresas
// Un super-admin ve TODAS las empresas activas (para poder entrar a una
// donde todavia no tiene membresia, ej. dar de alta a su primer usuario).
// Un usuario normal solo ve las empresas a las que realmente pertenece.
async function misEmpresas(req, res, next) {
  try {
    if (req.usuario.es_super_admin) {
      const { rows } = await pool.query(
        `select e.id as empresa_id, e.nombre as empresa_nombre,
                coalesce(uer.rol, 'admin') as rol
         from empresas e
         left join usuarios_empresas_rol uer
                on uer.empresa_id = e.id and uer.usuario_id = $1
         where e.activo = true
         order by e.nombre`,
        [req.usuario.id]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `select e.id as empresa_id, e.nombre as empresa_nombre, uer.rol
       from usuarios_empresas_rol uer
       join empresas e on e.id = uer.empresa_id
       where uer.usuario_id = $1 and e.activo = true
       order by e.nombre`,
      [req.usuario.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      'select id, nombre, email, activo, avatar, es_super_admin, debe_cambiar_password, two_factor_enabled, created_at from usuarios where id = $1',
      [req.usuario.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json({ ...rows[0], rol: req.usuario.rol, empresa_id: req.usuario.empresa_id, empresa_nombre: req.usuario.empresa_nombre });
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
       returning id, nombre, email, activo, avatar, es_super_admin`,
      [avatar ?? null, req.usuario.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json({ ...rows[0], rol: req.usuario.rol, empresa_id: req.usuario.empresa_id });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/password  { password_actual, password_nueva, pista? } -> cambia la password propia
// pista es opcional: si se omite, no se toca la pista ya guardada; si se
// envia vacia o con texto, la reemplaza (validando similitud con la nueva
// contrasena en el segundo caso).
async function cambiarPassword(req, res, next) {
  try {
    const { password_actual, password_nueva, pista } = req.body;
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ mensaje: 'password_actual y password_nueva son requeridos' });
    }

    const politica = await obtenerPolitica();
    const erroresPassword = validarPassword(password_nueva, politica);
    if (erroresPassword.length) {
      return res.status(400).json({ mensaje: erroresPassword.join('. ') });
    }

    const { rows } = await pool.query('select password_hash from usuarios where id = $1', [req.usuario.id]);
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    const passwordOk = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!passwordOk) {
      return res.status(401).json({ mensaje: 'La contrasena actual no es correcta' });
    }

    let pistaFinal;
    if (pista !== undefined) {
      pistaFinal = String(pista).trim() || null;
      if (pistaFinal) {
        const erroresPista = validarPista(pistaFinal, password_nueva, politica);
        if (erroresPista.length) {
          return res.status(400).json({ mensaje: erroresPista.join('. ') });
        }
      }
    }

    const password_hash = await bcrypt.hash(password_nueva, 10);
    if (pista !== undefined) {
      await pool.query('update usuarios set password_hash = $1, pista = $2, debe_cambiar_password = false where id = $3', [password_hash, pistaFinal, req.usuario.id]);
    } else {
      await pool.query('update usuarios set password_hash = $1, debe_cambiar_password = false where id = $2', [password_hash, req.usuario.id]);
    }

    // Reemite el token con debe_cambiar_password=false para que, si este
    // cambio era obligatorio, el frontend quede desbloqueado de inmediato
    // (sin esto seguiria recibiendo el 403 de "debes cambiar tu
    // contrasena" hasta volver a iniciar sesion).
    const token = firmarToken({
      id: req.usuario.id,
      nombre: req.usuario.nombre,
      email: req.usuario.email,
      rol: req.usuario.rol,
      empresa_id: req.usuario.empresa_id,
      cliente_id: req.usuario.cliente_id,
      es_super_admin: req.usuario.es_super_admin,
      debe_cambiar_password: false,
    });
    await reemplazarTokenSesion(req.token, token, expiracionDeToken(token));

    res.json({ mensaje: 'Contrasena actualizada correctamente', token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
// POST /api/auth/logout  { razon? }
// razon identifica en Auditoria de sesiones por que se cerro: cierre
// manual, inactividad, token invalido (401 de otra ruta), etc. Si se
// omite, se asume cierre manual.
async function logout(req, res, next) {
  try {
    const razon = String(req.body?.razon || '').trim() || 'logout_usuario';
    await cerrarSesionActual(req.token, razon);
    res.json({ mensaje: 'Sesion cerrada' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/session-config  (publico -- se consulta antes de que el
// inicio de sesion este completo)
// Duraciones del sistema de inactividad, configurables por variables de
// entorno sin necesitar redeploy de logica.
async function sessionConfig(req, res, next) {
  try {
    const inactivityLimitMin = Number(process.env.SESSION_INACTIVITY_LIMIT_MINUTES) || 15;
    const warningBeforeMin = Number(process.env.SESSION_WARNING_BEFORE_MINUTES) || 2;
    const refreshIntervalMin = Number(process.env.SESSION_REFRESH_INTERVAL_MINUTES) || 10;

    res.json({
      inactivityLimitMs: inactivityLimitMin * 60 * 1000,
      warningBeforeMs: warningBeforeMin * 60 * 1000,
      refreshIntervalMs: refreshIntervalMin * 60 * 1000,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh-session
// "Sigo aqui": reemite el JWT (extiende su expiracion natural, ver
// firmarToken/JWT_EXPIRES_IN) y actualiza la fila de sesion para que siga
// identificada por el nuevo token. No tiene relacion con el temporizador
// de inactividad (ese es puramente del cliente) -- esto evita que la
// sesion expire "sola" mientras la pestana sigue abierta y en uso.
async function refreshSession(req, res, next) {
  try {
    const token = firmarToken({
      id: req.usuario.id,
      nombre: req.usuario.nombre,
      email: req.usuario.email,
      rol: req.usuario.rol,
      empresa_id: req.usuario.empresa_id,
      cliente_id: req.usuario.cliente_id,
      es_super_admin: req.usuario.es_super_admin,
      debe_cambiar_password: req.usuario.debe_cambiar_password,
    });
    await reemplazarTokenSesion(req.token, token, expiracionDeToken(token));
    res.json({ token });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login, verificar2FA, setup2FA, enable2FA, disable2FA,
  solicitarRecuperacion2FA, confirmarRecuperacion2FA, notificarIntentoFallido2FA,
  seleccionarEmpresa, misEmpresas, me, actualizarPerfil, cambiarPassword,
  obtenerPista, olvidoPassword, restablecerPassword, logout, sessionConfig, refreshSession,
};
