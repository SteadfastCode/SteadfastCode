// The rules behind a client site's contact form (functions/api/forms/[project].js), kept pure so
// they're tested without D1 or Resend: what a message must have, where the visitor may be sent
// back to, and the email the client gets.

const MAX = { name: 120, email: 200, phone: 40, topic: 160, message: 5000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The visitor's message, trimmed; `problem` says what's missing (the page words it). */
export function cleanForm(form) {
  const data = {};
  for (const [k, max] of Object.entries(MAX)) data[k] = String(form.get(k) ?? '').trim().slice(0, max);
  if (!data.name || !data.message) return { data, problem: 'missing' };
  if (!data.email && !data.phone) return { data, problem: 'contact' };
  if (data.email && !EMAIL.test(data.email)) return { data, problem: 'email' };
  return { data, problem: null };
}

const host = (s) => String(s ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^www\./, '');

/**
 * Where the visitor goes after sending: the page they sent it from, when that page is one of this
 * client's own addresses (the pages.dev preview and its branch previews, or the domain with or
 * without www); otherwise the preview's home page. Local addresses only in local development.
 */
export function returnTo(given, project, answers, { dev = false } = {}) {
  const preview = project.preview_url ? new URL(project.preview_url) : null;
  const fallback = preview ? preview.origin + '/' : 'https://steadfastcode.tech/';
  let u;
  try { u = new URL(String(given ?? '')); } catch { return fallback; }
  const h = u.hostname.toLowerCase();
  const domain = host(answers.domain);
  const ok = (u.protocol === 'https:' && ((preview && (h === preview.hostname || h.endsWith('.' + preview.hostname))) || (domain && (h === domain || h === 'www.' + domain))))
    || (dev && (h === 'localhost' || h === '127.0.0.1'));
  if (!ok) return fallback;
  u.search = '';
  u.hash = '';
  return u.toString();
}

const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/["<>]/g, '').trim();

/** The email to the client, or null when the project has no address to send it to. */
export function formEmail(data, answers, { from, page }) {
  const to = String(answers.email ?? '').trim();
  if (!EMAIL.test(to)) return null;
  // The verified sending address is Steadfast Code's; the name on it is the client's business.
  const address = (String(from ?? '').match(/<([^>]+)>/)?.[1] ?? from ?? '').trim() || 'site@steadfastcode.tech';
  const business = oneLine(answers.businessName) || 'Your';
  return {
    from: `${business} website <${address}>`,
    to: [to],
    ...(data.email ? { reply_to: data.email } : {}),
    subject: oneLine(`Website message from ${data.name}${data.topic ? ` · ${data.topic}` : ''}`).slice(0, 200),
    text: [
      `A message from your website${answers.businessName ? ` (${oneLine(answers.businessName)})` : ''}.`,
      '',
      `Name: ${data.name}`,
      `Email: ${data.email || '-'}`,
      `Phone: ${data.phone || '-'}`,
      ...(data.topic ? [`About: ${data.topic}`] : []),
      `Sent from: ${page}`,
      '',
      data.message,
      '',
      data.email ? 'Reply to this email to answer them directly.' : 'They left a phone number, not an email: call or text them back.',
    ].join('\n'),
  };
}
