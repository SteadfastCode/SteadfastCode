// POST /api/client/uploads (multipart: file, kind = logo|photo|file, caption?, asset?) — server/uploads.js.
// `asset` is the needed-assets item the upload is for; `file` (anything that isn't a photo) needs one.
import { json } from '../_middleware.js';
import { saveUpload } from '../../../../server/uploads.js';
import { clientName } from '../project.js';
import { markClientChange } from '../../../../server/view.js';
import { notifyDaniel, projectUrl } from '../../../../server/notify.js';

export async function onRequestPost({ request, env, data }) {
  const r = await saveUpload(env, data.project, await request.formData().catch(() => null), { source: 'client', who: 'client', whoLabel: clientName(JSON.parse(data.project.answers)) });
  if (r.error) return json({ error: r.error }, r.status);
  // A file for Daniel isn't a change to the site; a photo is.
  if (r.upload.kind !== 'file') await markClientChange(env, data.project, ['uploads']);
  // The first thing to land on a needed item tells Daniel it's been sent.
  if (r.newlySent) {
    const answers = JSON.parse(data.project.answers);
    await notifyDaniel(env, {
      kind: 'asset',
      title: `${answers.businessName || 'A client'}: ${r.asset.title} sent`,
      body: `${clientName(answers)} uploaded ${r.upload.kind === 'file' ? 'a file' : 'a photo'} for it${r.upload.filename ? ` (${r.upload.filename})` : ''}.`,
      url: projectUrl(data.project.id),
    });
  }
  return json(r.upload, r.status);
}
