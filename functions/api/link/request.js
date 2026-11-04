// POST /api/link/request { email }: "Email me my link" on /client (2026-11-04). A client who lost
// their private link types the email on their project; if it matches, the link goes to that inbox.
// The answer is the same whether or not it matched, so the form can't be used to find out who's a
// client. A link that still works is sent again (it's kept encrypted, server/client.js); otherwise
// a new one is made, and older links keep working. One email per project every 10 minutes.
import { newToken, hashToken, sealToken, openToken, LINK_DAYS } from '../../../server/client.js';
import { logEvent } from '../../../server/view.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const SAME = { ok: true, message: 'If that email is on a project, a link is on its way. It can take a minute; check your spam folder too.' };

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Only from the sign-in page.' }, 403);
  if (!env.INTAKE || !env.RESEND_API_KEY) return json({ error: 'Email sign-in isn’t available right now. Email support@steadfastcode.tech and Daniel will send your link.' }, 503);
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: 'Type the email address on your project.' }, 400);
  const { results } = await env.INTAKE.prepare("SELECT id, answers FROM projects WHERE status != 'closed' AND lower(json_extract(answers, '$.email')) = ? ORDER BY updated_at DESC LIMIT 3").bind(email).all();
  const now = new Date();
  const since = new Date(now.getTime() - 10 * 60_000).toISOString();
  const links = [];
  for (const p of results) {
    const recent = await env.INTAKE.prepare("SELECT 1 FROM project_events WHERE project_id = ? AND what = 'Emailed the client their link' AND at > ?").bind(p.id, since).first();
    if (recent) continue;
    const live = await env.INTAKE.prepare('SELECT token_enc FROM client_links WHERE project_id = ? AND revoked_at IS NULL AND expires_at > ? AND token_enc IS NOT NULL ORDER BY created_at DESC LIMIT 1').bind(p.id, now.toISOString()).first();
    let token = live ? await openToken(env, live.token_enc) : null;
    if (!token) {
      token = newToken();
      await env.INTAKE.prepare('INSERT INTO client_links (id, project_id, token_hash, token_enc, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), p.id, await hashToken(token), await sealToken(env, token), now.toISOString(), new Date(now.getTime() + LINK_DAYS * 86400_000).toISOString()).run();
    }
    const a = JSON.parse(p.answers);
    links.push({ id: p.id, business: a.businessName || 'your website', name: (a.contactName || '').split(' ')[0], url: `${url.origin}/client#${token}` });
  }
  if (!links.length) return json(SAME);
  const text = [
    `Hi${links[0].name ? ' ' + links[0].name : ''},`,
    '',
    links.length === 1 ? `Here's your private link to ${links[0].business} on Steadfast Code:` : 'Here are your private links on Steadfast Code:',
    '',
    ...links.map((l) => (links.length === 1 ? l.url : `${l.business}: ${l.url}`)),
    '',
    'It opens your project: your site, your details, your care plan and your signed documents. Keep it to yourself; anyone with the link can open your project. Bookmark it, or come back to steadfastcode.tech/client for a new email any time.',
    '',
    'If you didn’t ask for this, you can ignore it.',
    '',
    'Daniel',
  ].join('\n');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: [email], reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: 'Your Steadfast Code link', text }),
  }).catch(() => null);
  if (r?.ok) for (const l of links) await logEvent(env, l.id, 'box', 'Emailed the client their link');
  return json(SAME);
}
