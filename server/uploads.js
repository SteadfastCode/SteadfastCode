// One upload path for both sides: a photo or logo into the UPLOADS bucket, typed from its bytes.
import { sniffImage, MAX_FILE_BYTES, MAX_FILES } from './client.js';
import { logEvent } from './view.js';
import { getAsset, inputsOf, markSentByUpload } from './assets.js';

// An upload can be for an item on the needed-assets list (2026-11-20): the form names it (`asset`),
// and the item must allow that kind of upload. A photo for an item is an ordinary photo that also
// shows on its card. A file (kind `file`: a font, a vector, a PSD) is only ever for an item; it is
// kept as it came, served as a download, and never shown as an image or synced into the site.

/** A safe extension for a stored file's key, from its name; `bin` when it has none worth keeping. */
function fileExtension(name) {
  const ext = String(name ?? '').match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase();
  return ext || 'bin';
}

export async function saveUpload(env, project, form, { source, who, whoLabel }) {
  if (!env.UPLOADS) return { status: 503, error: 'Uploads aren’t switched on yet. Send photos to Daniel for now.' };
  const file = form?.get('file');
  if (!file || typeof file === 'string') return { status: 400, error: 'No file came through.' };
  if (file.size > MAX_FILE_BYTES) return { status: 413, error: `That file is over ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  const count = await env.INTAKE.prepare('SELECT COUNT(*) AS n FROM uploads WHERE project_id = ? AND deleted_at IS NULL').bind(project.id).first();
  if (count.n >= MAX_FILES) return { status: 409, error: `That's ${MAX_FILES} files already. Delete a few first.` };
  const bytes = new Uint8Array(await file.arrayBuffer());

  // The needed item this is for, when the form names one, and whether that item takes this upload.
  const wantsFile = form.get('kind') === 'file';
  const assetId = form.get('asset');
  let asset = null;
  if (assetId) {
    asset = await getAsset(env, project.id, assetId).catch(() => null);
    if (!asset) return { status: 404, error: 'That item isn’t on this project’s list anymore.' };
    if (asset.status === 'received') return { status: 409, error: 'Daniel already has this one.' };
    if (!inputsOf(asset).includes(wantsFile ? 'files' : 'photos')) return { status: 400, error: wantsFile ? 'This one doesn’t take files.' : 'This one doesn’t take photos.' };
  } else if (wantsFile) {
    return { status: 400, error: 'Files go on the item they’re for.' };
  }

  const type = wantsFile ? { ext: fileExtension(file.name), type: 'application/octet-stream' } : sniffImage(bytes);
  if (!type) return { status: 415, error: 'That doesn’t look like a photo or a logo (JPEG, PNG, WebP, GIF, HEIC or PDF).' };
  const kind = wantsFile ? 'file' : form.get('kind') === 'logo' ? 'logo' : 'photo';
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
  let newlySent = false;
  if (asset) {
    await env.INTAKE.prepare('UPDATE uploads SET asset_id = ? WHERE id = ?').bind(asset.id, id).run();
    if (source === 'client') newlySent = await markSentByUpload(env, asset);
  }
  await logEvent(env, project.id, who, `${whoLabel} uploaded a ${kind}${filename ? ` (${filename})` : ''}${asset ? ` for “${asset.title}”` : ''}`);
  return { status: 201, upload: { id, kind, filename, content_type: type.type, bytes: bytes.length, caption, source, uploaded_at: now, assetId: asset?.id ?? null }, asset, newlySent };
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
  const headers = { 'content-type': u.content_type, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" };
  // A file is only ever a download, under a name made of safe characters.
  if (u.kind === 'file') headers['content-disposition'] = `attachment; filename="${String(u.filename || 'file').replace(/[^A-Za-z0-9._ -]/g, '_')}"`;
  return new Response(obj.body, { headers });
}

export async function setCaption(env, projectId, uploadId, caption) {
  const r = await env.INTAKE.prepare('UPDATE uploads SET caption = ? WHERE id = ? AND project_id = ? AND deleted_at IS NULL').bind(String(caption ?? '').trim().slice(0, 300) || null, uploadId, projectId).run();
  return r.meta?.changes ? { status: 200, ok: true } : { status: 404, error: 'Not found.' };
}
