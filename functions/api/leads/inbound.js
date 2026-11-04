// POST /api/leads/inbound (2026-11-03): where Front Desk, once it is hosted, or any other intake of
// Daniel's hands a lead to the board, the mirror image of CONTACT_FORWARD_URL (the contact form's
// way of sending a submission out). Bearer LEADS_INBOUND_SECRET; without the secret configured the
// endpoint does not exist as far as a caller can tell. The body is the contact form's shape:
//   { name, email, phone?, business?, plan?, site?, message, sourceDetail? }
// The lead lands on the board as `inbound` and `new`, with sourceDetail saying where it came from
// ("front-desk: missed call"), and the first touch holds the message.

const FIELDS = { name: 120, email: 200, phone: 40, business: 160, plan: 40, site: 300, message: 5000, sourceDetail: 160 };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Same length and same bytes, checked without an early exit on the first difference. */
function sameSecret(given, expected) {
  const a = new TextEncoder().encode(String(given ?? ''));
  const b = new TextEncoder().encode(String(expected ?? ''));
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADS_INBOUND_SECRET) return json({ error: 'Not found.' }, 404);
  const auth = request.headers.get('authorization') ?? '';
  if (!sameSecret(auth, `Bearer ${env.LEADS_INBOUND_SECRET}`)) return json({ error: 'Not allowed.' }, 401);
  if (!env.INTAKE) return json({ error: 'The INTAKE database is not bound to this deployment.' }, 503);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Send a JSON object.' }, 400);
  const data = {};
  for (const [f, max] of Object.entries(FIELDS)) data[f] = String(body[f] ?? '').trim().slice(0, max);
  if (!data.name && !data.business) return json({ error: 'A name or a business is required.' }, 400);
  if (!data.message) return json({ error: 'A message is required.' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.INTAKE.batch([
    env.INTAKE.prepare("INSERT INTO leads (id, received_at, updated_at, kind, name, email, phone, business, plan, site, message, source_detail, status) VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?, ?, 'new')")
      .bind(id, now, now, data.name, data.email, data.phone || null, data.business || null, data.plan || null, data.site || null, data.message, data.sourceDetail || 'inbound'),
    env.INTAKE.prepare("INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, 'note', ?, NULL, ?)").bind(id, now, data.message, data.sourceDetail ? data.sourceDetail.split(':')[0].trim().slice(0, 40) : 'inbound'),
  ]);
  return json({ id }, 201);
}
