// The needed-assets list (server/assets.js): what Daniel may add and change, what the client may
// change, and how an item moves between needed, sent and received.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAsset, adminChange, clientChange, listAssets, saveAsset, cleanInputs, inputsOf, MAX_TITLE } from '../server/assets.js';

test('a new item needs a title; the detail is optional and both are tidied', () => {
  assert.deepEqual(cleanAsset({ title: '  Display   font ', detail: ' OTF or WOFF2\r\nfor headings ' }), { title: 'Display font', detail: 'OTF or WOFF2\nfor headings', inputs: null });
  assert.deepEqual(cleanAsset({ title: 'Filigree', inputs: ['link', 'files', 'nonsense'] }), { title: 'Filigree', detail: null, inputs: ['files', 'link'] });
  assert.match(cleanAsset({ title: '   ' }).error, /what’s needed/);
  assert.match(cleanAsset(null).error, /what’s needed/);
  assert.match(cleanAsset({ title: 'x'.repeat(MAX_TITLE + 1) }).error, /under/);
});

test('Daniel marks an item received or still needed, and the dates follow', () => {
  const now = '2026-11-19T20:00:00.000Z';
  assert.deepEqual(adminChange({ status: 'received' }, now).set, { status: 'received', received_at: now });
  assert.deepEqual(adminChange({ status: 'needed' }, now).set, { status: 'needed', sent_at: null, received_at: null });
  assert.deepEqual(adminChange({ title: ' Headers ', detail: '' }, now).set, { title: 'Headers', detail: null });
  assert.match(adminChange({ status: 'lost' }, now).error, /status/);
  assert.match(adminChange({}, now).error, /Nothing/);
  assert.match(adminChange({ title: '' }, now).error, /what’s needed/);
});

test('the client can mark an item sent with a note, or take it back, but not once Daniel has it', () => {
  const now = '2026-11-19T20:00:00.000Z';
  const needed = { status: 'needed' };
  assert.deepEqual(clientChange(needed, { sent: true, note: ' in Discord, #contractors ' }, now).set, { status: 'sent', sent_at: now, client_note: 'in Discord, #contractors' });
  assert.deepEqual(clientChange(needed, { sent: true }, now).set, { status: 'sent', sent_at: now, client_note: null });
  assert.deepEqual(clientChange({ status: 'sent' }, { sent: false }, now).set, { status: 'needed', sent_at: null, client_note: null });
  assert.match(clientChange({ status: 'received' }, { sent: false }, now).error, /already has/);
  // Only `sent` and `note` are read: a client can't retitle an item or mark it received.
  assert.match(clientChange(needed, { status: 'received', title: 'Mine' }, now).error, /Nothing/);
});

test('until the table exists the list is empty, and a save only names columns the rules produced', async () => {
  const missing = { INTAKE: { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('no such table: assets_needed'); } }) }) } };
  assert.deepEqual(await listAssets(missing, 'p1'), []);

  let sql = '';
  let bound = [];
  const env = { INTAKE: { prepare: (text) => { sql = text; return { bind: (...values) => { bound = values; return { run: async () => ({}) }; } }; } } };
  await saveAsset(env, '7', clientChange({ status: 'needed' }, { sent: true, note: 'here' }, 'T').set);
  assert.equal(sql, 'UPDATE assets_needed SET status = ?, sent_at = ?, client_note = ? WHERE id = ?');
  assert.deepEqual(bound, ['sent', 'T', 'here', 7]);
});

test('the client endpoint tells Daniel when something is sent, and only for an item on their own project', async () => {
  const { onRequestPatch } = await import('../functions/api/client/assets/[asset].js');
  const item = { id: 3, project_id: 'p1', title: 'Display font', status: 'needed' };
  const statements = [];
  const env = {
    INTAKE: {
      prepare: (text) => ({
        bind: (...values) => {
          statements.push([text, values]);
          return {
            first: async () => (/FROM assets_needed WHERE id = \? AND project_id = \?/.test(text) && values[0] === 3 && values[1] === 'p1' ? item : null),
            all: async () => ({ results: [] }),
            run: async () => ({}),
          };
        },
      }),
    },
  };
  const call = (asset, body, projectId = 'p1') => onRequestPatch({
    request: new Request('https://steadfastcode.tech/api/client/assets/' + asset, { method: 'PATCH', body: JSON.stringify(body) }),
    env, params: { asset }, data: { project: { id: projectId, answers: JSON.stringify({ businessName: 'Lowen Games', contactName: 'Andrew Lowen' }) } },
  });

  assert.equal((await call('3', { sent: true, note: 'https://drive.example/fonts' })).status, 200);
  const notification = statements.find(([text]) => /INSERT INTO notifications/.test(text));
  assert.ok(notification, 'Daniel is told');
  assert.match(notification[1][2], /Lowen Games: Display font sent/);
  assert.match(notification[1][3], /Andrew says: https:\/\/drive\.example\/fonts/);

  assert.equal((await call('3', { sent: true }, 'someone-else')).status, 404, 'an item on another project is not found');
  assert.equal((await call('99', { sent: true })).status, 404);
});

