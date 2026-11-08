// POST /api/forms/:project: the contact form on a client's website (2026-11-03).
//
// Client sites are static (Cloudflare Pages, no functions, no secrets), so their form posts here, a
// plain HTML form with no script needed. The message goes by email to the address on the client's
// project (answers.email in the intake), never to an address the form names, so this can't be used
// to send mail anywhere else. Then the visitor goes back to the page they sent it from, with ?sent=1
// (or ?sent=0 and the reason, so the page can say to call or email instead). The way back is only
// ever to that client's own addresses: its preview on pages.dev or its domain.
//
// A form that silently swallows a message is the one failure this must never have: anything short
// of Resend accepting the email is ?sent=0.
import { cleanForm, returnTo, formEmail } from '../../../server/forms.js';
import { logEvent } from '../../../server/view.js';

// Anyone can post here (the form's address is on every page of the client's site), so one site
// sends at most this many messages an hour, and one visitor this many in ten minutes. Past that the
// page says to call or email instead. Each send is a line in the project's activity, which is also
// the count. The visitor's address is kept only as a short hash, to tell one from another.
const FORM_PER_HOUR = 30;
const FORM_PER_VISITOR = 5;
const shortHash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');

export async function onRequestPost({ request, env, params }) {
  const p = env.INTAKE ? await env.INTAKE.prepare('SELECT id, slug, status, answers, preview_url FROM projects WHERE id = ?').bind(String(params.project)).first().catch(() => null) : null;
  if (!p || p.status === 'closed') return new Response('This form is not set up.', { status: 404, headers: { 'content-type': 'text/plain' } });
  const answers = JSON.parse(p.answers);
  const form = await request.formData().catch(() => null);
  const back = returnTo(form?.get('return'), p, answers, { dev: !!env.DEV_EMAIL });
  const go = (sent, why) => {
    const u = new URL(back);
    u.searchParams.set('sent', sent ? '1' : '0');
    if (why) u.searchParams.set('why', why);
    u.hash = 'contact';
    return Response.redirect(u.toString(), 303);
  };
  if (!form) return go(false, 'missing');
  // Honeypot: a filled "company" field is a bot. Pretend it worked; give it nothing to learn from.
  if (form.get('company')) return go(true);
  const { data, problem } = cleanForm(form);
  if (problem) return go(false, problem);
  const mail = formEmail(data, answers, { from: env.CONTACT_FROM, page: back });
  if (!mail || !env.RESEND_API_KEY) return go(false, 'offline');
  const visitor = await shortHash(request.headers.get('cf-connecting-ip') || 'unknown');
  try {
    const since = (ms) => new Date(Date.now() - ms).toISOString();
    const [site, one] = await Promise.all([
      env.INTAKE.prepare("SELECT COUNT(*) AS n FROM project_events WHERE project_id = ? AND what LIKE 'Website form:%' AND at > ?").bind(p.id, since(3600_000)).first(),
      env.INTAKE.prepare('SELECT COUNT(*) AS n FROM project_events WHERE project_id = ? AND what LIKE ? AND at > ?').bind(p.id, `Website form:%[${visitor}]`, since(600_000)).first(),
    ]);
    if ((site?.n ?? 0) >= FORM_PER_HOUR || (one?.n ?? 0) >= FORM_PER_VISITOR) return go(false, 'busy');
  } catch {
    // The count is a guard, not the job: if it can't be read, the message still goes.
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify(mail),
    });
    if (r.ok) { try { await logEvent(env, p.id, 'box', `Website form: message from ${data.name.slice(0, 60)} [${visitor}]`); } catch { /* the message went; the count is the only loss */ } }
    return go(r.ok, r.ok ? null : 'offline');
  } catch {
    return go(false, 'offline');
  }
}
