// One description of a project for both sides of the shared form (2026-11-01): Daniel's /admin and
// the client's /client see the same answers, scope notes, price, files, activity, build progress
// and who is editing what. Only Daniel's view adds the client-link status. Nothing else differs.

import { check } from './intake.js';
import { clientStatus, clientEditable } from './client.js';
import { agreementState } from './agreement.js';

export const PRESENCE_SECONDS = 12;

export async function projectView(env, p, { mode }) {
  const answers = JSON.parse(p.answers);
  const db = env.INTAKE;
  const since = new Date(Date.now() - PRESENCE_SECONDS * 1000).toISOString();
  const [uploads, events, presence, lastBuild, link, agreement] = await Promise.all([
    db.prepare('SELECT id, kind, filename, content_type, bytes, caption, source, uploaded_at FROM uploads WHERE project_id = ? AND deleted_at IS NULL ORDER BY uploaded_at').bind(p.id).all(),
    db.prepare('SELECT at, who, what FROM project_events WHERE project_id = ? ORDER BY id DESC LIMIT 20').bind(p.id).all(),
    db.prepare('SELECT who, name, field FROM presence WHERE project_id = ? AND at > ? AND who != ?').bind(p.id, since, mode === 'admin' ? 'daniel' : 'client').all(),
    db.prepare('SELECT finished_at FROM builds WHERE project_id = ? AND ok = 1 ORDER BY finished_at DESC LIMIT 1').bind(p.id).first(),
    mode === 'admin' ? db.prepare('SELECT created_at, expires_at, last_used_at FROM client_links WHERE project_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1').bind(p.id, new Date().toISOString()).first() : null,
    agreementState(env, p),
  ]);
  return {
    mode,
    id: p.id,
    slug: p.slug,
    status: p.status,
    previewUrl: p.preview_url,
    buildNote: p.build_note,
    buildStep: p.build_step ?? null,
    buildActivity: p.build_activity ?? null,
    buildStartedAt: p.build_started_at ?? null,
    updatedAt: p.updated_at,
    answers,
    check: check(answers),
    editable: mode === 'admin' ? null : [...clientEditable],
    uploads: uploads.results,
    uploadsReady: !!env.UPLOADS,
    events: events.results,
    others: presence.results.map((r) => ({ who: r.who, name: r.name, field: r.field })),
    changedSinceBuild: !!(p.preview_url && lastBuild && p.updated_at > lastBuild.finished_at),
    clientLink: link ? { createdAt: link.created_at, expiresAt: link.expires_at, lastUsedAt: link.last_used_at } : null,
    failed: clientStatus(p).failed,
    agreement,
  };
}

/** Record where this side is: a field id, or null when it isn't in one. */
export function setPresence(env, projectId, who, name, field) {
  return env.INTAKE.prepare('INSERT INTO presence (project_id, who, name, field, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (project_id, who) DO UPDATE SET name = excluded.name, field = excluded.field, at = excluded.at')
    .bind(projectId, who, name, field && /^[A-Za-z]{1,40}$/.test(field) ? field : null, new Date().toISOString()).run();
}

export const logEvent = (env, projectId, who, what) =>
  env.INTAKE.prepare('INSERT INTO project_events (project_id, at, who, what) VALUES (?, ?, ?, ?)').bind(projectId, new Date().toISOString(), who, what).run();

/**
 * "Joshua updated Hours, What you offer": autosave fires every pause in typing, so edits by the
 * same person within two minutes fold into their last line instead of adding one per keystroke burst.
 */
export async function logEdit(env, projectId, who, whoLabel, labels) {
  if (!labels.length) return;
  const last = await env.INTAKE.prepare('SELECT id, at, who, what FROM project_events WHERE project_id = ? ORDER BY id DESC LIMIT 1').bind(projectId).first();
  const prefix = `${whoLabel} updated `;
  if (last && last.who === who && last.what.startsWith(prefix) && Date.now() - Date.parse(last.at) < 120_000) {
    const merged = [...new Set([...last.what.slice(prefix.length).split(', '), ...labels])];
    return env.INTAKE.prepare('UPDATE project_events SET what = ?, at = ? WHERE id = ?').bind(prefix + merged.join(', '), new Date().toISOString(), last.id).run();
  }
  return logEvent(env, projectId, who, prefix + labels.join(', '));
}
