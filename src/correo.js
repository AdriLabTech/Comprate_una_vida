import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';

const MARCA = fileURLToPath(new URL('../public/marca-correo.png', import.meta.url)); // 72 px, para el correo
const MARCA_WEB = fileURLToPath(new URL('../public/marca.png', import.meta.url));

// Crea el "enviador". Con SMTP_HOST envía de verdad; sin él (desarrollo) deja el correo en ./outbox.
export function crearEnviador(env = process.env, dirSalida = 'outbox') {
  const destino = env.MAIL_TO;
  const remitente = env.MAIL_FROM || env.SMTP_USER || 'facturas@compra-una-vida.local';

  const clave = String(env.SMTP_PASS || '').replace(/\s+/g, ''); // las contraseñas de aplicación de Google traen espacios
  if (env.SMTP_HOST && !clave) console.warn('[correo] SMTP_HOST definido pero SMTP_PASS vacío: se usa el modo de reserva.');
  if (env.SMTP_HOST && clave) {
    if (!destino) throw new Error('Falta MAIL_TO (correo que recibe las facturas).');
    const transporte = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: clave },
    });
    return {
      modo: 'smtp',
      enviar: (f, respondera) =>
        transporte.sendMail({
          from: `"Facturación · Compra Aquí Una Vida" <${remitente}>`,
          to: destino,
          replyTo: respondera,
          subject: f.asunto,
          text: f.texto,
          html: f.html,
          attachments: [{ filename: 'marca.png', path: MARCA, cid: 'marca' }],
          signal: AbortSignal.timeout(20_000),
        }),
    };
  }

  // Google Apps Script: HTTPS (sirve en hosts que bloquean SMTP), envía desde tu Gmail con el HTML completo.
  if (env.APPS_SCRIPT_URL && env.APPS_SCRIPT_KEY) {
    return {
      modo: 'appsscript',
      async enviar(f, respondera) {
        const logo = (await readFile(MARCA)).toString('base64');
        const r = await fetch(env.APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave: env.APPS_SCRIPT_KEY, asunto: f.asunto, texto: f.texto, html: f.html, responder: respondera, logo }),
          redirect: 'follow', // Apps Script responde con una redirección
          signal: AbortSignal.timeout(25_000),
        });
        const texto = await r.text();
        let j;
        try { j = JSON.parse(texto); }
        catch { throw new Error(`Apps Script devolvió algo que no es JSON (¿publicado con acceso «Cualquier persona»?). Estado ${r.status}`); }
        if (!j.ok) throw new Error(`Apps Script: ${j.error || 'error desconocido'}`);
      },
    };
  }

  // Sin SMTP pero con MAIL_TO: FormSubmit.co (sin cuenta ni claves; se activa una vez con un enlace del correo).
  if (destino) {
    const origen = env.SITE_URL || `http://127.0.0.1:${env.PORT || 3000}`;
    return {
      modo: 'formsubmit',
      async enviar(f, respondera) {
        const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(destino)}`, {
          method: 'POST',
          // FormSubmit exige Origin/Referer (comportamiento de navegador) aunque llamemos desde el servidor.
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: origen, Referer: `${origen}/` },
          body: JSON.stringify({
            _subject: f.asunto, _replyto: respondera, _template: 'table', _captcha: 'false',
            Factura: f.numero, Tarifa: f.concepto, 'Total a pagar': f.totalTexto, Estado: 'PENDIENTE DE PAGO',
            ...f.campos,
            Aviso: 'Factura de broma, sin validez fiscal ni jurídica.',
          }),
          signal: AbortSignal.timeout(20_000),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !(j.success === true || j.success === 'true')) {
          throw new Error(`FormSubmit: ${j.message || r.status}`);
        }
      },
    };
  }

  return {
    modo: 'desarrollo',
    async enviar(f, respondera) {
      await mkdir(dirSalida, { recursive: true });
      const base = join(dirSalida, f.numero);
      await writeFile(`${base}.html`, f.html.replace('cid:marca', pathToFileURL(MARCA_WEB).href)); // vista previa local
      await writeFile(`${base}.txt`, `Asunto: ${f.asunto}\nResponder a: ${respondera}\n\n${f.texto}\n`);
    },
  };
}
