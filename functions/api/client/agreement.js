// GET /api/client/agreement: the agreement to sign (or the signed one, with ?signed=1).
// POST /api/client/agreement { name, agreed, sha256, portfolio? }: sign it.
import { json } from './_middleware.js';
import { agreementState, checkSignature, emailSignedCopy } from '../../../server/agreement.js';
import { logEvent } from '../../../server/view.js';

export async function onRequestGet({ request, env, data }) {
  if (new URL(request.url).searchParams.get('signed')) {
    const a = await env.INTAKE.prepare('SELECT text, sha256, signer_name, signed_at FROM agreements WHERE project_id = ? ORDER BY signed_at DESC LIMIT 1').bind(data.project.id).first();
    return a ? json({ text: a.text, sha256: a.sha256, name: a.signer_name, signedAt: a.signed_at }) : json({ error: 'Nothing signed yet.' }, 404);
  }
  return json(await agreementState(env, data.project));
}

export async function onRequestPost({ request, env, data }) {
  const p = data.project;
  const state = await agreementState(env, p);
  if (!state.needed) return json({ ok: true, already: true, ...state });
  const body = await request.json().catch(() => null);
  const c = checkSignature(body, state.current);
  if (c.error) return json({ error: c.error, stale: !!c.stale }, c.stale ? 409 : 400);
  const answers = JSON.parse(p.answers);
  const now = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = (request.headers.get('user-agent') || '').slice(0, 300);
  const id = crypto.randomUUID();
  await env.INTAKE.prepare('INSERT INTO agreements (id, project_id, version, terms_key, text, sha256, signer_name, signed_at, ip, user_agent, link_id, portfolio_ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, p.id, state.current.version, state.current.key, state.current.text, state.current.sha256, c.name, now, ip, ua, data.link.id, c.portfolioOk).run();
  await logEvent(env, p.id, 'client', `${c.name} signed the website agreement${c.portfolioOk === 1 ? ' (and said yes to showing the site on the Work page)' : ''}`);
  // The copy goes out after the signature is recorded; a mail failure never undoes a signing.
  const mailed = await emailSignedCopy(env, { to: answers.email, name: c.name, signedAt: now, text: state.current.text, sha: state.current.sha256, ip, business: answers.businessName });
  if (mailed.length) await env.INTAKE.prepare('UPDATE agreements SET emailed_to = ? WHERE id = ?').bind(mailed.join(', '), id).run();
  return json({ ok: true, mailedTo: mailed, ...(await agreementState(env, p)) });
}
