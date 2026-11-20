import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARIFAS } from './src/tarifas.js';
import { validarCompra } from './src/validar.js';
import { crearFactura } from './src/factura.js';
import { crearEnviador } from './src/correo.js';

const RAIZ = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
};
const SEGURIDAD = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

// Límite en memoria: por IP y global (protege tu bandeja de entrada de ráfagas).
function crearLimitador(max, ventanaMs) {
  const golpes = new Map();
  return (clave, ahora = Date.now()) => {
    const lista = (golpes.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (lista.length >= max) { golpes.set(clave, lista); return false; }
    lista.push(ahora); golpes.set(clave, lista); return true;
  };
}

export function crearServidor({ env = process.env, enviador = crearEnviador(env) } = {}) {
  const porIp = crearLimitador(Number(env.LIMITE_IP || 5), 3600_000);
  const global = crearLimitador(Number(env.LIMITE_GLOBAL || 60), 3600_000);
  const confiarProxy = env.TRUST_PROXY === 'true';

  const ipDe = (req) =>
    (confiarProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

  const json = (res, estado, objeto) => {
    res.writeHead(estado, { ...SEGURIDAD, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(objeto));
  };

  async function leerCuerpo(req, max = 8 * 1024) {
    let total = 0; const trozos = [];
    for await (const t of req) {
      total += t.length;
      if (total > max) throw Object.assign(new Error('grande'), { estado: 413 });
      trozos.push(t);
    }
    try { return JSON.parse(Buffer.concat(trozos).toString('utf8')); }
    catch { throw Object.assign(new Error('json'), { estado: 400 }); }
  }

  async function comprar(req, res) {
    // Solo desde esta misma web (corta formularios cruzados y parte del spam).
    const origen = req.headers.origin;
    if (origen && new URL(origen).host !== req.headers.host) return json(res, 403, { error: 'Origen no permitido.' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Formato no soportado.' });

    let cuerpo;
    try { cuerpo = await leerCuerpo(req); }
    catch (e) { return json(res, e.estado || 400, { error: 'Petición no válida.' }); }

    // Trampa para bots: campo oculto que una persona nunca rellena. Se responde "ok" sin enviar nada.
    if (cuerpo && cuerpo.web) return json(res, 200, { ok: true });

    const v = validarCompra(cuerpo);
    if (!v.ok) return json(res, 422, { error: 'Revisa los datos.', errores: v.errores });

    // El límite solo cuenta compras válidas (las que enviarían un correo), no los fallos al teclear.
    const ip = ipDe(req);
    if (!porIp(ip) || !global('todos')) return json(res, 429, { error: 'Demasiadas compras de vida seguidas. Inténtalo más tarde.' });

    const factura = crearFactura(v.datos, { ip, navegador: String(req.headers['user-agent'] || '').slice(0, 160) });
    try {
      await enviador.enviar(factura, v.datos.email);
    } catch (e) {
      console.error('[correo] fallo al enviar:', e.message);
      return json(res, 502, { error: 'La vida está agotada en este momento (fallo al emitir la factura). Inténtalo de nuevo.' });
    }
    return json(res, 200, {
      ok: true,
      factura: { numero: factura.numero, tarifa: v.datos.tarifa.nombre, total: factura.total, fecha: factura.fecha.toISOString() },
    });
  }

  async function estatico(req, res, ruta) {
    const pedido = ruta === '/' ? '/index.html' : decodeURIComponent(ruta);
    const ruta_abs = normalize(join(RAIZ, pedido));
    if (ruta_abs !== RAIZ && !ruta_abs.startsWith(RAIZ + sep)) return json(res, 403, { error: 'Prohibido.' });
    try {
      const datos = await readFile(ruta_abs);
      const ext = extname(ruta_abs);
      res.writeHead(200, {
        ...SEGURIDAD,
        'Content-Type': TIPOS[ext] || 'application/octet-stream',
        'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : datos);
    } catch {
      json(res, 404, { error: 'No encontrado.' });
    }
  }

  return createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://x');
      if (pathname === '/api/tarifas' && req.method === 'GET') {
        return json(res, 200, TARIFAS.map(({ id, nombre, centimos, periodo, lema }) => ({ id, nombre, centimos, periodo, lema })));
      }
      if (pathname === '/api/comprar') {
        return req.method === 'POST' ? await comprar(req, res) : json(res, 405, { error: 'Método no permitido.' });
      }
      if (req.method === 'GET' || req.method === 'HEAD') return await estatico(req, res, pathname);
      return json(res, 405, { error: 'Método no permitido.' });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: 'Error interno.' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT || 3000);
  const enviador = crearEnviador(process.env);
  crearServidor({ enviador }).listen(puerto, process.env.HOST || '127.0.0.1', () => {
    console.log(`Compra aquí una vida → http://127.0.0.1:${puerto}  (correo: ${enviador.modo})`);
  });
}
