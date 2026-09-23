const crypto = require('crypto');
const { pool } = require('../config/db');
const { porcentajeSimilitud } = require('./levenshtein');

// Tabla singleton (una sola fila, id=1) -- ver migracion 011.
async function obtenerPolitica() {
  const { rows } = await pool.query('select * from politica_password where id = 1');
  return rows[0];
}

function contar(regex, texto) {
  return (texto.match(regex) || []).length;
}

// caracteres_numericos/caracteres_especiales son sets configurables (ej.
// "1234567890", "!@#$%^&*-_+=.,") -- no una restriccion sobre el resto
// del password, solo de que clase de caracter cuenta para cumplir el
// requisito.
function contieneCaracterDe(texto, set) {
  return [...texto].some((c) => (set || '').includes(c));
}

// Devuelve un arreglo de mensajes de error (vacio si cumple). Se usa en
// cada punto del backend donde un password se define/reemplaza.
function validarPassword(password, politica) {
  const errores = [];
  const pw = password || '';
  if (pw.length < politica.longitud_minima) {
    errores.push(`Debe tener al menos ${politica.longitud_minima} caracteres`);
  }
  const mayusMin = politica.mayuscula_minima || 0;
  if (mayusMin > 0 && contar(/[A-Z]/g, pw) < mayusMin) {
    errores.push(`Debe incluir al menos ${mayusMin} mayuscula${mayusMin > 1 ? 's' : ''}`);
  }
  const minusMin = politica.minuscula_minima || 0;
  if (minusMin > 0 && contar(/[a-z]/g, pw) < minusMin) {
    errores.push(`Debe incluir al menos ${minusMin} minuscula${minusMin > 1 ? 's' : ''}`);
  }
  if (politica.requiere_numero && !contieneCaracterDe(pw, politica.caracteres_numericos)) errores.push('Debe incluir al menos un numero');
  if (politica.requiere_caracter_especial && !contieneCaracterDe(pw, politica.caracteres_especiales)) errores.push('Debe incluir al menos un caracter especial');
  return errores;
}

// La pista nunca puede ser igual al password (regla fija, no
// configurable) -- ademas de su propio minimo de longitud y el % de
// similitud maxima, ambos ya parte de la politica.
function validarPista(pista, password, politica) {
  const errores = [];
  if (pista.length < politica.pista_longitud_minima) {
    errores.push(`La pista debe tener al menos ${politica.pista_longitud_minima} caracteres`);
  }
  if (pista.trim().toLowerCase() === String(password || '').trim().toLowerCase()) {
    errores.push('La pista no puede ser igual a la contrasena');
  }
  const similitud = porcentajeSimilitud(password || '', pista);
  if (similitud > politica.pista_similitud_maxima_porcentaje) {
    errores.push(`La pista es demasiado obvia (${similitud.toFixed(0)}% de similitud con la contrasena). Debe parecerse menos de un ${politica.pista_similitud_maxima_porcentaje}%.`);
  }
  return errores;
}

const GEN_MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O -- se confunden con 1/0
const GEN_MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const GEN_NUMEROS = '23456789';
const GEN_ESPECIALES = '!@#$%^&*-_+=';

function elegirAlAzar(pool) {
  return pool[crypto.randomInt(pool.length)];
}

function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Genera un password aleatorio (crypto.randomInt, no Math.random) que
// cumple con TODA la politica activa. Se usa para "resetear password" de
// un usuario, donde el nuevo password se le comunica fuera de la API.
function generarPasswordSegunPolitica(politica) {
  const obligatorios = [];
  for (let i = 0; i < (politica.mayuscula_minima || 0); i++) obligatorios.push(elegirAlAzar(GEN_MAYUSCULAS));
  for (let i = 0; i < (politica.minuscula_minima || 0); i++) obligatorios.push(elegirAlAzar(GEN_MINUSCULAS));
  const numeros = politica.caracteres_numericos || GEN_NUMEROS;
  const especiales = politica.caracteres_especiales || GEN_ESPECIALES;
  if (politica.requiere_numero) obligatorios.push(elegirAlAzar(numeros));
  if (politica.requiere_caracter_especial) obligatorios.push(elegirAlAzar(especiales));

  const longitud = Math.max(politica.longitud_minima, obligatorios.length, 10);
  const poolCompleto = GEN_MAYUSCULAS + GEN_MINUSCULAS + numeros + especiales;
  const resto = [];
  for (let i = obligatorios.length; i < longitud; i++) resto.push(elegirAlAzar(poolCompleto));

  return barajar([...obligatorios, ...resto]).join('');
}

module.exports = { obtenerPolitica, validarPassword, validarPista, generarPasswordSegunPolitica };
