// One upload path for both sides: a photo or logo into the UPLOADS bucket, typed from its bytes.
import { sniffImage, MAX_FILE_BYTES, MAX_FILES } from './client.js';
import { logEvent } from './view.js';

export async function saveUpload(env, project, form, { source, who, whoLabel }) {
  if (!env.UPLOADS) return { status: 503, error: 'Uploads aren’t switched on yet. Send photos to Daniel for now.' };
  const file = form?.get('file');
  if (!file || typeof file === 'string') return { status: 400, error: 'No file came through.' };
  if (file.size > MAX_FILE_BYTES) return { status: 413, error: `That file is over ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  const count = await env.INTAKE.prepare('SELECT COUNT(*) AS n FROM uploads WHERE project_id = ? AND deleted_at IS NULL').bind(project.id).first();
  if (count.n >= MAX_FILES) return { status: 409, error: `That's ${MAX_FILES} files already. Delete a few first.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { status: 415, error: 'That doesn’t look like a photo or a logo (JPEG, PNG, WebP, GIF, HEIC or PDF).' };
  const kind = form.get('kind') === 'logo' ? 'logo' : 'photo';
  const id = crypto.randomUUID();
  const key = `projects/${project.id}/${id}.${type.ext}`;
  await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: type.type } });
  const caption = String(form.get('caption') ?? '').trim().slice(0, 300) || null;
  const filename = String(file.name ?? '').slice(0, 200) || null;
  const now = new Date().toISOString();
  await env.INTAKE.batch([
    env.INTAKE.prepare('INSERT INTO uploads (id, project_id, kind, r2_key, filename, content_type, bytes, caption, source, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, project.id, kind, key, filename, type.type, bytes.length, caption, source, now),
    env.INTAKE.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(now, project.id),
  ]);
  await logEvent(env, project.id, who, `${whoLabel} uploaded a ${kind}${filename ? ` (${filename})` : ''}`);
  return { status: 201, upload: { id, kind, filename, content_type: type.type, bytes: bytes.length, caption, source, uploaded_at: now } };
}

export async function deleteUpload(env, project, uploadId, { who, whoLabel }) {
  const u = await env.INTAKE.prepare('SELECT * FROM uploads WHERE id = ? AND project_id = ? AND deleted_at IS NULL').bind(uploadId, project.id).first();
  if (!u) return { status: 404, error: 'Not found.' };
  const now = new Date().toISOString();
  await env.INTAKE.batch([
    env.INTAKE.prepare('UPDATE uploads SET deleted_at = ? WHERE id = ?').bind(now, u.id),
    env.INTAKE.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').bind(now, project.id),
  ]);
  if (env.UPLOADS) await env.UPLOADS.delete(u.r2_key);
  await logEvent(env, project.id, who, `${whoLabel} removed a ${u.kind}${u.filename ? ` (${u.filename})` : ''}`);
  return { status: 200, ok: true };
}

export async function serveUpload(env, projectId, uploadId) {
  const u = await env.INTAKE.prepare('SELECT * FROM uploads WHERE id = ? AND project_id = ? AND deleted_at IS NULL').bind(uploadId, projectId).first();
  const obj = u && env.UPLOADS ? await env.UPLOADS.get(u.r2_key) : null;
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': u.content_type, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" } });
}

export async function setCaption(env, projectId, uploadId, caption) {
  const r = await env.INTAKE.prepare('UPDATE uploads SET caption = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL').bind(String(caption ?? '').trim().slice(0, 300) || null, uploadId, projectId).run();
  return r.meta?.changes ? { status: 200, ok: true } : { status: 404, error: 'Not found.' };
}
