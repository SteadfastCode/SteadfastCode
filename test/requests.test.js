// Change requests (server/requests.js): what opens one, who may move it where, and that a request
// rides on the message it came from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRequest, adminChange, clientChange, isOpen, withRequests, listRequests, KINDS, STATUSES } from '../server/requests.js';

test('a new request needs a title; an unknown kind is "other"; a message id must be a number', () => {
  assert.deepEqual(cleanRequest({ title: '  Add a   gallery page ', kind: 'page' }), { title: 'Add a gallery page', kind: 'page', messageId: null });
  assert.deepEqual(cleanRequest({ title: 'Hours are wrong', kind: 'nonsense', messageId: '12' }), { title: 'Hours are wrong', kind: 'other', messageId: 12 });
  assert.match(cleanRequest({ title: ' ' }).error, /what the request is/);
  assert.match(cleanRequest({ title: 'x', messageId: 'abc' }).error, /isn’t a message/);
  assert.ok(KINDS.includes('broken') && KINDS.includes('details'));
});

test('Daniel can move a request to any status and leave a note; nothing else is a status', () => {
  const now = '2026-11-20T15:00:00.000Z';
  for (const status of STATUSES) assert.deepEqual(adminChange({ status }, now).set, { status, updated_at: now });
  assert.deepEqual(adminChange({ note: ' $150, about a day ' }, now).set, { note: '$150, about a day', updated_at: now });
  assert.deepEqual(adminChange({ note: '' }, now).set, { note: null, updated_at: now });
  assert.match(adminChange({ status: 'done' }, now).error, /status/);
  assert.match(adminChange({}, now).error, /Nothing/);
});

test('the client’s one move is Looks good, and only while the change is on their preview', () => {
  const now = '2026-11-20T15:00:00.000Z';
  assert.deepEqual(clientChange({ status: 'preview' }, { approved: true }, now).set, { status: 'approved', updated_at: now });
  for (const status of ['received', 'working', 'approved', 'live', 'closed']) {
    assert.match(clientChange({ status }, { approved: true }, now).error, /isn’t waiting on you/, status);
  }
  // They can't set a status, a title or a note themselves.
  assert.match(clientChange({ status: 'preview' }, { status: 'live', title: 'Mine' }, now).error, /Nothing/);
});

test('a request is open until it is live or closed', () => {
  assert.deepEqual(STATUSES.filter(isOpen), ['received', 'working', 'preview', 'approved']);
});

test('messages carry the request that hangs on them; without the table there are simply none', async () => {
  const rows = [{ id: 5, project_id: 'p1', message_id: 11, kind: 'page', title: 'Add a gallery page', status: 'working', note: null, created_by: 'client', created_at: 'A', updated_at: 'B' }];
  const env = { INTAKE: { prepare: () => ({ bind: () => ({ all: async () => ({ results: rows }) }) }) } };
  const messages = [{ id: 10, body: 'Hello' }, { id: 11, body: 'Can we add a gallery?' }];
  const withCards = await withRequests(env, 'p1', messages);
  assert.equal(withCards[0].request, undefined);
  assert.deepEqual(withCards[1].request, { id: 5, messageId: 11, kind: 'page', title: 'Add a gallery page', status: 'working', note: null, lane: null, field: null, createdBy: 'client', createdAt: 'A', updatedAt: 'B' });

  const missing = { INTAKE: { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('no such table: change_requests'); } }) }) } };
  assert.deepEqual(await listRequests(missing, 'p1'), []);
  assert.deepEqual(await withRequests(missing, 'p1', messages), messages);
});

test('the client endpoint approves only their own project’s request, and tells Daniel', async () => {
  const { onRequestPatch } = await import('../functions/api/client/requests/[request].js');
  const found = { id: 5, project_id: 'p1', title: 'Add a gallery page', status: 'preview' };
  const statements = [];
  const env = {
    INTAKE: {
      prepare: (text) => ({
        bind: (...values) => {
          statements.push([text, values]);
          return {
            first: async () => (/FROM change_requests WHERE id = \? AND project_id = \?/.test(text) && values[0] === 5 && values[1] === 'p1' ? found : null),
            all: async () => ({ results: [] }),
            run: async () => ({}),
          };
        },
      }),
    },
  };
  const call = (id, body, projectId = 'p1') => onRequestPatch({
    request: new Request('https://steadfastcode.tech/api/client/requests/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
    env, params: { request: id }, data: { project: { id: projectId, answers: JSON.stringify({ businessName: 'N & J Fusions Properties', contactName: 'Joshua Cesavice' }) } },
  });
  assert.equal((await call('5', { approved: true })).status, 200);
  const update = statements.find(([text]) => text.startsWith('UPDATE change_requests'));
  assert.equal(update[0], 'UPDATE change_requests SET status = ?, updated_at = ? WHERE id = ?');
  assert.equal(update[1][0], 'approved');
  const notification = statements.find(([text]) => /INSERT INTO notifications/.test(text));
  assert.match(notification[1][2], /N & J Fusions Properties: “Add a gallery page” approved/);
  assert.equal((await call('5', { approved: true }, 'other-project')).status, 404);
  assert.equal((await call('5', { status: 'live' })).status, 400);
});