// Inputs (2026-11-20): Daniel says what a card takes, and the client can only answer through those.
test('an item takes only the inputs Daniel gave it, and answering through one marks it sent', () => {
  const now = '2026-11-20T15:00:00.000Z';
  assert.deepEqual(cleanInputs(['text', 'photos', 'photos', 'exe']), ['photos', 'text'], 'known inputs only, in card order');
  assert.equal(cleanInputs([]), null);
  assert.deepEqual(inputsOf({ inputs: '["link","text"]' }), ['link', 'text']);
  assert.deepEqual(inputsOf({ inputs: null }), [], 'an item from before inputs existed takes none');
  assert.deepEqual(inputsOf({ inputs: 'not json' }), []);
  assert.deepEqual(adminChange({ inputs: ['files'] }, now).set, { inputs: '["files"]' });
  assert.deepEqual(adminChange({ inputs: [] }, now).set, { inputs: null });

  const takesBoth = { status: 'needed', inputs: '["link","text"]' };
  assert.deepEqual(clientChange(takesBoth, { link: 'drive.example.com/fonts' }, now).set, { link: 'https://drive.example.com/fonts', status: 'sent', sent_at: now });
  assert.deepEqual(clientChange({ ...takesBoth, status: 'sent' }, { answer: ' Our story... ' }, now).set, { answer: 'Our story...' }, 'already sent: the status is left alone');
  assert.deepEqual(clientChange(takesBoth, { link: '' }, now).set, { link: null }, 'clearing a link does not mark it sent');
  assert.match(clientChange(takesBoth, { link: 'javascript:alert(1)' }, now).error, /doesn’t look like a link/);
  assert.match(clientChange({ status: 'needed', inputs: '["photos"]' }, { link: 'https://example.com' }, now).error, /doesn’t take a link/);
  assert.match(clientChange({ status: 'needed', inputs: null }, { answer: 'x' }, now).error, /doesn’t take a typed answer/);
  assert.match(clientChange({ status: 'received', inputs: '["text"]' }, { answer: 'x' }, now).error, /already has/);
});

test('an upload for an item must be a kind the item takes; a file is only ever for an item', async () => {
  const { saveUpload } = await import('../server/uploads.js');
  const items = { 3: { id: 3, project_id: 'p1', title: 'Display font', status: 'needed', inputs: '["files"]' }, 4: { id: 4, project_id: 'p1', title: 'Cabin photos', status: 'needed', inputs: '["photos"]' } };
  const written = [];
  const stored = [];
  const statement = (text) => ({
    bind: (...values) => ({
      text, values,
      first: async () => (/COUNT\(\*\)/.test(text) ? { n: 0 } : /FROM assets_needed/.test(text) && values[1] === 'p1' ? items[values[0]] ?? null : null),
      run: async () => { written.push([text, values]); return {}; },
    }),
  });
  const env = { UPLOADS: { put: async (key, bytes, options) => stored.push([key, options.httpMetadata.contentType]) }, INTAKE: { prepare: statement, batch: async (statements) => statements.forEach((one) => written.push([one.text, one.values])) } };
  const form = (fields, name = 'Cinzel.otf') => { const data = new FormData(); data.set('file', new File([new Uint8Array([1, 2, 3])], name)); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
  const by = { source: 'client', who: 'client', whoLabel: 'Andrew' };

  const font = await saveUpload(env, { id: 'p1' }, form({ kind: 'file', asset: '3' }), by);
  assert.equal(font.status, 201);
  assert.equal(font.upload.kind, 'file');
  assert.equal(font.upload.assetId, 3);
  assert.equal(font.newlySent, true, 'the first upload on a needed item is news for Daniel');
  assert.match(stored[0][0], /^projects\/p1\/[0-9a-f-]+\.otf$/);
  assert.equal(stored[0][1], 'application/octet-stream', 'a file is never served as something a browser would run or show');
  assert.ok(written.some(([text, values]) => /UPDATE uploads SET asset_id = \?/.test(text) && values[0] === 3));
  assert.ok(written.some(([text]) => /UPDATE assets_needed SET status = \?, sent_at = \?/.test(text)));

  assert.match((await saveUpload(env, { id: 'p1' }, form({ kind: 'file' }), by)).error, /go on the item/);
  assert.match((await saveUpload(env, { id: 'p1' }, form({ kind: 'file', asset: '4' }), by)).error, /doesn’t take files/);
  assert.match((await saveUpload(env, { id: 'p1' }, form({ kind: 'photo', asset: '3' }), by)).error, /doesn’t take photos/);
  assert.equal((await saveUpload(env, { id: 'p1' }, form({ kind: 'file', asset: '99' }), by)).status, 404);
  assert.equal((await saveUpload(env, { id: 'other' }, form({ kind: 'file', asset: '3' }), by)).status, 404, 'an item on another project is not found');
});
