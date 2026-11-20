# Compra aquí una vida

Web de broma con aspecto profesional: un letrero que dice «Compra aquí una vida». Al pulsar **Comprar**:

1. Muestra las **tarifas de vida** (los pagos no son reales).
2. Pide los datos del «titular» y **envía una factura de broma por correo al dueño de la web** con esos datos y la tarifa elegida.

El visitante no recibe correo alguno (la web no puede usarse para escribir a terceros). Todo documento lleva la aclaración de que no tiene validez fiscal ni jurídica.

Estilo visual: [Takumi](https://github.com/Takumi-Organization) (monocromo, corte diagonal, Outfit + JetBrains Mono, OFL en `public/fonts`).

## Arranque

```bash
npm install
# edita .env y pega tu contraseña de aplicación de Google en SMTP_PASS (ya viene todo lo demás)
npm run probar-correo    # envía una factura de ejemplo a MAIL_TO y dice si funcionó
npm start                # http://127.0.0.1:3417
npm test                 # 11 pruebas (node:test)
```

**Contraseña de aplicación de Google:** cuenta de Google → Seguridad → Verificación en 2 pasos (activada) → «Contraseñas de aplicaciones» → crea una y pégala en `SMTP_PASS` (valen los espacios). No sirve la contraseña normal.

Modos de envío, por prioridad: **SMTP** (si hay `SMTP_HOST` y `SMTP_PASS`) → **FormSubmit.co** (si solo hay `MAIL_TO`; sin claves, un clic de activación) → **desarrollo** (sin nada: guarda en `outbox/`).

Si publicas la web, pon `SITE_URL` (solo lo usa FormSubmit) y `TRUST_PROXY=true` detrás de un proxy.

## El correo
Factura con cabecera y logo de marca, saludo y titular con el nombre del comprador, tabla de datos (cliente, correo, ciudad, motivo, IP, navegador legible), concepto con una cláusula graciosa propia de cada tarifa, base + IVA + total, sello «pendiente de pago», vencimiento y recargo. **Responder** escribe directamente al comprador. Diseño en tablas con estilos en línea y modo claro forzado para que se vea igual en Gmail/Outlook/móvil; incluye versión en texto plano.

## Despliegue (Render)
GitHub Pages **no sirve**: solo aloja páginas estáticas y la web necesita el servidor Node. `render.yaml` deja el despliegue preparado: Render → New → Blueprint → este repo; te pide `MAIL_TO` y `SITE_URL`.

- **Plan gratuito:** Render bloquea el SMTP saliente (465/587), así que el correo sale por FormSubmit (hay que activar el formulario una vez con el enlace que llega a `MAIL_TO`). Se duerme tras 15 min sin visitas y tarda ~1 min en despertar.
- **Correo HTML por Gmail (SMTP):** requiere un plan de pago de Render u otro host que permita SMTP; añade las variables SMTP en su panel (nunca en el repo).
- Comprobado en la documentación de Render el 2026-11-21; revisa límites y precios antes de contratar.

## Estructura
- `server.js` — servidor HTTP (sin framework), API `GET /api/tarifas` y `POST /api/comprar`, estáticos, cabeceras de seguridad.
- `src/tarifas.js` — tarifas e importes **decididos por el servidor** (el cliente solo manda el id).
- `src/validar.js` · `src/factura.js` · `src/correo.js` — validación, factura (texto + HTML escapado), envío SMTP / bandeja local.
- `public/` — letrero, diálogo de 3 pasos, CSS.

## Protecciones
Validación y saneado (sin saltos de línea en cabeceras), HTML escapado en el correo, límite de compras por IP y global, campo trampa anti-bots, comprobación de `Origin`, cuerpo máximo 8 KB, CSP estricta. Detrás de un proxy inverso, `TRUST_PROXY=true` para ver la IP real.

## Privacidad
Se envían por correo: nombre, correo, ciudad, motivo, IP y navegador. **No se guarda nada en el servidor.** El visitante lo acepta con una casilla antes de enviar. Las políticas legales enlazadas en el pie son las de Takumi-Organization (plantillas, no asesoramiento jurídico); si la publicas con tu propio nombre, revisa el responsable del tratamiento.

## Licencia
MIT.
