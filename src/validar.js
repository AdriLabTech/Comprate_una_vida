import { buscarTarifa } from './tarifas.js';

const EMAIL = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;
// Sin saltos de línea ni caracteres de control (evita inyección de cabeceras y basura en el asunto).
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/g;

const limpiar = (v, max) => String(v ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Devuelve { ok:true, datos } o { ok:false, errores:{campo:mensaje} }.
export function validarCompra(cuerpo) {
  const c = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const errores = {};

  const tarifa = buscarTarifa(c.tarifa);
  if (!tarifa) errores.tarifa = 'Elige una tarifa de vida.';

  const nombre = limpiar(c.nombre, 80);
  if (nombre.length < 2) errores.nombre = 'Indica tu nombre completo.';

  const email = limpiar(c.email, 120);
  if (!EMAIL.test(email)) errores.email = 'Introduce un correo válido.';

  const ciudad = limpiar(c.ciudad, 60);
  if (ciudad.length < 2) errores.ciudad = 'Indica tu ciudad de residencia.';

  const motivo = limpiar(c.motivo, 200);

  if (c.consentimiento !== true) errores.consentimiento = 'Debes aceptar el aviso para continuar.';

  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, datos: { tarifa, nombre, email, ciudad, motivo } };
}
