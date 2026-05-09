const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  // MP siempre espera un 200 — responder rápido ante cualquier error
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const type = payload.type;
    const dataId = payload.data?.id;

    // Si no hay ID útil, ignorar silenciosamente
    if (!dataId) {
      return { statusCode: 200, body: 'OK' };
    }

    let payerEmail = null;
    let payerName = '';

    // --- Pago individual (primera cuota de suscripción) ---
    if (type === 'payment') {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await res.json();

      // Solo procesar pagos aprobados
      if (payment.status !== 'approved') {
        return { statusCode: 200, body: 'OK' };
      }

      payerEmail = payment.payer?.email;
      payerName = payment.payer?.first_name || '';
    }

    // --- Evento de suscripción (preapproval) ---
    else if (type === 'subscription_preapproval') {
      const res = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const subscription = await res.json();

      // Solo procesar suscripciones autorizadas
      if (subscription.status !== 'authorized') {
        return { statusCode: 200, body: 'OK' };
      }

      payerEmail = subscription.payer_email;
    }

    // Tipo de evento que no nos interesa
    else {
      return { statusCode: 200, body: 'OK' };
    }

    if (!payerEmail) {
      return { statusCode: 200, body: 'OK' };
    }

    // --- Envío de emails via Gmail ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const greeting = payerName ? `Hola ${payerName}` : 'Hola';
    const oracleCode = process.env.ORACLE_CODE || 'ORACULO2026';
    const appUrl = 'https://octavocielo.netlify.app/octavo-cielo-electiva.html';

    // Email al suscriptor
    await transporter.sendMail({
      from: `"Octavo Cielo" <${process.env.GMAIL_USER}>`,
      to: payerEmail,
      subject: 'Tu acceso a El Oráculo — Octavo Cielo',
      html: `
        <div style="font-family: Georgia, serif; max-width: 580px; margin: 0 auto; padding: 40px 24px; background-color: #1a1a3e; color: #f8f5f0;">

          <h1 style="color: #c9a84c; font-size: 26px; margin: 0 0 4px 0; letter-spacing: 1px;">Octavo Cielo</h1>
          <p style="color: #c4a8d4; font-size: 13px; margin: 0 0 28px 0;">Donde el alma se alinea con el cosmos</p>

          <hr style="border: none; border-top: 1px solid #7b5ea7; margin-bottom: 28px;">

          <p style="font-size: 17px; margin: 0 0 16px 0;">${greeting},</p>

          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
            Tu suscripción a <strong>El Oráculo</strong> está activa.
            Ya podés acceder a consultas ilimitadas de astrología electiva con inteligencia artificial.
          </p>

          <p style="font-size: 13px; color: #c4a8d4; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Tu código de acceso</p>

          <div style="background-color: #2d1f5e; border: 1px solid #7b5ea7; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #c9a84c;">${oracleCode}</span>
          </div>

          <p style="font-size: 14px; color: #c4a8d4; line-height: 1.7; margin: 0 0 20px 0;">
            Para activarlo: ingresá a El Oráculo, tocá <em>"¿Ya tenés un código?"</em> e ingresá este código.
          </p>

          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${appUrl}" style="display: inline-block; background-color: #7b5ea7; color: #f8f5f0; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 15px; letter-spacing: 0.5px;">
              Ir a El Oráculo
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #7b5ea7; margin-bottom: 20px;">

          <p style="font-size: 12px; color: #7b5ea7; line-height: 1.6; margin: 0;">
            Si tenés alguna consulta, respondé este mail y te contesto a la brevedad.<br>
            Con amor, Anita — Octavo Cielo
          </p>

        </div>
      `
    });

    // Notificación interna para Anita
    await transporter.sendMail({
      from: `"Octavo Cielo Bot" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      subject: `Nueva suscripción El Oráculo — ${payerEmail}`,
      text: `Nueva suscripción activada.\n\nEmail: ${payerEmail}\nNombre: ${payerName || 'No disponible'}\nFecha: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`
    });

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    // Siempre responder 200 a MP para que no reintente infinitamente
    console.error('Error en mp-webhook:', err.message);
    return { statusCode: 200, body: 'OK' };
  }
};
