// POST /api/client/care { name, agreed, sha256 }: the client signs the care plan Daniel offered.
// The terms are stored exactly as shown, like the website contract, and a copy goes by email.
import { json } from '../_middleware.js';
import { careState, checkCareSignature, updateCare } from '../../../../server/care.js';
import { emailSignedCopy } from '../../../../server/agreement.js';
import { logEvent } from '../../../../server/view.js';

// GET /api/client/care?signed=1: the signed care plan, word for word, for the Documents tab.
export async function onRequestGet({ env, data }) {
  const c = await env.INTAKE.prepare('SELECT terms_text, terms_sha256, signer_name, signed_at FROM care_plans WHERE project_id = ? AND signed_at IS NOT NULL').bind(data.project.id).first();
  return c ? json({ text: c.terms_text, sha256: c.terms_sha256, name: c.signer_name, signedAt: c.signed_at }) : json({ error: 'Nothing signed yet.' }, 404);
}

export async function onRequestPost({ request, env, data }) {
  const p = data.project;
  const care = await careState(env, p, 'client');
  if (!care) return json({ error: 'There’s no care plan to sign yet.' }, 404);
  if (care.signed) return json({ ok: true, already: true, care });
  const body = await request.json().catch(() => null);
  const c = checkCareSignature(body, care.terms);
  if (c.error) return json({ error: c.error, stale: !!c.stale }, c.stale ? 409 : 400);
  const now = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || '';
  await updateCare(env, p.id, {
    status: 'signed', first_bill_at: care.terms.firstBill, terms_version: care.terms.version, terms_text: care.terms.text, terms_sha256: care.terms.sha256,
    signer_name: c.name, signed_at: now, signer_ip: ip, signer_agent: (request.headers.get('user-agent') || '').slice(0, 300),
  });
  await logEvent(env, p.id, 'client', `${c.name} signed the ${care.planName} care plan`);
  const answers = JSON.parse(p.answers);
  await emailSignedCopy(env, { to: answers.email, name: c.name, signedAt: now, text: care.terms.text, sha: care.terms.sha256, ip, business: answers.businessName, what: 'care plan' });
  return json({ ok: true, care: await careState(env, p, 'client') });
}
