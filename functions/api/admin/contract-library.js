// The contract library (2026-11-17, migration 0016): the sections a contract can have and the
// lines Daniel has written for them, kept so a line written once is a one-tap add on every later
// contract. The Contract pane on /admin reads it with the project (server/view.js) and writes here.
// GET: { sections, lines }.
// POST { heading }: a new section; POST { sectionId, text }: a new line in a section (an identical
// line already there is returned, not duplicated). Either answers with the row.
// PATCH { lineId, text } or { sectionId, heading }: rewords it for every project that uses it.
// DELETE { sectionId } or { lineId }: forgets it (a built-in section never; a section goes with its
// lines). A project that refers to a forgotten line simply loses that line.
import { json } from './_middleware.js';
import { cleanLibraryText } from '../../../server/contract-library.js';

const list = async (env) => {
  const [s, l] = await Promise.all([
    env.INTAKE.prepare('SELECT id, heading, builtin, position FROM contract_sections ORDER BY position, created_at').all(),
    env.INTAKE.prepare('SELECT id, section_id, text, created_at, standard, locked, position FROM contract_lines ORDER BY position, created_at').all(),
  ]);
  return { sections: s.results, lines: l.results };
};

export async function onRequestGet({ env }) {
  return json(await list(env));
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  if (typeof body.heading === 'string') {
    const heading = cleanLibraryText(body.heading, 80);
    if (!heading) return json({ error: 'Give the section a heading.' }, 400);
    const id = 'x-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const last = await env.INTAKE.prepare('SELECT MAX(position) AS p FROM contract_sections').first();
    await env.INTAKE.prepare('INSERT INTO contract_sections (id, heading, builtin, position, created_at) VALUES (?, ?, 0, ?, ?)').bind(id, heading, (last?.p ?? 0) + 1, now).run();
    return json({ section: { id, heading, builtin: 0 } }, 201);
  }
  const text = cleanLibraryText(body.text, 600);
  const sectionId = typeof body.sectionId === 'string' ? body.sectionId : '';
  if (!text) return json({ error: 'Write the line first.' }, 400);
  const section = await env.INTAKE.prepare('SELECT id FROM contract_sections WHERE id = ?').bind(sectionId).first();
  if (!section) return json({ error: 'No such section.' }, 404);
  const same = await env.INTAKE.prepare('SELECT id, section_id, text FROM contract_lines WHERE section_id = ? AND text = ?').bind(sectionId, text).first();
  if (same) return json({ line: same, existed: true });
  const id = 'l-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  await env.INTAKE.prepare('INSERT INTO contract_lines (id, section_id, text, created_at) VALUES (?, ?, ?, ?)').bind(id, sectionId, text, now).run();
  return json({ line: { id, section_id: sectionId, text } }, 201);
}

// PATCH { lineId, text } or { sectionId, heading }: rewords it in the library, for every project
// that uses it (a built-in section's heading lives in the code, so it isn't reworded here).
export async function onRequestPatch({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.lineId === 'string') {
    const text = cleanLibraryText(body.text, 600);
    if (!text) return json({ error: 'Write the line first.' }, 400);
    const line = await env.INTAKE.prepare('SELECT id, section_id FROM contract_lines WHERE id = ?').bind(body.lineId).first();
    if (!line) return json({ error: 'No such line.' }, 404);
    const same = await env.INTAKE.prepare('SELECT id FROM contract_lines WHERE section_id = ? AND text = ? AND id != ?').bind(line.section_id, text, line.id).first();
    if (same) return json({ error: 'The library already has that line in this section.' }, 409);
    await env.INTAKE.prepare('UPDATE contract_lines SET text = ? WHERE id = ?').bind(text, line.id).run();
    return json({ line: { id: line.id, section_id: line.section_id, text } });
  }
  if (typeof body.sectionId === 'string') {
    const heading = cleanLibraryText(body.heading, 80);
    if (!heading) return json({ error: 'Give the section a heading.' }, 400);
    const s = await env.INTAKE.prepare('SELECT id, builtin FROM contract_sections WHERE id = ?').bind(body.sectionId).first();
    if (!s) return json({ error: 'No such section.' }, 404);
    if (s.builtin) return json({ error: 'A standard section’s heading can be reworded on the project, not in the library.' }, 400);
    await env.INTAKE.prepare('UPDATE contract_sections SET heading = ? WHERE id = ?').bind(heading, s.id).run();
    return json({ section: { id: s.id, heading } });
  }
  return json({ error: 'Say which line or section.' }, 400);
}

export async function onRequestDelete({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.lineId === 'string') {
    // A standard line is reworded or switched off on a project, never forgotten.
    const l = await env.INTAKE.prepare('SELECT standard FROM contract_lines WHERE id = ?').bind(body.lineId).first();
    if (l?.standard) return json({ error: 'A standard line stays in the library; switch it off on the project instead.' }, 400);
    await env.INTAKE.prepare('DELETE FROM contract_lines WHERE id = ?').bind(body.lineId).run();
    return json({ ok: true });
  }
  if (typeof body.sectionId === 'string') {
    const s = await env.INTAKE.prepare('SELECT builtin FROM contract_sections WHERE id = ?').bind(body.sectionId).first();
    if (!s) return json({ error: 'No such section.' }, 404);
    if (s.builtin) return json({ error: 'The standard sections stay; switch one off on the project instead.' }, 400);
    await env.INTAKE.batch([
      env.INTAKE.prepare('DELETE FROM contract_lines WHERE section_id = ?').bind(body.sectionId),
      env.INTAKE.prepare('DELETE FROM contract_sections WHERE id = ?').bind(body.sectionId),
    ]);
    return json({ ok: true });
  }
  return json({ error: 'Say which line or section.' }, 400);
}
