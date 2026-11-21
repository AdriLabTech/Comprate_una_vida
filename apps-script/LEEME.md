# Envío de facturas con Google Apps Script

Sirve en Render gratis (que bloquea el SMTP): la web llama por HTTPS a un script de tu cuenta de Google, que envía el correo con tu Gmail y el diseño completo.

## 1. Crear el script (una vez, ~5 min)
1. Entra en <https://script.google.com> con **la cuenta que debe recibir las facturas** (el destinatario es siempre el dueño del script).
2. **Nuevo proyecto**. Borra el código de ejemplo y pega todo el contenido de `apps-script/Code.gs`.
3. En la primera línea de código cambia `PEGA_AQUI_TU_CLAVE_SECRETA` por una clave larga inventada por ti (por ejemplo la salida de `openssl rand -hex 24`). **Guárdala**: la necesitas en el paso 3.
4. Guarda (icono del disquete).

## 2. Publicarlo como aplicación web
1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Rueda de engranaje → tipo **Aplicación web**.
3. **Ejecutar como: Yo** · **Quién tiene acceso: Cualquier persona**.
4. **Implementar** y concede los permisos. Google avisará de «aplicación no verificada»: *Configuración avanzada → Ir a (nombre del proyecto)*. Es tu propio script.
5. Copia la **URL de la aplicación web** (termina en `/exec`).

> Los nombres de botones pueden variar un poco según la versión de la interfaz de Google.

## 3. Conectar la web
Define estas dos variables (en Render: servicio → *Environment*; en local: `.env`):

```
APPS_SCRIPT_URL=<la URL que termina en /exec>
APPS_SCRIPT_KEY=<la misma clave del paso 1.3>
```

Con ellas definidas la web usa Apps Script en lugar de FormSubmit (si además hay SMTP con contraseña, gana SMTP). Reinicia/redespliega y haz una compra de prueba.

## Si cambias el script
Cada cambio en `Code.gs` requiere **Implementar → Administrar implementaciones → editar → Nueva versión**; si no, la URL sigue ejecutando la versión antigua.

## Errores típicos (salen en los logs como `[correo] fallo al enviar: …`)
- `no es JSON` → la implementación no tiene acceso «Cualquier persona», o la URL es la del editor y no la `/exec`.
- `clave incorrecta` → `APPS_SCRIPT_KEY` no coincide con la de `Code.gs` (o sigue la de plantilla).
- `Service invoked too many times` / cuota → Google limita los correos diarios por cuenta.

## Seguridad
El destinatario no viaja en la petición: lo fija el script (dueño de la cuenta). Quien conozca la URL pero no la clave no puede enviar nada. Trata la clave como una contraseña y no la subas a GitHub.
