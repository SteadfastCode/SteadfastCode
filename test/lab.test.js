// The lab card (server/lab.js): the build's list read safely, Daniel's changes on top, and the
// public answer the lab's landing page reads, which says nothing but which tests show and how finished.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanManifest, mergeTest, checkLabChange, labHost } from '../server/lab.js';
import { onRequestGet as publicLab } from '../functions/api/lab.js';

test('the build’s list is checked, and Daniel’s changes go on top', () => {
  const list = cleanManifest([{ folder: 'halo-picker', name: 'The halo picker', status: 'rough', updated: '2026-11-24', shown: true }, { folder: '../etc', name: 'x' }, { folder: 'edges', name: 'Edges', status: 'odd', shown: false }, null]);
  assert.deepEqual(list.map((t) => t.folder), ['halo-picker', 'edges']);
  assert.equal(list[1].status, 'rough', 'an unknown status reads as rough');
  assert.equal(list[1].shown, false);
  assert.deepEqual(mergeTest(list[0], null).changed, false);
  const m = mergeTest(list[0], { shown: 0, status: 'ready', updated: '2026-11-25' });
  assert.deepEqual([m.shown, m.status, m.updated, m.changed], [false, 'ready', '2026-11-25', true]);
  assert.deepEqual(mergeTest(list[1], { shown: null, status: null, updated: null }).shown, false, 'nothing set leaves the build’s say');
  assert.equal(labHost('https://Lab.stdfst-deliverance.pages.dev/'), 'lab.stdfst-deliverance.pages.dev');
  assert.equal(labHost('lab.x.pages.dev/halo-picker/'), 'lab.x.pages.dev');
});

test('a change names one test and says something', () => {
  assert.ok(checkLabChange({}).error);
  assert.ok(checkLabChange({ folder: 'halo-picker' }).error, 'nothing to change');
  assert.ok(checkLabChange({ folder: 'halo-picker', status: 'done' }).error);
  assert.ok(checkLabChange({ folder: 'halo-picker', shown: 'yes' }).error);
  assert.deepEqual(checkLabChange({ folder: 'halo-picker', shown: false }), { folder: 'halo-picker', shown: false });
  assert.deepEqual(checkLabChange({ folder: 'halo-picker', status: 'ready' }), { folder: 'halo-picker', status: 'ready' });
  assert.deepEqual(checkLabChange({ folder: 'halo-picker', reset: true }), { folder: 'halo-picker', reset: true });
});

test('the lab’s page gets only its own changes, from any origin', async () => {
  const projects = [
    { id: 'p1', answers: JSON.stringify({ labUrl: 'https://lab.stdfst-deliverance.pages.dev' }) },
    { id: 'p2', answers: JSON.stringify({ labUrl: 'https://lab.stdfst-deliverance.pages.dev.evil.example' }) },
  ];
  const rows = { p1: [{ folder: 'halo-picker', shown: 0, status: 'ready', updated: '2026-11-25' }, { folder: 'transitions', shown: null, status: null, updated: null }], p2: [{ folder: 'halo-picker', shown: 1 }] };
  const INTAKE = { prepare: (sql) => ({ bind: (arg) => ({ all: async () => ({ results: /FROM projects/.test(sql) ? projects.filter((p) => p.answers.includes(arg.replace(/%/g, ''))) : rows[arg] || [] }) }) }) };
  const ask = (site) => publicLab({ request: new Request(`https://steadfastcode.tech/api/lab?site=${encodeURIComponent(site)}`), env: { INTAKE } });
  const r = await ask('lab.stdfst-deliverance.pages.dev');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await r.json(), { tests: { 'halo-picker': { shown: false, status: 'ready', updated: '2026-11-25' }, transitions: {} } });
  assert.deepEqual(await (await ask('nobody.pages.dev')).json(), { tests: {} });
  assert.deepEqual(await (await ask('')).json(), { tests: {} });
});
