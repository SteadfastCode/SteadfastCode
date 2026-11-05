// The admin app's own updates (2026-11-04). app/build-on-box.sh --publish puts the APK and its
// manifest in R2 under app/ (the UPLOADS bucket; client uploads use other keys and are only ever
// served by their ids in D1). The admin page reads the manifest behind Cloudflare Access and gets
// a download link signed here; the app downloads natively, which can't carry the Access sign-in, so
// the link is the permission: one file, ten minutes, an HMAC under a key derived from LINK_KEY.

export const APK_PREFIX = 'app/';
export const APK_MANIFEST = 'app/apk.json';
const LINK_SECONDS = 600;
const FILE = /^steadfast-code-\d{1,10}\.apk$/;

async function hmacKey(env) {
  if (!env.LINK_KEY) return null;
  const raw = new TextEncoder().encode('apk-download:' + env.LINK_KEY);
  const material = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const validFile = (file) => FILE.test(String(file ?? ''));

/** `${exp}.${hmac}` for one file, valid LINK_SECONDS from `now`. */
export async function signDownload(env, file, now = Date.now()) {
  const key = await hmacKey(env);
  if (!key || !validFile(file)) return null;
  const exp = Math.floor(now / 1000) + LINK_SECONDS;
  return `${exp}.${hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${file}.${exp}`)))}`;
}

export async function verifyDownload(env, file, token, now = Date.now()) {
  const key = await hmacKey(env);
  const [exp, sig] = String(token ?? '').split('.');
  if (!key || !validFile(file) || !/^\d+$/.test(exp || '') || !/^[0-9a-f]{64}$/.test(sig || '')) return false;
  if (Number(exp) < Math.floor(now / 1000)) return false;
  const bytes = new Uint8Array(sig.match(/../g).map((h) => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${file}.${exp}`));
}
