import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { crearEnviador } from '../src/correo.js';
import { crearFactura } from '../src/factura.js';
import { buscarTarifa } from '../src/tarifas.js';

const factura = () => crearFactura({ tarifa: buscarTarifa('premium'), nombre: 'Ana Pérez', email: 'ana@example.com', ciudad: 'Córdoba', motivo: '' }, { ip: '1.2.3.4', navegador: 'Firefox' });

// Imita a Apps Script: el POST responde 302 y el JSON llega desde otra URL.
async function falsoAppsScript(resultado) {
  const recibido = [];
  const srv = createServer((req, res) => {
    if (req.method === 'POST') {
      let t = ''; req.on('data', (d) => (t += d)); req.on('end', () => {
        recibido.push(JSON.parse(t));
        res.writeHead(302, { Location: `http://127.0.0.1:${srv.address().port}/resultado` }); res.end();
      });
    } else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(typeof resultado === 'string' ? resultado : JSON.stringify(resultado)); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/exec`, recibido, cerrar: () => new Promise((r) => srv.close(r)) };
}

test('prioridad: SMTP con contraseña > Apps Script > FormSubmit', () => {
  const as = { APPS_SCRIPT_URL: 'http://x', APPS_SCRIPT_KEY: 'k', MAIL_TO: 'a@b.co' };
  assert.equal(crearEnviador({ ...as }).modo, 'appsscript');
  assert.equal(crearEnviador({ ...as, SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }).modo, 'smtp');
  assert.equal(crearEnviador({ MAIL_TO: 'a@b.co' }).modo, 'formsubmit');
  assert.equal(crearEnviador({ APPS_SCRIPT_URL: 'http://x' }).modo, 'desarrollo'); // falta la clave
});

test('Apps Script: envía clave, asunto, html, logo y responder; sigue la redirección', async () => {
  const s = await falsoAppsScript({ ok: true });
  const f = factura();
  await crearEnviador({ APPS_SCRIPT_URL: s.url, APPS_SCRIPT_KEY: 'secreta' }).enviar(f, 'ana@example.com');
  assert.equal(s.recibido.length, 1);
  const p = s.recibido[0];
  assert.equal(p.clave, 'secreta'); assert.equal(p.asunto, f.asunto); assert.equal(p.responder, 'ana@example.com');
  assert.match(p.html, /Vida Premium/); assert.match(p.html, /cid:marca/);
  assert.ok(Buffer.from(p.logo, 'base64').subarray(1, 4).toString() === 'PNG');
  assert.ok(!('to' in p) && !('destino' in p)); // el destinatario lo fija el script, no la web
  await s.cerrar();
});

test('Apps Script: error del script y respuesta que no es JSON lanzan excepción con motivo', async () => {
  let s = await falsoAppsScript({ ok: false, error: 'clave incorrecta' });
  await assert.rejects(crearEnviador({ APPS_SCRIPT_URL: s.url, APPS_SCRIPT_KEY: 'x' }).enviar(factura(), 'a@b.co'), /clave incorrecta/);
  await s.cerrar();
  s = await falsoAppsScript('<html>Inicia sesión</html>');
  await assert.rejects(crearEnviador({ APPS_SCRIPT_URL: s.url, APPS_SCRIPT_KEY: 'x' }).enviar(factura(), 'a@b.co'), /no es JSON/);
  await s.cerrar();
});

// Ejecuta Code.gs de verdad con simulaciones de MailApp, Session, Utilities y ContentService.
function cargarScript(clave) {
  const enviados = [];
  const ctx = {
    MailApp: { sendEmail: (o) => enviados.push(o) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dueno@gmail.com' }) },
    Utilities: { newBlob: (b, t, n) => ({ b, t, n }), base64Decode: (s) => Buffer.from(s, 'base64') },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace('PEGA_AQUI_TU_CLAVE_SECRETA\';\n', `${clave}';\n`).replace("CLAVE === 'PEGA_AQUI_TU_CLAVE_SECRETA'", `CLAVE === 'PEGA_AQUI_TU_CLAVE_SECRETA'`) + '\nthis.doPost = doPost;', ctx);
  return { ctx, enviados };
}
const post = (ctx, o) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(o) } }).t);

test('Code.gs: con la clave correcta envía al dueño con replyTo y logo; el destino no es manipulable', () => {
  const { ctx, enviados } = cargarScript('clave123');
  const r = post(ctx, { clave: 'clave123', asunto: 'A', texto: 'T', html: '<b>H</b>', responder: 'ana@example.com', logo: Buffer.from('PNG').toString('base64'), to: 'victima@example.com' });
  assert.equal(r.ok, true);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, 'dueno@gmail.com');
  assert.equal(enviados[0].replyTo, 'ana@example.com');
  assert.ok(enviados[0].inlineImages.marca);
});

test('Code.gs: clave incorrecta, plantilla sin configurar o campos vacíos no envían nada', () => {
  let { ctx, enviados } = cargarScript('clave123');
  assert.equal(post(ctx, { clave: 'otra', asunto: 'A', texto: 'T', html: 'H' }).ok, false);
  assert.equal(post(ctx, { clave: 'clave123', asunto: 'A' }).ok, false);
  ({ ctx, enviados } = cargarScript('PEGA_AQUI_TU_CLAVE_SECRETA'));
  assert.equal(post(ctx, { clave: 'PEGA_AQUI_TU_CLAVE_SECRETA', asunto: 'A', texto: 'T', html: 'H' }).ok, false);
  assert.equal(enviados.length, 0);
});
