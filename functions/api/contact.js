// Cloudflare Pages Function: POST /api/contact.
//
// The form's only job is to get the message to Daniel. Two paths, tried in order:
//   1. CONTACT_FORWARD_URL — a lead intake (Front Desk's web-form source, when it is hosted), with
//      CONTACT_FORWARD_SECRET sent as a bearer token so the endpoint can refuse anyone else.
//   2. RESEND_API_KEY — email the submission to CONTACT_TO (defaults to support@steadfastcode.tech)
//      through Resend, from CONTACT_FROM on the verified domain.
// Neither configured: redirect back with ?sent=0 so the page tells the visitor to email instead.
// A form that silently swallows a lead is the one failure this file must never have.
//
// Bindings are set in the Cloudflare Pages project (Settings → Variables and Secrets), never here.
// On GitHub Pages this file does not run at all; the page's inline script notices the 404/405 and
// opens the visitor's mail app with the message filled in instead.

const FIELDS = ['name', 'email', 'phone', 'business', 'plan', 'site', 'message'];
const MAX = { name: 120, email: 200, phone: 40, business: 160, plan: 40, site: 300, message: 5000 };

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  // Honeypot: a filled "company" field is a bot. Pretend it worked; give it nothing to learn from.
  if (form.get('company')) return redirect(request, 1);

  const data = {};
  for (const f of FIELDS) data[f] = String(form.get(f) ?? '').trim().slice(0, MAX[f]);
  if (!data.name || !data.email || !data.message) return redirect(request, 0);

  const submission = {
    source: 'web',
    sourceDetail: 'steadfastcode.tech/contact',
    receivedAt: new Date().toISOString(),
    ...data,
  };

  try {
    if (env.CONTACT_FORWARD_URL) {
      const r = await fetch(env.CONTACT_FORWARD_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(env.CONTACT_FORWARD_SECRET ? { authorization: `Bearer ${env.CONTACT_FORWARD_SECRET}` } : {}) },
        body: JSON.stringify(submission),
      });
      if (r.ok) return redirect(request, 1);
    }
    if (env.RESEND_API_KEY) {
      const to = env.CONTACT_TO || 'support@steadfastcode.tech';
      const from = env.CONTACT_FROM || 'Steadfast Code website <site@steadfastcode.tech>';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from, to: [to], reply_to: data.email,
          subject: `Website: ${data.plan || 'inquiry'} — ${data.name}${data.business ? ` (${data.business})` : ''}`,
          text: [
            `Name: ${data.name}`, `Email: ${data.email}`, `Phone: ${data.phone || '-'}`, `Business: ${data.business || '-'}`,
            `After: ${data.plan || '-'}`, `Current site: ${data.site || '-'}`, '', data.message,
          ].join('\n'),
        }),
      });
      if (r.ok) return redirect(request, 1);
    }
  } catch {
    // fall through to the honest failure below
  }
  return redirect(request, 0);
}

function redirect(request, sent) {
  const url = new URL('/contact', request.url);
  url.searchParams.set('sent', String(sent));
  return Response.redirect(url.toString(), 303);
}
