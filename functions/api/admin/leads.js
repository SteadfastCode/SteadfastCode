// GET /api/admin/leads: contact-form submissions not yet turned into a project, newest first.
import { json } from './_middleware.js';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare("SELECT id, received_at, name, email, phone, business, plan, site, message FROM leads WHERE status = 'new' ORDER BY received_at DESC LIMIT 50").all();
  return json({ leads: results });
}
