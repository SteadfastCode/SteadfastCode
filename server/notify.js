// Telling Daniel (2026-11-04): a row in the notifications queue (migrations/0014_push.sql). The box's
// build service sends it, by push to his phone when the admin app is registered, by Signal when not.
// Best effort: a failed insert never stops the thing being notified about.

export async function notifyDaniel(env, { kind, title, body, url }) {
  if (!env.INTAKE) return false;
  try {
    await env.INTAKE.prepare('INSERT INTO notifications (at, kind, title, body, url) VALUES (?, ?, ?, ?, ?)')
      .bind(new Date().toISOString(), String(kind).slice(0, 30), String(title).slice(0, 120), String(body ?? '').slice(0, 600), url ? String(url).slice(0, 300) : null).run();
    return true;
  } catch { return false; }
}

export const projectUrl = (id) => `https://steadfastcode.tech/admin#p/${id}`;
