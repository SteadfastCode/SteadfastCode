// GET /api/admin/projects/:id/agreement: the agreement as the client will see it, and the signed
// copy if there is one (?signed=1).
import { json } from '../../_middleware.js';
import { agreementState } from '../../../../../server/agreement.js';

export async function onRequestGet({ request, env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  if (new URL(request.url).searchParams.get('signed')) {
    const a = await env.INTAKE.prepare('SELECT text, sha256, signer_name, signed_at, ip, user_agent, emailed_to, portfolio_ok FROM agreements WHERE project_id = ? ORDER BY signed_at DESC LIMIT 1').bind(p.id).first();
    return a ? json(a) : json({ error: 'Nothing signed yet.' }, 404);
  }
  return json(await agreementState(env, p));
}
