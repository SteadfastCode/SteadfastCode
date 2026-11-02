// The client side of a project (2026-11-01): the private link, what a client may change, and what
// they may upload. Kept pure where it can be, so it's tested without D1 or R2.
//
// The link is https://steadfastcode.tech/client#<token>. The token sits in the fragment, so it is
// never sent in a page request or written to a log; the page sends it to /api/client as a bearer
// header. Only its SHA-256 is stored. A link expires (LINK_DAYS) and Daniel can revoke it.

import { mergeAnswers, fields } from './intake.js';

export const LINK_DAYS = 60;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES = 150;

/** Fields the client may change: everything not marked `owner: 'daniel'` in src/data/intake.ts. */
export const clientEditable = new Set(Object.values(fields).filter((f) => f.owner !== 'daniel').map((f) => f.id));

export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A client's edit, limited to clientEditable; the package and scope fields are dropped and reported. */
export function mergeClientAnswers(saved, patch) {
  const mine = {};
  const refused = [];
  for (const [k, v] of Object.entries(patch ?? {})) (clientEditable.has(k) ? (mine[k] = v) : refused.push(k));
  const { answers, dropped } = mergeAnswers(saved, mine);
  return { answers, dropped: [...refused, ...dropped] };
}

/**
 * What a file really is, from its first bytes, never from the name or the browser's word for it.
 * Photos and logos only. SVG is refused: it can carry script, and a logo is just as good as a PNG.
 */
export function sniffImage(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const at = (i, ...xs) => xs.every((x, k) => b[i + k] === x);
  const ascii = (i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (at(0, 0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg' };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { type: 'image/png', ext: 'png' };
  if (ascii(0, 'GIF8')) return { type: 'image/gif', ext: 'gif' };
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { type: 'image/webp', ext: 'webp' };
  if (ascii(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return { type: 'image/heic', ext: 'heic', noPreview: true };
    if (/^avi[fs]$/.test(brand)) return { type: 'image/avif', ext: 'avif' };
  }
  if (ascii(0, '%PDF-')) return { type: 'application/pdf', ext: 'pdf', noPreview: true };
  return null;
}

/** The plain-language build status a client sees. */
export function clientStatus(p) {
  const building = p.status === 'build-requested' || p.status === 'building';
  return {
    building,
    step: p.status === 'preview' ? 6 : p.status === 'build-requested' ? 0 : building ? (p.build_step || 1) : null,
    note: building ? p.build_note : null,
    activity: building ? p.build_activity : null,
    startedAt: building ? p.build_started_at : null,
    previewUrl: p.preview_url ?? null,
    failed: p.status === 'intake' && /^(Build failed|The box restarted)/.test(p.build_note || ''),
  };
}

// A link kept so Daniel can copy it again (2026-11-02): AES-GCM under env.LINK_KEY (32 random
// bytes, base64). Without the key there's no copy to keep, and the page says to make a new link.
async function linkKey(env) {
  if (!env.LINK_KEY) return null;
  const raw = Uint8Array.from(atob(env.LINK_KEY), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sealToken(env, token) {
  const key = await linkKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function openToken(env, sealed) {
  const key = await linkKey(env);
  if (!key || !sealed) return null;
  try {
    const [iv, ct] = sealed.split('.').map(unb64);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
  } catch { return null; }
}
