/**
 * Compra aquí una vida — envío de facturas por Gmail mediante Google Apps Script.
 *
 * Qué hace: recibe por HTTPS (POST) la factura que prepara la web y te la envía por correo
 * desde TU cuenta de Google, con el HTML completo y el logo incrustado.
 *
 * Seguridad:
 *  - El destinatario NO viene en la petición: es siempre el dueño del script (tú). Así nadie
 *    puede usar este endpoint para mandar correo a terceros.
 *  - Exige una clave compartida (CLAVE). Debe ser idéntica a APPS_SCRIPT_KEY de la web.
 *
 * Puesta en marcha: ver apps-script/LEEME.md
 */

// 1) Pon aquí una clave larga y secreta (p. ej. salida de `openssl rand -hex 24`).
const CLAVE = 'PEGA_AQUI_TU_CLAVE_SECRETA';

function doPost(e) {
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (CLAVE === 'PEGA_AQUI_TU_CLAVE_SECRETA' || datos.clave !== CLAVE) {
      return responder({ ok: false, error: 'clave incorrecta' });
    }
    if (!datos.asunto || !datos.html || !datos.texto) {
      return responder({ ok: false, error: 'faltan campos' });
    }

    const opciones = {
      to: Session.getEffectiveUser().getEmail(), // el dueño del script
      subject: String(datos.asunto).slice(0, 200),
      body: String(datos.texto),
      htmlBody: String(datos.html),
      name: 'Facturación · Compra Aquí Una Vida',
    };
    if (datos.responder) opciones.replyTo = String(datos.responder);
    if (datos.logo) {
      opciones.inlineImages = {
        marca: Utilities.newBlob(Utilities.base64Decode(datos.logo), 'image/png', 'marca.png'),
      };
    }

    MailApp.sendEmail(opciones);
    return responder({ ok: true });
  } catch (err) {
    return responder({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ejecútala UNA VEZ a mano desde el editor (desplegable de funciones → autorizar → Ejecutar)
 * para que Google te pida y conceda el permiso de enviar correo. Te llega un correo de aviso.
 */
function autorizar() {
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    'Permiso concedido · Compra aquí una vida',
    'El script ya puede enviar facturas desde esta cuenta.'
  );
}
