// Envio de correo via Microsoft Graph API (Entra ID, client-credentials):
// usa un buzon real de Microsoft 365 de la organizacion en vez de un
// proveedor externo. Requiere en el entorno: AZURE_TENANT_ID,
// AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (de la app registrada en Entra, con
// el permiso de aplicacion Mail.Send consentido) y EMAIL_FROM (el buzon
// desde el que se envia -- restringido a ese buzon via Exchange Online
// PowerShell, ver guia de configuracion).
let tokenCache = null; // { token, expiraEn }

async function obtenerTokenGraph() {
  if (tokenCache && tokenCache.expiraEn > Date.now() + 60_000) return tokenCache.token;

  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
    throw new Error('AZURE_TENANT_ID, AZURE_CLIENT_ID y AZURE_CLIENT_SECRET deben estar definidas en el entorno para enviar correo');
  }

  const body = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const resp = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    throw new Error(`No se pudo obtener el token de Microsoft Graph (${resp.status}): ${await resp.text()}`);
  }
  const data = await resp.json();
  tokenCache = { token: data.access_token, expiraEn: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

function comoDestinatarios(valor) {
  return (Array.isArray(valor) ? valor : [valor]).map((direccion) => ({ emailAddress: { address: direccion } }));
}

// destinatario: string o array de strings. html es opcional (si no se
// pasa, se envia como texto plano). cc es opcional (string o array).
async function enviarCorreo({ destinatario, asunto, texto, html, cc }) {
  const remitente = process.env.EMAIL_FROM;
  if (!remitente) throw new Error('EMAIL_FROM debe estar definida en el entorno para enviar correo');

  const token = await obtenerTokenGraph();
  const mensaje = {
    message: {
      subject: asunto,
      body: { contentType: html ? 'HTML' : 'Text', content: html || texto },
      toRecipients: comoDestinatarios(destinatario),
      ...(cc ? { ccRecipients: comoDestinatarios(cc) } : {}),
    },
    saveToSentItems: false,
  };

  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(remitente)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mensaje),
  });
  if (!resp.ok) {
    throw new Error(`No se pudo enviar el correo (${resp.status}): ${await resp.text().catch(() => '')}`);
  }
}

module.exports = { enviarCorreo };
