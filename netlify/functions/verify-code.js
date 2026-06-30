const crypto = require('crypto');

/**
 * Genera un token HMAC mensual que el cliente almacena y el Worker valida.
 * El código nunca viaja al browser — solo el token derivado.
 *
 * Token = HMAC-SHA256( ORACLE_CODE + ":" + "YYYY-MM", HMAC_SECRET )
 * Caduca automáticamente al cambiar el mes calendario.
 */
function generarTokenMensual(oracleCode, hmacSecret) {
  const mesActual = new Date().toISOString().slice(0, 7); // "2026-06"
  return crypto
    .createHmac('sha256', hmacSecret)
    .update(`${oracleCode}:${mesActual}`)
    .digest('hex');
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verificar Origin para evitar llamadas desde dominios externos
  const origin = event.headers['origin'] || '';
  const allowedOrigins = [
    'https://octavocielo.netlify.app',
    'https://octavocielo.com.ar',
    'https://www.octavocielo.com.ar'
  ];
  if (!allowedOrigins.includes(origin)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const oracleCode = process.env.ORACLE_CODE;
  const hmacSecret = process.env.HMAC_SECRET;

  if (!oracleCode || !hmacSecret) {
    console.error('verify-code: variables de entorno ORACLE_CODE o HMAC_SECRET no configuradas');
    return { statusCode: 500, body: 'Configuración incompleta en el servidor' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const codigoIngresado = (body.code || '').trim().toUpperCase();

  if (!codigoIngresado) {
    return { statusCode: 400, body: 'Falta el campo "code"' };
  }

  // Comparación en tiempo constante para evitar timing attacks
  const codigoEsperado = oracleCode.trim().toUpperCase();
  const codigoBuffer = Buffer.from(codigoIngresado.padEnd(64));
  const esperadoBuffer = Buffer.from(codigoEsperado.padEnd(64));
  const valido = crypto.timingSafeEqual(codigoBuffer, esperadoBuffer);

  if (!valido) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin
      },
      body: JSON.stringify({ valid: false })
    };
  }

  const token = generarTokenMensual(oracleCode, hmacSecret);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin
    },
    body: JSON.stringify({ valid: true, token })
  };
};
