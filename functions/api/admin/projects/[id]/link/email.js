// POST /api/admin/projects/:id/link/email: "Email it to them" on the client link card (2026-11-13).
// Sends the client their link at the email on the project. A link that still works is sent as it is
// (kept encrypted, server/client.js); without one a new one is made, and older links keep working.
import { json } from '../../../_middleware.js';
import { tokenForEmail } from '../../../../../../server/messages.js';
import { logEvent } from '../../../../../../server/view.js';

export async function onRequestPost({ request, env, params, data }) {
  const p = await env.INTAKE.prepare('SELECT id, answers FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  if (!env.RESEND_API_KEY) return json({ error: 'Email isn’t set up on this deployment (RESEND_API_KEY). Copy the link and send it yourself.' }, 503);
  const a = JSON.parse(p.answers);
  const to = String(a.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 200) return json({ error: 'The project has no email address for the client yet. Add it under their details first.' }, 400);
  const url = `${new URL(request.url).origin}/client#${await tokenForEmail(env, p.id)}`;
  const first = (a.contactName || '').split(' ')[0];
  const text = [
    `Hi${first ? ' ' + first : ''},`,
    '',
    `Here's your private link to ${a.businessName || 'your website'} on Steadfast Code:`,
    '',
    url,
    '',
    'It opens your project page: fill in your details, upload photos and logos, and watch the build come together. Keep it to yourself; anyone with the link can open your project. Bookmark it, or come back to steadfastcode.tech/client for a new email any time.',
    '',
    'Any questions, just reply to this email.',
    '',
    'Daniel',
  ].join('\n');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: [to], reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: `Your project link · ${a.businessName || 'Steadfast Code'}`, text }),
  }).catch(() => null);
  if (!r?.ok) return json({ error: 'The email didn’t go out (Resend didn’t accept it). Copy the link and send it yourself.' }, 502);
  await logEvent(env, p.id, data.email, `Emailed the client their link (${to})`);
  return json({ ok: true, to });
}
