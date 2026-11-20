// Envía una factura de ejemplo a MAIL_TO con la configuración del .env y dice si funcionó.
import { crearEnviador } from '../src/correo.js';
import { crearFactura } from '../src/factura.js';
import { buscarTarifa } from '../src/tarifas.js';

const enviador = crearEnviador(process.env);
const f = crearFactura(
  { tarifa: buscarTarifa('premium'), nombre: 'Lucía Prueba', email: process.env.MAIL_TO || 'prueba@example.com', ciudad: 'Córdoba', motivo: 'Prueba de configuración' },
  { ip: '127.0.0.1', navegador: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/150.0 Safari/537.36' },
);
console.log(`Modo de envío: ${enviador.modo}`);
try {
  await enviador.enviar(f, process.env.MAIL_TO || 'prueba@example.com');
  console.log(enviador.modo === 'desarrollo' ? `Guardado en outbox/${f.numero}.html` : `Enviado a ${process.env.MAIL_TO}. Revisa tu bandeja (y spam).`);
} catch (e) {
  console.error(`FALLÓ: ${e.message}`);
  if (/Invalid login|535|534|Username and Password/i.test(e.message)) console.error('→ Gmail rechazó la contraseña: usa una «contraseña de aplicación» (16 letras), no la normal.');
  process.exit(1);
}
