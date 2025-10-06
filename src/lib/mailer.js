import nodemailer from 'nodemailer';

// Crea (y memoiza) el transporter. Si faltan variables, se usa modo consola.
let cachedTransporter = null;

export function getMailer() {
  if (cachedTransporter) return cachedTransporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('[mailer] Variables SMTP incompletas. Se usará modo consola.');
    cachedTransporter = null; // explícito
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return cachedTransporter;
}

function buildTwoFactorTemplate(code) {
  const expiresMinutes = 5;
  const brand = process.env.MAIL_BRAND_NAME || 'LagoReport';
  const supportEmail = process.env.SUPPORT_EMAIL || 'soporte@lagoreport.com';
  const primaryColor = '#0087ff';
  const fontFamily = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif";
  const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charSet="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Código de verificación</title>
    <style>
      .container { max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;font-family:${fontFamily};border:1px solid #e5e7eb; }
      h1 { font-size:20px;margin:0 0 16px;color:#111827; }
      p { line-height:1.5;font-size:14px;color:#374151;margin:0 0 16px; }
      .code-wrapper { text-align:center;margin:32px 0; }
      .code-box { display:inline-block;background:#111827;color:#ffffff;font-size:28px;letter-spacing:8px;padding:14px 24px;border-radius:10px;font-weight:600;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; }
      .footer { font-size:11px;color:#6b7280;margin-top:32px;text-align:center;line-height:1.4; }
      .brand { font-weight:600; color:${primaryColor}; }
      a { color:${primaryColor};text-decoration:none; }
      .divider { height:1px;background:#e5e7eb;margin:32px 0; }
      .btn { display:inline-block;padding:12px 20px;border-radius:8px;background:${primaryColor};color:#ffffff;font-weight:600;font-size:14px;letter-spacing:0.5px; }
      @media (prefers-color-scheme: dark) {
        .container { background:#fff;border-color:#374151; }
        h1 { color:#000; }
        p { color:#333; }
        .footer { color:#fff; }
      }
    </style>
  </head>
  <body style="background:#f3f4f6;padding:24px;margin:0;">
    <div class="container">
      <h1>Verificación de seguridad</h1>
      <p>Hola,</p>
      <p>Recibimos un intento de acceso a tu cuenta en <span class="brand">${brand}</span>. Para continuar, introduce el siguiente código de verificación de un solo uso:</p>
      <div class="code-wrapper">
        <div class="code-box">${code.split('').join(' ')}</div>
      </div>
      <p>El código expira en <strong>${expiresMinutes} minutos</strong>. Si no fuiste tú, te recomendamos cambiar tu contraseña y contactar a soporte.</p>
      <div class="divider"></div>
      <p style="text-align:center;margin:0 0 8px;">Gracias por confiar en <span class="brand">${brand}</span>.</p>
      <p style="text-align:center;margin:0 0 24px;">¿Necesitas ayuda? Escríbenos a <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <div class="footer">
        Este correo se generó automáticamente. Si no solicitaste el código puedes ignorarlo.<br />
        &copy; ${new Date().getFullYear()} ${brand}. Todos los derechos reservados.
      </div>
    </div>
  </body>
  </html>`;
  const text = `Tu código 2FA es: ${code}\nExpira en ${expiresMinutes} minutos.\nSi no solicitaste este código, ignora este mensaje.`;
  return { html, text };
}

export async function sendTwoFactorCodeEmail({ to, code }) {
  const transporter = getMailer();
  const from = process.env.FROM_EMAIL || 'no-reply@example.com';
  const subject = 'Tu código de verificación';
  const { html, text } = buildTwoFactorTemplate(code);
  if (!transporter) {
    console.log(`[mailer:FALLBACK] Enviar a ${to}: ${text}`);
    return { fallback: true };
  }
  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    return { messageId: info.messageId };
  } catch (e) {
    console.error('[mailer] Error enviando email, fallback a consola:', e);
    console.log(`[mailer:FALLBACK] Enviar a ${to}: ${text}`);
    return { fallback: true, error: e.message };
  }
}
