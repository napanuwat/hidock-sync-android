// hidock-auth Worker v1.0
// CORS proxy ให้หน้าเว็บ (GitHub Pages) ทำ device code flow กับ Microsoft ได้
// forward เฉพาะ 2 endpoints ของ login.microsoftonline.com/consumers และ
// ยอมเฉพาะ client_id ของ Microsoft Graph Command Line Tools เท่านั้น (กันคนอื่น abuse)

const ALLOWED_CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
const BASE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const CORS = {
  'Access-Control-Allow-Origin': 'https://napanuwat.github.io',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const path = new URL(req.url).pathname.replace(/^\/+/, '');
    if (req.method !== 'POST' || !['devicecode', 'token'].includes(path)) {
      return new Response('not found', { status: 404, headers: CORS });
    }
    const body = await req.text();
    if (new URLSearchParams(body).get('client_id') !== ALLOWED_CLIENT_ID) {
      return new Response(JSON.stringify({ error: 'client_id not allowed' }), { status: 403, headers: CORS });
    }
    const upstream = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
