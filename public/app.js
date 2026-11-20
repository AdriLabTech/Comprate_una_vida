const $ = (s, r = document) => r.querySelector(s);
const dialogo = $('#dialogo');
const pasos = { tarifas: $('#paso-tarifas'), datos: $('#paso-datos'), factura: $('#paso-factura') };
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
let tarifas = [];
let elegida = null;

function mostrar(paso) {
  Object.entries(pasos).forEach(([k, el]) => (el.hidden = k !== paso));
  $('#pasos').textContent = `Paso ${{ tarifas: 1, datos: 2, factura: 3 }[paso]} de 3`;
  const foco = { tarifas: '#lista-tarifas input:checked, #lista-tarifas input', datos: 'input[name=nombre]', factura: '#fin' }[paso];
  pasos[paso].querySelector(foco)?.focus();
}

async function cargarTarifas() {
  const lista = $('#lista-tarifas');
  if (tarifas.length) return;
  try {
    tarifas = await (await fetch('/api/tarifas')).json();
  } catch {
    $('#err-tarifa').textContent = 'No se pudieron cargar las tarifas.'; $('#err-tarifa').hidden = false; return;
  }
  for (const t of tarifas) {
    const fila = document.createElement('label'); fila.className = 'tarifa';
    const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'tarifa', value: t.id });
    const info = document.createElement('span');
    const nombre = Object.assign(document.createElement('b'), { textContent: t.nombre });
    const lema = Object.assign(document.createElement('small'), { textContent: t.lema });
    info.append(nombre, document.createElement('br'), lema);
    const precio = document.createElement('span'); precio.className = 'precio';
    precio.append(eur.format(t.centimos / 100), Object.assign(document.createElement('small'), { textContent: t.periodo === 'mes' ? 'al mes · IVA incl.' : 'pago único · IVA incl.' }));
    fila.append(radio, info, precio);
    lista.append(fila);
  }
}

$('#comprar').addEventListener('click', async () => {
  await cargarTarifas();
  mostrar('tarifas');
  dialogo.showModal();
  mostrar('tarifas');
});

$('#cerrar').addEventListener('click', () => dialogo.close());
$('#fin').addEventListener('click', () => dialogo.close());
dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(); });
dialogo.addEventListener('close', () => { $('#comprar').focus(); });

$('#form-tarifas').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = new FormData(e.target).get('tarifa');
  elegida = tarifas.find((t) => t.id === id);
  const err = $('#err-tarifa');
  if (!elegida) { err.textContent = 'Elige una tarifa para continuar.'; err.hidden = false; return; }
  err.hidden = true;
  $('#resumen').textContent = `${elegida.nombre} · ${eur.format(elegida.centimos / 100)}${elegida.periodo === 'mes' ? ' / mes' : ' (pago único)'}`;
  mostrar('datos');
});

$('#atras').addEventListener('click', () => mostrar('tarifas'));

function pintarErrores(errores = {}) {
  document.querySelectorAll('[data-err]').forEach((el) => (el.textContent = errores[el.dataset.err] || ''));
}

$('#form-datos').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const cuerpo = {
    tarifa: elegida?.id, nombre: f.get('nombre'), email: f.get('email'), ciudad: f.get('ciudad'),
    motivo: f.get('motivo'), web: f.get('web'), consentimiento: f.get('consentimiento') === 'on',
  };
  const boton = $('#enviar'); const general = $('#err-general');
  general.hidden = true; pintarErrores();
  boton.disabled = true; boton.textContent = 'Emitiendo…';
  try {
    const r = await fetch('/api/comprar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const datos = await r.json().catch(() => ({}));
    if (r.status === 422) { pintarErrores(datos.errores); document.querySelector('.error:not(:empty)')?.closest('label, .check, span')?.scrollIntoView?.({ block: 'center' }); return; }
    if (!r.ok) { general.textContent = datos.error || 'Algo ha fallado. Inténtalo de nuevo.'; general.hidden = false; return; }
    if (datos.factura) {
      $('#f-numero').textContent = datos.factura.numero;
      $('#f-tarifa').textContent = datos.factura.tarifa;
      $('#f-total').textContent = eur.format(datos.factura.total / 100);
    } else { // respuesta de la trampa anti-bots
      $('#f-numero').textContent = '—'; $('#f-tarifa').textContent = elegida.nombre; $('#f-total').textContent = eur.format(elegida.centimos / 100);
    }
    e.target.reset();
    mostrar('factura');
  } catch {
    general.textContent = 'Sin conexión con el departamento de vidas.'; general.hidden = false;
  } finally {
    boton.disabled = false; boton.textContent = 'Emitir factura';
  }
});
