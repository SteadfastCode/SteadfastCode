// The agreement side of a project (2026-11-02): what the client is asked to sign now, whether
// they already have, and recording a signature. The wording lives in src/data/agreement.ts.

import { agreementFor, termsKey } from '../src/data/agreement.ts';

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Where the project stands: `current` is the agreement as it would read today (null until a package
 * is picked), `signed` the latest signature, and `needed` whether the client must sign before going on
 * (no signature, or one for a different package, add-on or price).
 */
export async function agreementState(env, project) {
  const answers = typeof project.answers === 'string' ? JSON.parse(project.answers) : project.answers;
  const current = answers.tier ? agreementFor(answers) : null;
  const signed = await env.INTAKE.prepare('SELECT id, version, terms_key, sha256, signer_name, signed_at, portfolio_ok, emailed_to FROM agreements WHERE project_id = ? ORDER BY signed_at DESC LIMIT 1').bind(project.id).first();
  const valid = !!(signed && current && signed.terms_key === termsKey(answers));
  return {
    current: current ? { ...current, sha256: await sha256(current.text) } : null,
    signed: signed ? { id: signed.id, name: signed.signer_name, signedAt: signed.signed_at, version: signed.version, portfolioOk: signed.portfolio_ok, emailedTo: signed.emailed_to, valid } : null,
    needed: !valid,
    reason: !current ? 'no-package' : !signed ? 'unsigned' : valid ? null : 'changed',
    // Daniel can let a client read it early and sign at the meeting (0 = review only).
    signingOpen: project.signing_open !== 0,
  };
}

/** A signature, checked: a real typed name, the box ticked, and the exact text that was shown. */
export function checkSignature(body, current) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || !/\s/.test(name) || name.length > 120) return { error: 'Type your full name (first and last) to sign.' };
  if (body?.agreed !== true) return { error: 'Tick the box to agree and sign.' };
  if (!current) return { error: 'There’s no package on this project yet, so nothing to sign.' };
  if (body?.sha256 !== current.sha256) return { error: 'The agreement changed while you were reading it. Read the updated one and sign again.', stale: true };
  return { name, portfolioOk: typeof body.portfolio === 'boolean' ? (body.portfolio ? 1 : 0) : null };
}

/** The signed copy, by email to the client and to Daniel (Resend, the contact form's sender). */
export async function emailSignedCopy(env, { to, name, signedAt, text, sha, ip, business }) {
  if (!env.RESEND_API_KEY) return [];
  const recipients = [...new Set([to, env.CONTACT_TO || 'support@steadfastcode.tech'].filter((x) => x && x.includes('@')))];
  const body = `${text}\n\nSIGNED\nSigned electronically by ${name} on ${new Date(signedAt).toUTCString()} from ${ip || 'an unknown address'}.\nDocument fingerprint (SHA-256): ${sha}\n\nThis is your copy. Reply to this email with any questions.`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: recipients, reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: `Your signed website agreement — ${business || 'Steadfast Code'}`, text: body }),
  }).catch(() => null);
  return r?.ok ? recipients : [];
}
