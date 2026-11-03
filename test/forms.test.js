// A client site's contact form: the message reaches the client's own address and nowhere else, the
// visitor only ever goes back to that client's own site, and nothing short of a sent email says sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanForm, returnTo, formEmail } from '../server/forms.js';
import { onRequestPost } from '../functions/api/forms/[project].js';

const project = { id: 'p1', slug: 'n-and-j', status: 'preview', preview_url: 'https://stdfst-n-and-j.pages.dev', answers: JSON.stringify({ businessName: 'N & J Fusions Properties', email: 'joshua@example.com', domain: 'njfusionsproperties.com' }) };
const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const env = (over = {}) => ({
  RESEND_API_KEY: 'k', CONTACT_FROM: 'Steadfast Code <site@steadfastcode.tech>',
  INTAKE: { prepare: () => ({ bind: (id) => ({ first: async () => (id === 'p1' ? project : null) }) }) },
  ...over,
});
const post = (body, e = env(), id = 'p1') => onRequestPost({ request: new Request(`https://steadfastcode.tech/api/forms/${id}`, { method: 'POST', body: fd(body) }), env: e, params: { project: id } });
const sentTo = (r) => new URL(r.headers.get('location'));

test('a message needs a name, a message, and an email or a phone to answer it by', () => {
  assert.equal(cleanForm(fd({ name: 'A', message: 'Hi', email: 'a@b.co' })).problem, null);
  assert.equal(cleanForm(fd({ name: 'A', message: 'Hi', phone: '717 555 1234' })).problem, null);
  assert.equal(cleanForm(fd({ name: 'A', email: 'a@b.co' })).problem, 'missing');
  assert.equal(cleanForm(fd({ name: 'A', message: 'Hi' })).problem, 'contact');
  assert.equal(cleanForm(fd({ name: 'A', message: 'Hi', email: 'nope' })).problem, 'email');
  assert.equal(cleanForm(fd({ name: 'x'.repeat(500), message: 'Hi', email: 'a@b.co' })).data.name.length, 120);
});

test("the visitor goes back only to the client's own addresses", () => {
  const a = JSON.parse(project.answers);
  assert.equal(returnTo('https://stdfst-n-and-j.pages.dev/?x=1#y', project, a), 'https://stdfst-n-and-j.pages.dev/');
  assert.equal(returnTo('https://abc123.stdfst-n-and-j.pages.dev/', project, a), 'https://abc123.stdfst-n-and-j.pages.dev/');
  assert.equal(returnTo('https://www.njfusionsproperties.com/', project, a), 'https://www.njfusionsproperties.com/');
  for (const bad of ['https://evil.example/', 'http://stdfst-n-and-j.pages.dev/', 'https://stdfst-n-and-j.pages.dev.evil.example/', 'javascript:alert(1)', '', 'http://localhost:4321/']) {
    assert.equal(returnTo(bad, project, a), 'https://stdfst-n-and-j.pages.dev/', bad);
  }
  assert.equal(returnTo('http://localhost:4321/', project, a, { dev: true }), 'http://localhost:4321/');
});

test("the email goes to the project's address with the visitor as the reply-to, whatever the form says", () => {
  const a = JSON.parse(project.answers);
  const m = formEmail({ name: 'Pat\r\nBcc: x@y.z', email: 'pat@example.com', phone: '', topic: 'Short term rentals', message: 'Is the cabin free?' }, { ...a, to: 'other@example.com' }, { from: 'Steadfast Code <site@steadfastcode.tech>', page: 'https://stdfst-n-and-j.pages.dev/' });
  assert.deepEqual(m.to, ['joshua@example.com']);
  assert.equal(m.reply_to, 'pat@example.com');
  assert.equal(m.from, 'N & J Fusions Properties website <site@steadfastcode.tech>');
  assert.doesNotMatch(m.subject, /[\r\n]/);
  assert.match(m.text, /About: Short term rentals/);
  assert.equal(formEmail({ name: 'A', message: 'B' }, { email: '' }, { from: '', page: '' }), null);
});

test('posting: sent only when Resend accepts it; a bot, an unknown project or a failure are told apart', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => { calls.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); };
    let r = await post({ name: 'Pat', email: 'pat@example.com', message: 'Hi', return: 'https://stdfst-n-and-j.pages.dev/' });
    assert.equal(r.status, 303);
    assert.equal(sentTo(r).searchParams.get('sent'), '1');
    assert.equal(sentTo(r).hash, '#contact');
    assert.deepEqual(calls[0].to, ['joshua@example.com']);

    r = await post({ name: 'Bot', email: 'b@b.co', message: 'spam', company: 'Acme' });
    assert.equal(sentTo(r).searchParams.get('sent'), '1');
    assert.equal(calls.length, 1, 'the honeypot sends nothing');

    r = await post({ name: 'Pat', message: 'Hi' });
    assert.equal(sentTo(r).searchParams.get('why'), 'contact');

    assert.equal((await post({ name: 'Pat', email: 'p@e.co', message: 'Hi' }, env(), 'nope')).status, 404);

    globalThis.fetch = async () => new Response('{}', { status: 500 });
    r = await post({ name: 'Pat', email: 'pat@example.com', message: 'Hi' });
    assert.equal(sentTo(r).searchParams.get('sent'), '0');
    r = await post({ name: 'Pat', email: 'pat@example.com', message: 'Hi' }, env({ RESEND_API_KEY: undefined }));
    assert.equal(sentTo(r).searchParams.get('why'), 'offline');
  } finally {
    globalThis.fetch = realFetch;
  }
});
