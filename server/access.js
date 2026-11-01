// Who is asking. Cloudflare Access sits in front of /admin and /api/admin and signs every request
// it lets through; we check that signature ourselves rather than trusting that Access is configured.
// Copied from steadfast-analytics/src/access.js (2026-11-01); keep the two in step.

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const parse = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

let cache = { team: null, at: 0, keys: new Map() };

async function signingKey(team, kid, fetchImpl, now) {
  const stale = cache.team !== team || now - cache.at > 3600_000;
  // An unknown key id refetches at most once a minute, so a forged header can't make us hammer
  // the certs endpoint.
  if (stale || (!cache.keys.has(kid) && now - cache.at > 60_000)) {
    const res = await fetchImpl(`${team}/cdn-cgi/access/certs`);
    if (!res.ok) throw new Error(`certs ${res.status}`);
    const { keys = [] } = await res.json();
    const next = new Map();
    for (const k of keys) {
      if (k.kty !== 'RSA' || !k.kid) continue;
      next.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    cache = { team, at: now, keys: next };
  }
  return cache.keys.get(kid);
}

export function resetKeyCache() {
  cache = { team: null, at: 0, keys: new Map() };
}

export function accessConfigured(env) {
  return Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);
}

// Returns the signed-in email, lowercased, or null.
export async function accessEmail(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const host = new URL(request.url).hostname;
  if (env.DEV_EMAIL && (host === 'localhost' || host === '127.0.0.1')) return env.DEV_EMAIL.toLowerCase();
  if (!accessConfigured(env)) return null;
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = parse(parts[0]);
    const claims = parse(parts[1]);
    if (header.alg !== 'RS256') return null;
    const team = env.ACCESS_TEAM_DOMAIN.replace(/\/+$/, '');
    const key = await signingKey(team, header.kid, fetchImpl, now);
    if (!key) return null;
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (claims.iss !== team) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) return null;
    if (typeof claims.nbf === 'number' && claims.nbf * 1000 > now + 60_000) return null;
    return typeof claims.email === 'string' && claims.email ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isAdmin(env, email) {
  return String(env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email);
}
