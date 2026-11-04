// POST /api/admin/devices/test: queue a test notification; the box sends it within a few seconds.
import { json } from '../_middleware.js';
import { notifyDaniel } from '../../../../server/notify.js';

export async function onRequestPost({ env }) {
  const ok = await notifyDaniel(env, { kind: 'test', title: 'Steadfast Code', body: 'Test notification: push to this phone works.', url: 'https://steadfastcode.tech/admin/inbox' });
  return ok ? json({ ok: true }) : json({ error: 'Couldn’t queue it (has migration 0014 run?).' }, 503);
}
