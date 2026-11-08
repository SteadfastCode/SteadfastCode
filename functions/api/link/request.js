// POST /api/link/request { email }: "Email me my link" on /client (2026-11-04). A client who lost
// their private link types the email on their project; if it matches, the link goes to that inbox.
// The answer is the same whether or not it matched, so the form can't be used to find out who's a
// client. A link that still works is sent again (it's kept encrypted, server/client.js); otherwise
// a new one is made, and older links keep working. One email per project every 10 minutes.
import { tokenForEmail } from '../../../server/messages.js';
import { logEvent } from '../../../server/view.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const SAME = { ok: true, message: 'If that email is on a project, a link is on its way. It can take a minute; check your spam folder too.' };

export async function onRequestPost({ request, env, waitUntil }) {
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
    const token = await tokenForEmail(env, p.id, now);
    const a = JSON.parse(p.answers);
    links.push({ id: p.id, business: a.businessName || 'your website', name: (a.contactName || '').split(' ')[0], url: `${url.origin}/client#${token}` });
  }
  if (!links.length) return json(SAME);
  // Logged before the send: the ten-minute limit holds even when Resend is down, and a match answers
  // as fast as a miss (the email goes out after the answer), so timing says nothing about who's a client.
  for (const l of links) await logEvent(env, l.id, 'box', 'Emailed the client their link');
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
  const send = fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: [email], reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: 'Your Steadfast Code link', text }),
  }).catch(() => null);
  if (typeof waitUntil === 'function') waitUntil(send); else await send;
  return json(SAME);
}
