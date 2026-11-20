// POST /api/client/requests: the client makes a change from the block above their message box
// (server/changes.js). { kind: 'details', field, value } is an instant fact: it's saved and the
// box writes it into the site. { kind, body, part? } is anything else, in their words. Either way
// it becomes a message with a request card under it, and a row in Daniel's queue.
import { json } from '../_middleware.js';
import { cleanChange, sitePartsOf, CHANGE_KINDS } from '../../../../server/changes.js';
import { listRequests } from '../../../../server/requests.js';
import { thread } from '../../../../server/messages.js';
import { logEvent } from '../../../../server/view.js';
import { notifyDaniel, projectUrl } from '../../../../server/notify.js';
import { clientName } from '../project.js';

const NOT_READY = 'Making a change from here isn’t switched on yet. Send Daniel a message instead.';

export async function onRequestPost({ request, env, data }) {
  const project = data.project;
  const answers = JSON.parse(project.answers);
  const change = cleanChange(await request.json().catch(() => null), { answers, parts: sitePartsOf(project) });
  if (change.error) return json({ error: change.error }, 400);
  const who = clientName(answers);
  const now = new Date().toISOString();

  try {
    const message = await env.INTAKE.prepare('INSERT INTO messages (project_id, at, sender, name, body) VALUES (?, ?, ?, ?, ?)')
      .bind(project.id, now, 'client', (answers.contactName || '').trim() || null, change.message).run();
    await env.INTAKE.prepare('INSERT INTO change_requests (project_id, message_id, kind, title, status, lane, field, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(project.id, message.meta?.last_row_id ?? null, change.kind, change.title, 'received', change.lane, change.field, 'client', now, now).run();
  } catch {
    return json({ error: NOT_READY }, 503);
  }
  // An instant fact is saved once its request exists, so the box always finds both.
  if (change.answers) {
    await env.INTAKE.prepare('UPDATE projects SET answers = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(change.answers), now, project.id).run();
  }
  await logEvent(env, project.id, 'client', `${who} asked for a change: ${change.title}`).catch(() => {});
  // Daniel hears about everything but the facts that take care of themselves; "broken" says so first.
  if (change.lane !== 'instant') {
    await notifyDaniel(env, {
      kind: 'request',
      title: `${change.kind === 'broken' ? 'BROKEN · ' : ''}${answers.businessName || 'A client'}: ${CHANGE_KINDS[change.kind].name}`,
      body: `${who}: ${change.message}`,
      url: projectUrl(project.id),
    });
  }
  return json({ requests: await listRequests(env, project.id), messages: await thread(env, project.id, 'client') }, 201);
}
