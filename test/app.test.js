import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServidor } from '../server.js';
import { crearFactura } from '../src/factura.js';
import { buscarTarifa, desglose } from '../src/tarifas.js';

async function arrancar(env = {}) {
  const enviados = [];
  const enviador = { modo: 'prueba', enviar: async (f, r) => { enviados.push({ f, r }); } };
  const srv = crearServidor({ env, enviador });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { base, enviados, cerrar: () => new Promise((r) => srv.close(r)) };
}
const compra = (extra = {}) => ({ tarifa: 'premium', nombre: 'Ana Pérez', email: 'ana@example.com', ciudad: 'Córdoba', motivo: 'Necesito otra', consentimiento: true, ...extra });
const post = (base, cuerpo, cab = {}) =>
  fetch(`${base}/api/comprar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cab }, body: JSON.stringify(cuerpo) });

test('lista las tarifas', async () => {
  const s = await arrancar();
  const t = await (await fetch(`${s.base}/api/tarifas`)).json();
  assert.equal(t.length, 5);
  await s.cerrar();
});

test('compra válida: un correo con total correcto y precio decidido por el servidor', async () => {
  const s = await arrancar();
  const r = await post(s.base, compra({ centimos: 1, precio: 1 }));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.factura.total, 499);
  assert.equal(s.enviados.length, 1);
  assert.equal(s.enviados[0].r, 'ana@example.com');
  assert.match(s.enviados[0].f.asunto, /Vida Premium/);
  assert.match(s.enviados[0].f.html, /4,99/);
  await s.cerrar();
});

test('validación: datos incompletos → 422 y no se envía nada', async () => {
  const s = await arrancar();
  const r = await post(s.base, compra({ email: 'no-es-correo', tarifa: 'gratis', consentimiento: false }));
  const j = await r.json();
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(j.errores).sort(), ['consentimiento', 'email', 'tarifa']);
  assert.equal(s.enviados.length, 0);
  await s.cerrar();
});

test('el asunto no admite saltos de línea (inyección de cabeceras)', async () => {
  const s = await arrancar();
  await post(s.base, compra({ nombre: 'Eva\r\nBcc: victima@example.com' }));
  assert.equal(s.enviados.length, 1);
  assert.doesNotMatch(s.enviados[0].f.asunto, /[\r\n]/);
  await s.cerrar();
});

test('la factura escapa HTML del usuario', () => {
  const f = crearFactura({ tarifa: buscarTarifa('basica'), nombre: '<script>alert(1)</script>', email: 'a@b.co', ciudad: 'X"Y', motivo: '' });
  assert.doesNotMatch(f.html, /<script>/);
  assert.match(f.html, /&lt;script&gt;/);
});

test('desglose en céntimos cuadra con el total', () => {
  for (const c of [99, 299, 499, 999, 4999]) {
    const d = desglose(c);
    assert.equal(d.base + d.iva, c);
  }
});

test('trampa anti-bots: responde ok pero no envía', async () => {
  const s = await arrancar();
  const r = await post(s.base, compra({ web: 'http://spam' }));
  assert.equal(r.status, 200);
  assert.equal(s.enviados.length, 0);
  await s.cerrar();
});

test('límite por IP: la tercera compra recibe 429 (con límite 2)', async () => {
  const s = await arrancar({ LIMITE_IP: '2' });
  assert.equal((await post(s.base, compra())).status, 200);
  assert.equal((await post(s.base, compra())).status, 200);
  assert.equal((await post(s.base, compra())).status, 429);
  assert.equal(s.enviados.length, 2);
  await s.cerrar();
});

test('origen ajeno → 403; cuerpo enorme → 413; no JSON → 415', async () => {
  const s = await arrancar();
  assert.equal((await post(s.base, compra(), { Origin: 'https://malo.example' })).status, 403);
  assert.equal((await post(s.base, compra({ motivo: 'x'.repeat(20000) }))).status, 413);
  const r = await fetch(`${s.base}/api/comprar`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hola' });
  assert.equal(r.status, 415);
  assert.equal(s.enviados.length, 0);
  await s.cerrar();
});

test('estáticos: index con cabeceras de seguridad y sin salida del directorio público', async () => {
  const s = await arrancar();
  const r = await fetch(`${s.base}/`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Compra aquí/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  const t = await fetch(`${s.base}/..%2f..%2fserver.js`);
  assert.notEqual(t.status, 200);
  const t2 = await fetch(`${s.base}/%2e%2e/package.json`);
  assert.notEqual(t2.status, 200);
  await s.cerrar();
});

test('modo FormSubmit: sin SMTP y con MAIL_TO se elige formsubmit; sin nada, desarrollo', async () => {
  const { crearEnviador } = await import('../src/correo.js');
  assert.equal(crearEnviador({ MAIL_TO: 'a@b.co' }).modo, 'formsubmit');
  assert.equal(crearEnviador({}).modo, 'desarrollo');
  assert.equal(crearEnviador({ SMTP_HOST: 'x', SMTP_USER: 'u', SMTP_PASS: 'a b c', MAIL_TO: 'a@b.co' }).modo, 'smtp');
  assert.equal(crearEnviador({ SMTP_HOST: 'x', SMTP_PASS: '', MAIL_TO: 'a@b.co' }).modo, 'formsubmit'); // sin contraseña, reserva
});
