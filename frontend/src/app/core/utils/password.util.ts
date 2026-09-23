import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PoliticaPassword } from '../models/models';
import { porcentajeSimilitud } from './levenshtein.util';

const GEN_MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O -- se confunden con 1/0
const GEN_MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const GEN_NUMEROS = '23456789';
const GEN_ESPECIALES = '!@#$%^&*-_+=';

function elegirAlAzar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Genera un password aleatorio que cumple con la politica activa: incluye
// al menos un caracter de cada clase exigida y respeta la longitud minima
// (con un piso de 10 para que no quede demasiado corto si la politica es
// laxa). Usado por el boton "Generar" en los formularios donde se define
// una contrasena.
export function generarPasswordSegunPolitica(politica: PoliticaPassword): string {
  const obligatorios: string[] = [];
  for (let i = 0; i < (politica.mayuscula_minima || 0); i++) obligatorios.push(elegirAlAzar(GEN_MAYUSCULAS));
  for (let i = 0; i < (politica.minuscula_minima || 0); i++) obligatorios.push(elegirAlAzar(GEN_MINUSCULAS));
  const numeros = politica.caracteres_numericos || GEN_NUMEROS;
  const especiales = politica.caracteres_especiales || GEN_ESPECIALES;
  if (politica.requiere_numero) obligatorios.push(elegirAlAzar(numeros));
  if (politica.requiere_caracter_especial) obligatorios.push(elegirAlAzar(especiales));

  const longitud = Math.max(politica.longitud_minima, obligatorios.length, 10);
  const poolCompleto = GEN_MAYUSCULAS + GEN_MINUSCULAS + numeros + especiales;
  const resto: string[] = [];
  for (let i = obligatorios.length; i < longitud; i++) resto.push(elegirAlAzar(poolCompleto));

  return barajar([...obligatorios, ...resto]).join('');
}

// Validador de FormGroup: exige que password_nueva y password_confirmar
// coincidan.
export function passwordsCoincidenValidator(group: AbstractControl): ValidationErrors | null {
  const nueva = group.get('password_nueva')?.value;
  const confirmar = group.get('password_confirmar')?.value;
  if (!nueva || !confirmar) return null;
  return nueva === confirmar ? null : { noCoincide: true };
}

// Validador de control: mismas reglas que
// backend/src/utils/politicaPassword.js#validarPassword. Vacio no es
// invalido aqui (eso es responsabilidad de un Validators.required aparte).
function contar(regex: RegExp, texto: string): number {
  return (texto.match(regex) || []).length;
}

function contieneCaracterDe(texto: string, set: string): boolean {
  return [...texto].some((c) => (set || '').includes(c));
}

export function construirValidadorPolitica(politica: PoliticaPassword): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v: string = control.value || '';
    if (!v) return null;
    const errores: string[] = [];
    if (v.length < politica.longitud_minima) errores.push(`al menos ${politica.longitud_minima} caracteres`);
    const mayusMin = politica.mayuscula_minima || 0;
    if (mayusMin > 0 && contar(/[A-Z]/g, v) < mayusMin) errores.push(`al menos ${mayusMin} mayuscula${mayusMin > 1 ? 's' : ''}`);
    const minusMin = politica.minuscula_minima || 0;
    if (minusMin > 0 && contar(/[a-z]/g, v) < minusMin) errores.push(`al menos ${minusMin} minuscula${minusMin > 1 ? 's' : ''}`);
    if (politica.requiere_numero && !contieneCaracterDe(v, politica.caracteres_numericos)) errores.push('un numero');
    if (politica.requiere_caracter_especial && !contieneCaracterDe(v, politica.caracteres_especiales)) errores.push('un caracter especial');
    return errores.length ? { politica: `Debe incluir ${errores.join(', ')}.` } : null;
  };
}

// Un item del checklist visual (ver PasswordChecklistComponent): una
// regla de la politica, si la cumple el valor actual, y evidencia (los
// caracteres puntuales que la satisfacen).
export interface RequisitoPolitica {
  label: string;
  cumple: boolean;
  detalle?: string;
  ejemplos?: string[];
}

function caracteresUnicos(v: string, test: (c: string) => boolean): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const c of v) {
    if (test(c) && !vistos.has(c)) {
      vistos.add(c);
      resultado.push(c);
    }
  }
  return resultado;
}

// Desglosa la politica en items evaluados contra el valor actual del
// campo -- usado por PasswordChecklistComponent para el checklist en
// vivo (✅/❌ por regla, con los caracteres que la cumplen).
export function evaluarPoliticaPassword(password: string, politica: PoliticaPassword): RequisitoPolitica[] {
  const v = password || '';
  const items: RequisitoPolitica[] = [
    { label: `Minimo ${politica.longitud_minima} caracteres`, cumple: v.length >= politica.longitud_minima, detalle: `tiene ${v.length}` },
  ];
  const mayusMin = politica.mayuscula_minima || 0;
  if (mayusMin > 0) {
    const ejemplos = caracteresUnicos(v, (c) => /[A-Z]/.test(c));
    items.push({ label: `Al menos ${mayusMin} mayuscula${mayusMin > 1 ? 's' : ''}`, cumple: ejemplos.length >= mayusMin, detalle: `tiene ${ejemplos.length}`, ejemplos: ejemplos.length ? ejemplos : undefined });
  }
  const minusMin = politica.minuscula_minima || 0;
  if (minusMin > 0) {
    const ejemplos = caracteresUnicos(v, (c) => /[a-z]/.test(c));
    items.push({ label: `Al menos ${minusMin} minuscula${minusMin > 1 ? 's' : ''}`, cumple: ejemplos.length >= minusMin, detalle: `tiene ${ejemplos.length}`, ejemplos: ejemplos.length ? ejemplos : undefined });
  }
  if (politica.requiere_numero) {
    const ejemplos = caracteresUnicos(v, (c) => politica.caracteres_numericos.includes(c));
    items.push({ label: 'Al menos 1 numero', cumple: ejemplos.length > 0, ejemplos: ejemplos.length ? ejemplos : undefined });
  }
  if (politica.requiere_caracter_especial) {
    const ejemplos = caracteresUnicos(v, (c) => politica.caracteres_especiales.includes(c));
    items.push({ label: 'Al menos 1 caracter especial', cumple: ejemplos.length > 0, ejemplos: ejemplos.length ? ejemplos : undefined });
  }
  return items;
}

// Validador de FormGroup (necesita "pista" Y "password_nueva" a la vez):
// mismas reglas que backend/src/utils/politicaPassword.js#validarPista.
export function construirValidadorPista(politica: PoliticaPassword): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const pista: string = group.get('pista')?.value || '';
    if (!pista) return null;
    const password: string = group.get('password_nueva')?.value || '';
    if (pista.length < politica.pista_longitud_minima) {
      return { pista: `La pista debe tener al menos ${politica.pista_longitud_minima} caracteres.` };
    }
    if (pista.trim().toLowerCase() === password.trim().toLowerCase()) {
      return { pista: 'La pista no puede ser igual a la contrasena.' };
    }
    const similitud = porcentajeSimilitud(password, pista);
    if (similitud > politica.pista_similitud_maxima_porcentaje) {
      return { pista: `La pista es demasiado obvia (${similitud.toFixed(0)}% de similitud). Debe parecerse menos de un ${politica.pista_similitud_maxima_porcentaje}%.` };
    }
    return null;
  };
}
