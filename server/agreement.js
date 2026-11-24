// The agreement side of a project (2026-11-02): what the client is asked to sign now, whether
// they already have, and recording a signature. The wording lives in src/data/agreement.ts.

import { agreementFor, termsKey, contractCatalog, emptyLibrary } from '../src/data/agreement.ts';

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The contract library (2026-11-17): every section and every line Daniel has written, for the
 * catalog and for resolving a project's added lines. Empty until migration 0016 has run.
 */
export async function loadLibrary(env) {
  try {
    const [s, l] = await Promise.all([
      env.INTAKE.prepare('SELECT id, heading, builtin, position FROM contract_sections ORDER BY position, created_at').all(),
      env.INTAKE.prepare('SELECT id, section_id, text, standard, locked, position FROM contract_lines ORDER BY position, created_at').all(),
    ]);
    return { sections: s.results, lines: l.results };
  } catch (e) {
    // Before migration 0016 (no tables) or 0017 (no standard column): the built-in seed stands in.
    if (/no such (table|column)/i.test(e.message)) return { ...emptyLibrary, missing: true };
    throw e;
  }
}

/**
 * Where the project stands: `current` is the agreement as it would read today (null until a package
 * is picked), `signed` the latest signature, and `needed` whether the client must sign before going on
 * (no signature, or one for a different package, add-on, price or set of lines). With `catalog`
 * (Daniel's side), every section and line, switched off ones included, plus the library, for the
 * Contract pane.
 */
export async function agreementState(env, project, { catalog = false } = {}) {
  const answers = typeof project.answers === 'string' ? JSON.parse(project.answers) : project.answers;
  const library = answers.tier ? await loadLibrary(env) : emptyLibrary;
  const current = answers.tier ? agreementFor(answers, library) : null;
  const signed = await latestSignature(env, project.id, 'id, version, terms_key, sha256, signer_name, signed_at, portfolio_ok, emailed_to');
  // A change after signing asks for a new signature only while the project is still active (Daniel,
  // 2026-11-17): once it's live or closed, the signed contract is the contract, whatever changes later.
  const active = !['live', 'closed'].includes(project.status);
  const valid = !!(signed && current && (signed.terms_key === termsKey(answers) || !active));
  return {
    current: current ? { ...current, sha256: await sha256(current.text) } : null,
    signed: signed ? { id: signed.id, name: signed.signer_name, signedAt: signed.signed_at, version: signed.version, portfolioOk: signed.portfolio_ok, emailedTo: signed.emailed_to, valid, countersign: signed.countersigned_at ? { name: signed.countersigner_name, signedAt: signed.countersigned_at } : null } : null,
    needed: !valid,
    reason: !current ? 'no-package' : !signed ? 'unsigned' : valid ? null : 'changed',
    // Daniel can let a client read it early and sign at the meeting (0 = review only).
    signingOpen: project.signing_open !== 0,
    ...(catalog && current ? { catalog: contractCatalog(answers, library), library: { sections: library.sections, lines: library.lines, missing: !!library.missing } } : {}),
  };
}

const COUNTER = 'countersigner_name, countersigned_at';

/**
 * The project's latest signature row, `cols` plus Daniel's countersignature (and with `drawing`,
 * the signature he drew). Before migration 0024 there are no countersign columns: no countersignature.
 */
export async function latestSignature(env, projectId, cols, { drawing = false } = {}) {
  const q = (c) => env.INTAKE.prepare(`SELECT ${c} FROM agreements WHERE project_id = ? ORDER BY signed_at DESC LIMIT 1`).bind(projectId).first();
  try {
    return await q(`${cols}, ${COUNTER}${drawing ? ', countersign_drawing' : ''}`);
  } catch (e) {
    if (/no such column/i.test(e.message)) return q(cols);
    throw e;
  }
}

// A drawn signature as the browser hands it over (Plumb's src/signature-drawing.ts): a PNG data URL,
// cropped to the ink. Checked because it's arbitrary input kept on the record and shown back.
export const MAX_DRAWING_BYTES = 150_000;
const PNG_PREFIX = 'data:image/png;base64,';
export function checkDrawing(value) {
  if (typeof value !== 'string' || !value.startsWith(PNG_PREFIX)) return { error: 'Draw your signature to sign.' };
  let bytes;
  try { bytes = atob(value.slice(PNG_PREFIX.length)); } catch { return { error: 'The drawn signature didn’t come through as an image.' }; }
  if (bytes.length > MAX_DRAWING_BYTES) return { error: `The drawn signature is too big (over ${MAX_DRAWING_BYTES / 1000} KB).` };
  if (bytes.length < 33 || bytes.slice(0, 8) !== '\x89PNG\r\n\x1a\n') return { error: 'The drawn signature didn’t come through as an image.' };
  return { drawing: value };
}

/** The signature lines under a signed copy: the client's, and Daniel's once he's countersigned. */
export function signedLines({ name, signedAt, ip, sha, counter }) {
  return [
    `Signed electronically by ${name} on ${new Date(signedAt).toUTCString()}${ip !== undefined ? ` from ${ip || 'an unknown address'}` : ''}.`,
    ...(counter ? [`Countersigned for Steadfast Code by ${counter.name} on ${new Date(counter.signedAt).toUTCString()}.`] : []),
    `Document fingerprint (SHA-256): ${sha}`,
  ].join('\n');
}

/** A signature, checked: a real typed name, the box ticked, and the exact text that was shown. */
export function checkSignature(body, current) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || !/\s/.test(name) || name.length > 120) return { error: 'Type your full name (first and last) to sign.' };
  if (body?.agreed !== true) return { error: 'Tick the box to agree and sign.' };
  if (!current) return { error: 'There’s no package on this project yet, so nothing to sign.' };
  if (body?.sha256 !== current.sha256) return { error: 'The contract changed while you were reading it. Read the updated one and sign again.', stale: true };
  return { name, portfolioOk: typeof body.portfolio === 'boolean' ? (body.portfolio ? 1 : 0) : null };
}

/** The signed copy, by email to the client and to Daniel (Resend, the contact form's sender). */
// With `counter` (Daniel's countersignature) it's the fully signed copy, his drawn signature attached.
export async function emailSignedCopy(env, { to, name, signedAt, text, sha, ip, business, what = 'website contract', counter = null }) {
  if (!env.RESEND_API_KEY) return [];
  const recipients = [...new Set([to, env.CONTACT_TO || 'support@steadfastcode.tech'].filter((x) => x && x.includes('@')))];
  const body = `${text}\n\n${counter ? 'SIGNED BY BOTH PARTIES' : 'SIGNED'}\n${signedLines({ name, signedAt, ip, sha, counter })}\n\nThis is your copy. Reply to this email with any questions.`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: recipients, reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: `Your ${counter ? 'fully signed' : 'signed'} ${what} — ${business || 'Steadfast Code'}`, text: body,
      ...(counter?.drawing ? { attachments: [{ filename: 'steadfast-code-signature.png', content: counter.drawing.slice(PNG_PREFIX.length) }] } : {}) }),
  }).catch(() => null);
  return r?.ok ? recipients : [];
}
