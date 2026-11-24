// POST /api/admin/projects/:id/agreement/countersign { name, drawing, emailClient }: Daniel's
// signature on the contract, after the client's (2026-11-23), as Plumb's contractor countersigns a
// signed quote: a typed name and a drawn signature, recorded on the client's signature row with the
// time, address and browser, then the fully signed copy emailed to both (or only to Daniel).
// A mail failure never undoes the signature.
import { json } from '../../../_middleware.js';
import { agreementState, checkDrawing, emailSignedCopy } from '../../../../../../server/agreement.js';
import { logEvent } from '../../../../../../server/view.js';

export async function onRequestPost({ request, env, params, data }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const state = await agreementState(env, p);
  if (!state.signed?.valid) return json({ error: 'The client hasn’t signed this contract yet, so there’s nothing to countersign.' }, 409);
  if (state.signed.countersign) return json({ error: `Already countersigned by ${state.signed.countersign.name}.` }, 409);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || !/\s/.test(name) || name.length > 120) return json({ error: 'Type your full name (first and last) to sign.' }, 400);
  const d = checkDrawing(body?.drawing);
  if (d.error) return json({ error: d.error }, 400);
  const now = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = (request.headers.get('user-agent') || '').slice(0, 300);
  let r;
  try {
    r = await env.INTAKE.prepare('UPDATE agreements SET countersigner_name = ?, countersigned_at = ?, countersign_drawing = ?, countersign_ip = ?, countersign_ua = ? WHERE id = ? AND countersigned_at IS NULL')
      .bind(name, now, d.drawing, ip, ua, state.signed.id).run();
  } catch (e) {
    if (/no such column/i.test(e.message)) return json({ error: 'Countersigning needs migration 0024 on the database first.' }, 503);
    throw e;
  }
  if (!r.meta?.changes) return json({ error: 'Someone countersigned it a moment ago. Reload the page.' }, 409);
  await logEvent(env, p.id, data.email, `${name} countersigned the website contract`);
  const a = await env.INTAKE.prepare('SELECT text, sha256, signer_name, signed_at, ip FROM agreements WHERE id = ?').bind(state.signed.id).first();
  const answers = JSON.parse(p.answers);
  const mailedTo = await emailSignedCopy(env, {
    to: body.emailClient === false ? null : answers.email,
    name: a.signer_name, signedAt: a.signed_at, text: a.text, sha: a.sha256, ip: a.ip, business: answers.businessName,
    counter: { name, signedAt: now, drawing: d.drawing },
  });
  return json({ ok: true, mailedTo, ...(await agreementState(env, p)) });
}
