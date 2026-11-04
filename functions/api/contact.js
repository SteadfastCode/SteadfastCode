// Cloudflare Pages Function: POST /api/contact.
//
// The form's only job is to get the message to Daniel. Two paths, tried in order:
//   1. CONTACT_FORWARD_URL — a lead intake (Front Desk's web-form source, when it is hosted), with
//      CONTACT_FORWARD_SECRET sent as a bearer token so the endpoint can refuse anyone else.
//   2. RESEND_API_KEY — email the submission to CONTACT_TO (defaults to support@steadfastcode.tech)
//      through Resend, from CONTACT_FROM on the verified domain.
// Neither configured: redirect back with ?sent=0 so the page tells the visitor to email instead.
//
// Before either, the submission is saved to the INTAKE D1 database (migrations/0001_leads.sql) when
// that binding exists, so the admin intake can start a project from it (2026-11-01). Saving is
// best-effort: a failed insert never stops the message from going out, and a saved row alone does
// not count as delivered — Daniel reads email, not the table.
// A form that silently swallows a lead is the one failure this file must never have.
//
// Bindings are set in the Cloudflare Pages project (Settings → Variables and Secrets), never here.
// On GitHub Pages this file does not run at all; the page's inline script notices the 404/405 and
// opens the visitor's mail app with the message filled in instead.

import { notifyDaniel } from '../../server/notify.js';

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

  if (env.INTAKE) {
    try {
      await env.INTAKE.prepare(
        'INSERT INTO leads (id, received_at, name, email, phone, business, plan, site, message, source_detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).bind(crypto.randomUUID(), submission.receivedAt, data.name, data.email, data.phone || null, data.business || null, data.plan || null, data.site || null, data.message, submission.sourceDetail).run();
    } catch {
      // the email below is the delivery; the table is a convenience
    }
    // To Daniel's phone (2026-11-04); the email below is still the delivery.
    await notifyDaniel(env, { kind: 'lead', title: `New lead: ${data.name}`, body: `${data.business ? data.business + ' · ' : ''}${data.plan ? data.plan + ' · ' : ''}${data.message}`, url: 'https://steadfastcode.tech/admin/leads' });
  }

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
