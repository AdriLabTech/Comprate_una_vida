import { randomInt } from 'node:crypto';
import { desglose, euros } from './tarifas.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function numeroFactura(fecha = new Date()) {
  return `FV-${fecha.getFullYear()}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
}

const fechaLarga = (d) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(d);
const fechaCorta = (d) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' }).format(d);

// Navegador legible a partir del User-Agent (sin dependencias; solo lo habitual).
function navegadorLegible(ua = '') {
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return nav ? `${nav}${so ? ' en ' + so : ''}` : ua || '—';
}

// Construye la factura (datos, asunto, texto y HTML). `meta` = { ip, navegador } del visitante.
// El HTML es compatible con clientes de correo: tablas, estilos en línea y colores también como atributos.
export function crearFactura({ tarifa, nombre, email, ciudad, motivo }, meta = {}, fecha = new Date()) {
  const numero = numeroFactura(fecha);
  const { base, iva, total } = desglose(tarifa.centimos);
  const periodicidad = tarifa.periodo === 'mes' ? 'Mensual, hasta que la vida decida lo contrario' : 'Pago único (sin permanencia)';
  const primerNombre = nombre.split(' ')[0];
  const navegador = navegadorLegible(meta.navegador);
  const asunto = `Factura ${numero} · ${nombre} compra ${tarifa.nombre} (${euros(total)})`;
  const preheader = `${nombre}, de ${ciudad}, ha contratado ${tarifa.nombre}. Total a pagar: ${euros(total)}. Estado: pendiente de pago.`;

  const datosCliente = [
    ['Cliente', nombre],
    ['Correo', email],
    ['Ciudad', ciudad],
    ['Motivo de compra', motivo || '—'],
    ['IP', meta.ip || '—'],
    ['Navegador', navegador],
  ];

  const texto = [
    `FACTURA ${numero}`,
    `Emitida el ${fechaLarga(fecha)} por Compra Aquí Una Vida, S.L. (sociedad ficticia)`,
    '',
    `${primerNombre} acaba de comprar ${tarifa.nombre} y su factura ya está en tu bandeja.`,
    '',
    ...datosCliente.map(([k, v]) => `${k}: ${v}`),
    '',
    `Concepto: ${tarifa.nombre} — ${tarifa.lema}`,
    `Condición especial: ${tarifa.nota}`,
    `Periodicidad: ${periodicidad}`,
    '',
    `Base imponible: ${euros(base)}`,
    `IVA (21 %): ${euros(iva)}`,
    `TOTAL A PAGAR: ${euros(total)}`,
    '',
    'Estado: PENDIENTE DE PAGO',
    `Vencimiento: ${fechaCorta(fecha)} (retroactivo). Recargo por demora: remordimientos.`,
    `Puedes responder a este correo: llegará directamente a ${nombre}.`,
    '',
    'Documento de broma, sin validez fiscal ni jurídica. No se ha cobrado nada.',
  ].join('\n');

  const F = "Helvetica,Arial,sans-serif", M = "'Courier New',Courier,monospace";
  const fila = (k, v) => `<tr>
        <td width="34%" valign="top" style="padding:9px 0;border-bottom:1px solid #e0e0e0;font:12px ${M};letter-spacing:1px;text-transform:uppercase;color:#6b6b6b">${esc(k)}</td>
        <td valign="top" style="padding:9px 0;border-bottom:1px solid #e0e0e0;font:15px ${F};color:#0a0a0a">${esc(v)}</td></tr>`;
  const linea = (k, v, fuerte = false) => `<tr>
        <td style="padding:${fuerte ? '14px 0 0' : '7px 0'};font:${fuerte ? 'bold 15px' : '14px'} ${M};color:#0a0a0a">${k}</td>
        <td align="right" style="padding:${fuerte ? '14px 0 0' : '7px 0'};font:${fuerte ? 'bold 24px' : '14px'} ${M};color:#0a0a0a">${esc(v)}</td></tr>`;

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(asunto)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4" bgcolor="#f4f4f4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f4f4">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f4f4"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
    <tr><td bgcolor="#000000" style="background:#000000;padding:22px 28px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td width="44" valign="middle"><img src="cid:marca" width="36" height="36" alt="" style="display:block;border:0"></td>
        <td valign="middle" style="font:11px ${M};letter-spacing:3px;color:#c9c9c9;text-transform:uppercase">Compra Aquí Una Vida, S.L.<br><span style="color:#8c8c8c">Departamento de Cobros</span></td>
        <td align="right" valign="middle" style="font:12px ${M};letter-spacing:3px;color:#f2f2f2">FACTURA</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:32px 28px 8px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0">
      <p style="margin:0 0 6px;font:12px ${M};letter-spacing:2px;color:#6b6b6b">Nº ${esc(numero)} · ${esc(fechaLarga(fecha))}</p>
      <h1 style="margin:0 0 14px;font:normal 26px/1.25 ${F};color:#0a0a0a">${esc(primerNombre)} acaba de comprar<br><b>${esc(tarifa.nombre)}</b></h1>
      <p style="margin:0 0 24px;font:15px/1.6 ${F};color:#333333">Hola, Adrián. <b>${esc(nombre)}</b>, desde ${esc(ciudad)}, ha contratado una vida y su factura ya está en tu bandeja. Estas son las condiciones.</p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:2px solid #0a0a0a">
        ${datosCliente.map(([k, v]) => fila(k, v)).join('\n        ')}
      </table>

      <p style="margin:30px 0 8px;font:12px ${M};letter-spacing:3px;color:#6b6b6b">CONCEPTO</p>
      <p style="margin:0 0 4px;font:bold 20px ${F};color:#0a0a0a">${esc(tarifa.nombre)}</p>
      <p style="margin:0 0 4px;font:14px/1.5 ${F};color:#333333">${esc(tarifa.lema)}</p>
      <p style="margin:0 0 4px;font:13px/1.5 ${F};color:#6b6b6b"><i>${esc(tarifa.nota)}</i></p>
      <p style="margin:0 0 22px;font:12px ${M};color:#6b6b6b">${esc(periodicidad)}</p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e0e0e0">
        ${linea('Base imponible', euros(base))}
        ${linea('IVA (21 %)', euros(iva))}
        <tr><td colspan="2" style="border-top:2px solid #0a0a0a;font-size:0;line-height:0">&nbsp;</td></tr>
        ${linea('TOTAL A PAGAR', euros(total), true)}
      </table>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 0"><tr>
        <td bgcolor="#0a0a0a" style="background:#0a0a0a;padding:10px 16px;font:bold 12px ${M};letter-spacing:2px;color:#ffffff">&#9650; PENDIENTE DE PAGO</td></tr></table>
      <p style="margin:14px 0 0;font:13px/1.6 ${F};color:#333333">Vencimiento: <b>${esc(fechaCorta(fecha))}</b> (con carácter retroactivo). Recargo por demora: remordimientos. El cliente queda obligado a abonar el importe con carácter inmediato y, a ser posible, emocional.</p>
      <p style="margin:14px 0 24px;font:13px/1.6 ${F};color:#333333">Puedes <b>responder a este correo</b>: tu respuesta llegará directamente a ${esc(nombre)}.</p>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:16px 28px 22px;border:1px solid #e0e0e0;border-top:1px solid #e0e0e0">
      <p style="margin:0;font:11px/1.6 ${F};color:#8c8c8c">Documento de broma, sin validez fiscal ni jurídica. No se ha cobrado nada. Sociedad emisora ficticia. Web desarrollada por Takumi-Organization.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { numero, asunto, texto, html, total, base, iva, fecha, concepto: tarifa.nombre, totalTexto: euros(total), campos: Object.fromEntries(datosCliente) };
}
