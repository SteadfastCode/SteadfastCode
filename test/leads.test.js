// The outreach board (2026-11-03): the rules in server/leads.js are pure and tested as such; the
// routes under functions/api/admin/leads/ run here against a small in-memory stand-in for D1 that
// understands the handful of statements they send, so what reaches the database is what the tests
// read. The Front Desk inbound endpoint is covered the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { leadFromRow, cleanPatch, newLead, insertStatement, updateStatement, statusAfter, cleanTouch, parseImport, mergeImport, toCsv, STATUSES, KINDS, TIERS } from '../server/leads.js';
import { seedLeads } from '../server/leads-seed.js';
import { answersFromLead } from '../server/intake.js';
import { websiteTiers } from '../src/data/site.ts';
import * as leadsIndex from '../functions/api/admin/leads/index.js';
import * as leadsImport from '../functions/api/admin/leads/import.js';
import * as leadsExport from '../functions/api/admin/leads/export.js';
import * as leadOne from '../functions/api/admin/leads/[id]/index.js';
import * as leadTouches from '../functions/api/admin/leads/[id]/touches.js';
import * as projects from '../functions/api/admin/projects/index.js';
import * as inbound from '../functions/api/leads/inbound.js';

const dist = path.resolve('dist');

/**
 * A stand-in for the INTAKE D1 binding: three tables in memory and just enough SQL to run the
 * statements the leads routes send. Anything it does not know is an error, so a new query shape
 * is a test failure rather than a silent pass.
 */
function fakeIntake(seed = {}) {
  const tables = { leads: [...(seed.leads ?? [])], lead_touches: [...(seed.lead_touches ?? [])], projects: [...(seed.projects ?? [])] };
  let touchId = tables.lead_touches.reduce((m, t) => Math.max(m, t.id ?? 0), 0);
  const log = [];
  const lit = (v) => (v === 'NULL' ? null : v.replace(/^'|'$/g, ''));
  function exec(sql, params) {
    log.push({ sql, params });
    const s = sql.replace(/\s+/g, ' ').trim();
    let m;
    if ((m = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \((.+)\)$/))) {
      const cols = m[2].split(',').map((c) => c.trim());
      const vals = m[3].split(',').map((x) => x.trim());
      let pi = 0;
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i] === '?' ? params[pi++] : lit(vals[i]); });
      if (m[1] === 'lead_touches') row.id = ++touchId;
      tables[m[1]].push(row);
      return { results: [], meta: { changes: 1 } };
    }
    if ((m = s.match(/^UPDATE (\w+) SET (.+) WHERE id = \?$/))) {
      const row = tables[m[1]].find((r) => r.id === params[params.length - 1]);
      let pi = 0;
      for (const st of m[2].split(',').map((x) => x.trim())) {
        const [col, val] = st.split(' = ').map((x) => x.trim());
        const v = val === '?' ? params[pi++] : lit(val);
        if (row) row[col] = v;
      }
      return { results: [], meta: { changes: row ? 1 : 0 } };
    }
    if ((m = s.match(/^DELETE FROM (\w+) WHERE (\w+) = \?$/))) { tables[m[1]] = tables[m[1]].filter((r) => r[m[2]] !== params[0]); return { results: [], meta: { changes: 1 } }; }
    if (/^SELECT \* FROM leads WHERE id = \?$/.test(s)) return { results: tables.leads.filter((r) => r.id === params[0]) };
    if (/^SELECT \* FROM leads ORDER BY/.test(s) || /^SELECT business FROM leads$/.test(s)) return { results: [...tables.leads] };
    if (/^SELECT t\.lead_id, t\.at, t\.kind, t\.text, t\.status FROM lead_touches t JOIN \(SELECT lead_id, MAX\(id\) AS id FROM lead_touches GROUP BY lead_id\) m ON m\.id = t\.id$/.test(s)) {
      const last = new Map();
      for (const t of tables.lead_touches) if (!last.has(t.lead_id) || last.get(t.lead_id).id < t.id) last.set(t.lead_id, t);
      return { results: [...last.values()] };
    }
    if (/FROM lead_touches WHERE lead_id = \?/.test(s)) {
      let rows = tables.lead_touches.filter((t) => t.lead_id === params[0]);
      if (/kind != 'status'/.test(s)) rows = rows.filter((t) => t.kind !== 'status');
      rows.sort((a, b) => (/ORDER BY id DESC/.test(s) ? b.id - a.id : a.id - b.id));
      return { results: rows };
    }
    if (/^SELECT lead_id, at, kind, text FROM lead_touches ORDER BY id$/.test(s)) return { results: [...tables.lead_touches].sort((a, b) => a.id - b.id) };
    if (/FROM projects WHERE lead_id = \?/.test(s)) return { results: tables.projects.filter((p) => p.lead_id === params[0]) };
    if (/FROM projects WHERE lead_id IS NOT NULL/.test(s)) return { results: tables.projects.filter((p) => p.lead_id) };
    throw new Error(`the fake D1 does not know: ${s}`);
  }
  const bound = (sql, params) => ({ all: async () => exec(sql, params), first: async () => exec(sql, params).results[0] ?? null, run: async () => exec(sql, params) });
  return { prepare: (sql) => ({ ...bound(sql, []), bind: (...params) => bound(sql, params) }), batch: async (stmts) => { const out = []; for (const st of stmts) out.push(await st.run()); return out; }, tables, log };
}

const req = (url, init = {}) => new Request(url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }, body: init.body == null ? undefined : JSON.stringify(init.body) });
const read = async (res) => ({ status: res.status, body: await res.json() });
const DATA = { email: 'daniel@steadfastcode.tech' };

test('a row from the contact form reads as an inbound lead, and an old status maps onto the pipeline', () => {
  const l = leadFromRow({ id: 'a', received_at: '2026-11-01T12:00:00Z', name: 'Pat', email: 'pat@example.com', phone: null, business: 'Pat Plumbing', plan: 'business', site: null, message: 'Need a site', source_detail: 'steadfastcode.tech/contact', status: 'started', updated_at: '' });
  assert.equal(l.kind, 'inbound');
  assert.equal(l.status, 'won', 'started was a project made from it');
  assert.equal(l.contact, 'Pat');
  assert.equal(l.fit, 'business');
  assert.equal(l.website, '');
  assert.equal(l.updatedAt, '2026-11-01T12:00:00Z', 'no updated_at yet: when it came in');
  assert.equal(leadFromRow({ id: 'b', received_at: 't', status: 'closed' }).status, 'lost');
  assert.equal(leadFromRow({ id: 'c', received_at: 't', status: 'bogus', kind: 'client', site_state: 'great', plan: 'platinum', next_at: 'soon' }).status, 'new');
  assert.equal(leadFromRow({ id: 'c', received_at: 't', kind: 'client' }).kind, 'inbound');
});

test('cleaning: text is trimmed and capped, enums are checked, a bare domain gets its scheme, a bad website is named', () => {
  const { patch, problems } = cleanPatch({ business: '  Ace  ', website: 'ace.example/', kind: 'prospect', siteState: 'none', fit: '', nextAt: '2026-11-30', ignored: 'x' });
  assert.deepEqual(problems, []);
  assert.equal(patch.business, 'Ace');
  assert.equal(patch.website, 'https://ace.example/');
  assert.equal(patch.fit, '');
  assert.ok(!('ignored' in patch));
  assert.match(cleanPatch({ website: 'javascript:alert(1)' }).problems[0], /website does not look like an address/);
  assert.match(cleanPatch({ kind: 'client' }).problems[0], /kind must be one of inbound, prospect, partner/);
  assert.match(cleanPatch({ siteState: 'great' }).problems[0], /siteState must be one of/);
  assert.match(cleanPatch({ fit: 'platinum' }).problems[0], /fit must be one of/);
  assert.equal(cleanPatch({ why: 'x'.repeat(2000) }).patch.why.length, 1500);
  assert.equal(cleanPatch({ nextAt: '2026-13-45' }).problems.length, 1);
  assert.equal(cleanPatch({ phone: 7175550100 }).problems[0], 'phone must be text.');
  assert.deepEqual(cleanPatch(null).problems, ['Send an object of fields.']);
  assert.deepEqual(TIERS, websiteTiers.map((t) => t.id), 'the packages are the site’s');
});

test('a new lead and its INSERT name every NOT NULL column; an update clears blanks to NULL except where the table forbids it', () => {
  const { lead, problems } = newLead({ business: "Joe's Plumbing", contact: 'Joe', email: 'joe@example.com', fit: 'business', town: 'Lititz' }, { now: '2026-11-03T15:00:00Z', id: 'L1' });
  assert.deepEqual(problems, []);
  assert.equal(lead.id, 'L1');
  assert.equal(lead.kind, 'prospect');
  assert.equal(lead.status, 'new');
  assert.equal(lead.createdAt, '2026-11-03T15:00:00Z');
  const ins = insertStatement(lead);
  assert.equal((ins.sql.match(/\?/g) || []).length, ins.params.length);
  assert.equal(ins.params[ins.sql.slice(ins.sql.indexOf('(') + 1, ins.sql.indexOf(')')).split(',').map((c) => c.trim()).indexOf('message')], '', 'message is NOT NULL');
  assert.equal(newLead({ contact: 'nobody' }, { now: 't' }).problems[0], 'The business, church or organization name is required.');
  const u = updateStatement('L1', { phone: '', email: '', contact: '', fit: '', status: 'contacted' }, 'now');
  assert.equal(u.sql, 'UPDATE leads SET phone = ?, email = ?, name = ?, plan = ?, status = ?, updated_at = ? WHERE id = ?');
  assert.deepEqual(u.params, [null, '', '', null, 'contacted', 'now', 'L1']);
  assert.equal(updateStatement('L1', {}, 'now').sql, 'UPDATE leads SET updated_at = ? WHERE id = ?');
});

test('a touch moves the status the way a conversation does, unless Daniel says otherwise', () => {
  assert.equal(statusAfter('new', 'email'), 'contacted');
  assert.equal(statusAfter('contacted', 'call'), 'contacted');
  assert.equal(statusAfter('contacted', 'reply'), 'replied');
  assert.equal(statusAfter('meeting', 'reply'), 'meeting', 'nothing moves backwards');
  assert.equal(statusAfter('lost', 'reply'), 'lost', 'and nothing comes back from lost on its own');
  assert.equal(statusAfter('replied', 'meeting'), 'meeting');
  assert.equal(statusAfter('new', 'note'), 'new');
  const lead = { status: 'new' };
  let t = cleanTouch({ kind: 'video', text: 'Sent the Loom audit', nextStep: 'Follow up if quiet', nextAt: '2026-11-09' }, lead);
  assert.deepEqual(t.problems, []);
  assert.equal(t.touch.status, 'contacted');
  assert.deepEqual(t.patch, { nextStep: 'Follow up if quiet', nextAt: '2026-11-09', status: 'contacted' });
  t = cleanTouch({ kind: 'note', text: 'Budget is tight', status: 'hold' }, { status: 'replied' });
  assert.equal(t.patch.status, 'hold', 'an explicit status wins');
  t = cleanTouch({ kind: 'call', text: '' }, { status: 'contacted' });
  assert.equal(t.touch.text, 'Called', 'a touch with no words still says what it was');
  assert.equal(t.touch.status, null, 'and a status that did not move is not recorded as a move');
  assert.match(cleanTouch({ kind: 'fax', text: 'x' }, lead).problems[0], /kind must be one of/);
  assert.match(cleanTouch({ kind: 'project', text: 'x' }, lead).problems[0], /kind must be one of/);
  assert.match(cleanTouch({ kind: 'note', text: '' }, lead).problems[0], /note needs some text/);
  assert.match(cleanTouch({ kind: 'note', text: 'x', nextAt: 'soon' }, lead).problems[0], /nextAt/);
  assert.match(cleanTouch({ kind: 'note', text: 'x', status: 'maybe' }, lead).problems[0], /status must be one of/);
});

test('a pasted list is read as CSV or JSON, and merging skips what is already on the board', () => {
  const csv = ['Business,Town,Website,Contact,Phone,Why,Kind,Notes', 'Lititz Bakery,Lititz,lititzbakery.example,"Smith, Ann",717-555-0200,"No site, Facebook only",prospect,from a friend', "Joe's Plumbing,Lititz,,,,dup,prospect,", 'Manheim Signs,Manheim,,,,,partner,'].join('\r\n');
  const { rows, problems } = parseImport(csv);
  assert.deepEqual(problems, []);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].contact, 'Smith, Ann', 'quoted commas survive');
  const multi = parseImport('Business,Notes\nA Bakery,"Called twice.\nLeft a message."\nB Signs,"one line"\n\n');
  assert.equal(multi.rows.length, 2, 'a quoted cell may run over lines; blank lines are skipped');
  assert.equal(multi.rows[0].notes, 'Called twice.\nLeft a message.');
  assert.equal(multi.rows[1].business, 'B Signs');
  const m = mergeImport(["joe's plumbing"], rows, { now: 't', newId: (() => { let n = 0; return () => `id-${++n}`; })() });
  assert.deepEqual(m.skipped, ["Joe's Plumbing"]);
  assert.equal(m.added.length, 2);
  assert.equal(m.added[0].lead.website, 'https://lititzbakery.example');
  assert.equal(m.added[0].note, 'from a friend');
  assert.equal(m.added[1].lead.kind, 'partner');
  assert.equal(m.added[1].note, null);
  const j = mergeImport([], parseImport(JSON.stringify([{ business: 'Ephrata Dental' }, { business: 'EPHRATA DENTAL' }, { town: 'nowhere' }])).rows, { now: 't' });
  assert.equal(j.added.length, 1);
  assert.deepEqual(j.skipped, ['EPHRATA DENTAL'], 'the same name in other letters is the same business');
  assert.match(j.problems[0], /Row 3: The business/);
  assert.match(parseImport('town,phone\nLititz,1').problems[0], /one of them the business/);
  assert.match(parseImport('').problems[0], /Nothing to import/);
  assert.match(parseImport('{"x":').problems[0], /Not valid JSON/);
  assert.deepEqual(parseImport('{"leads":[{"business":"A"}]}').rows, [{ business: 'A' }]);
});

test('the research list names its source and why for every entry, and carries no contact details', () => {
  assert.ok(seedLeads.length >= 20, `${seedLeads.length} entries`);
  for (const s of seedLeads) {
    assert.ok(s.business && s.source && s.why, `${s.business} carries a source and a why`);
    assert.ok(KINDS.includes(s.kind) && s.kind !== 'inbound', `${s.business}: kind`);
    assert.ok(!s.email && !s.phone && !s.contact, `${s.business}: no contact details`);
    assert.match(s.source, /docs\/(ideas|research)\//, `${s.business}: the source is a research document`);
    assert.deepEqual(newLead(s, { now: 't' }).problems, [], `${s.business} imports cleanly`);
  }
  assert.equal(new Set(seedLeads.map((s) => s.business.toLowerCase())).size, seedLeads.length, 'no two entries share a name');
});

test('the CSV export quotes what it must and folds each lead’s log into one cell', () => {
  const csv = toCsv([leadFromRow({ id: 'a', received_at: 't', business: 'A "B" C', name: 'Smith, Ann', status: 'new' })], new Map([['a', [{ at: '2026-11-03T15:00:00Z', kind: 'email', text: 'Sent the audit, with "quotes"' }]]]));
  assert.match(csv.split('\n')[0], /^id,kind,business,/);
  assert.match(csv, /"A ""B"" C"/);
  assert.match(csv, /"Smith, Ann"/);
  assert.match(csv, /"2026-11-03T15:00 email: Sent the audit, with ""quotes"""/);
  // What a visitor typed into the contact form must never run as a formula when the file is opened.
  const hostile = toCsv([leadFromRow({ id: 'b', received_at: 't', business: '=HYPERLINK("http://evil.example","x")', name: '+1 Ann', message: '-2+3+cmd|\' /C calc\'!A0', phone: '@SUM(1)', status: 'new' })]);
  assert.match(hostile, /,"'=HYPERLINK\(""http:\/\/evil\.example"",""x""\)",/);
  assert.match(hostile, /,'\+1 Ann,/);
  assert.match(hostile, /,'-2\+3\+cmd\|' \/C calc'!A0,/);
  assert.match(hostile, /,'@SUM\(1\),/);
  assert.doesNotMatch(hostile, /,[=+\-@]/);
});

test('the intake answers from a board lead carry its town, why, source and last touches', () => {
  const a = answersFromLead({ kind: 'prospect', name: 'Joe', email: 'joe@example.com', phone: '717', business: "Joe's Plumbing", plan: 'business', site: 'https://joes.example', town: 'Lititz', why: 'Slow site', source_detail: 'drove past', message: '' }, [{ at: '2026-11-01T10:00:00Z', kind: 'video', text: 'Sent the audit' }]);
  assert.equal(a.serviceArea, 'Lititz');
  assert.equal(a.currentSite, 'https://joes.example');
  assert.equal(a.tier, 'business');
  assert.deepEqual(a.pages, ['Home', 'Services', 'About', 'Contact']);
  assert.match(a.notes, /Why we reached out: Slow site/);
  assert.match(a.notes, /Found through: drove past/);
  assert.match(a.notes, /2026-11-01 video: Sent the audit/);
  assert.doesNotMatch(a.notes, /contact form/);
  const inboundOnly = answersFromLead({ name: 'Pat', email: 'pat@example.com', business: 'Pat Plumbing', plan: 'unsure', message: 'Need a site', source_detail: 'steadfastcode.tech/contact' });
  assert.equal(inboundOnly.notes, 'From the contact form: Need a site', 'a contact-form lead reads as before');
  assert.equal(inboundOnly.serviceArea, undefined);
});

test('the board route lists every lead with its last touch and projects; adding one writes the row and its first note', async () => {
  const env = { INTAKE: fakeIntake({
    leads: [{ id: 'cf', received_at: '2026-11-01T12:00:00Z', updated_at: '', name: 'Pat', email: 'pat@example.com', phone: null, business: 'Pat Plumbing', plan: 'business', site: null, message: 'Need a site', source_detail: 'steadfastcode.tech/contact', status: 'new', kind: 'inbound' }],
    lead_touches: [{ id: 1, lead_id: 'cf', at: '2026-11-01T13:00:00Z', kind: 'email', text: 'Replied by email', status: 'contacted', who: 'daniel' }, { id: 2, lead_id: 'cf', at: '2026-11-02T13:00:00Z', kind: 'reply', text: 'Wants a call', status: 'replied', who: 'daniel' }],
    projects: [{ id: 'P1', lead_id: 'cf', status: 'intake', preview_url: null, answers: '{"businessName":"Pat Plumbing"}' }],
  }) };
  const b = await read(await leadsIndex.onRequestGet({ env }));
  assert.equal(b.status, 200);
  assert.equal(b.body.leads.length, 1);
  assert.equal(b.body.leads[0].kind, 'inbound');
  assert.equal(b.body.leads[0].lastTouch.kind, 'reply', 'the newest touch, not the first');
  assert.deepEqual(b.body.leads[0].projects, [{ id: 'P1', status: 'intake', previewUrl: null, business: 'Pat Plumbing' }]);
  assert.equal(b.body.seedAvailable, seedLeads.length);
  const add = await read(await leadsIndex.onRequestPost({ request: req('http://localhost/api/admin/leads', { method: 'POST', body: { business: "Joe's Plumbing & Heating", kind: 'prospect', town: 'Lititz', website: 'joesplumbing.example', contact: 'Joe', phone: '(717) 555-0100', email: 'joe@example.com', fit: 'business', why: 'Slow site, no hours', notes: 'Truck says est. 1998' } }), env, data: DATA }));
  assert.equal(add.status, 201, JSON.stringify(add.body));
  const joe = add.body.lead;
  assert.match(joe.id, /^[0-9a-f-]{36}$/);
  assert.equal(joe.website, 'https://joesplumbing.example');
  assert.equal(joe.status, 'new');
  assert.equal(joe.lastTouch.text, 'Truck says est. 1998');
  const row = env.INTAKE.tables.leads.find((r) => r.id === joe.id);
  assert.equal(row.name, 'Joe');
  assert.equal(row.plan, 'business');
  assert.equal(row.message, '', 'message is NOT NULL in the table');
  assert.equal(row.site_state, 'unknown');
  assert.equal(env.INTAKE.tables.lead_touches.filter((t) => t.lead_id === joe.id).length, 1);
  const bad = await read(await leadsIndex.onRequestPost({ request: req('http://localhost/api/admin/leads', { method: 'POST', body: { business: 'X', status: 'maybe' } }), env, data: DATA }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /status must be one of/);
  assert.equal((await leadsIndex.onRequestPost({ request: req('http://localhost/api/admin/leads', { method: 'POST', body: { contact: 'nobody' } }), env, data: DATA })).status, 400, 'business is required');
});

test('a lead: its log and projects; a touch moves it; a patch edits it and logs a status change; delete is refused while a project points at it', async () => {
  const env = { INTAKE: fakeIntake({ leads: [{ id: 'L1', received_at: '2026-11-03T10:00:00Z', updated_at: '2026-11-03T10:00:00Z', name: 'Joe', email: 'joe@example.com', phone: null, business: "Joe's Plumbing", plan: null, site: null, message: '', source_detail: null, status: 'new', kind: 'prospect', site_state: 'unknown' }] }) };
  const params = { id: 'L1' };
  assert.equal((await leadOne.onRequestGet({ env, params: { id: 'nobody' } })).status, 404);
  let r = await read(await leadTouches.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { kind: 'video', text: 'Sent the Loom audit', nextStep: 'Follow up if quiet', nextAt: '2026-11-09' } }), env, params }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lead.status, 'contacted');
  assert.equal(r.body.lead.nextAt, '2026-11-09');
  assert.equal(r.body.touches[0].kind, 'video');
  assert.equal(r.body.touches[0].status, 'contacted', 'the entry carries the move');
  assert.equal(r.body.touches[0].who, 'daniel');
  r = await read(await leadTouches.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { kind: 'reply', text: 'Joe wants to meet Thursday' } }), env, params }));
  assert.equal(r.body.lead.status, 'replied');
  assert.equal((await leadTouches.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { kind: 'fax', text: 'x' } }), env, params })).status, 400);
  r = await read(await leadOne.onRequestPatch({ request: req('http://localhost/x', { method: 'PATCH', body: { patch: { phone: '717-555-0199', status: 'meeting', role: 'Owner', nextAt: '' } } }), env, params }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.lead.phone, '717-555-0199');
  assert.equal(r.body.lead.status, 'meeting');
  assert.equal(r.body.lead.nextAt, '');
  assert.equal(r.body.touches[0].kind, 'status');
  assert.match(r.body.touches[0].text, /Replied → Meeting set/);
  assert.equal(env.INTAKE.tables.leads[0].next_at, null, 'a blank clears the column');
  assert.equal((await leadOne.onRequestPatch({ request: req('http://localhost/x', { method: 'PATCH', body: { patch: { email: 'nope' } } }), env, params })).status, 400);
  assert.equal((await leadOne.onRequestPatch({ request: req('http://localhost/x', { method: 'PATCH', body: {} }), env, params })).status, 400);
  r = await read(await leadOne.onRequestPatch({ request: req('http://localhost/x', { method: 'PATCH', body: { patch: { status: 'meeting' } } }), env, params }));
  assert.equal(r.body.touches.filter((t) => t.kind === 'status').length, 1, 'the same status again is not a change');
  const get = await read(await leadOne.onRequestGet({ env, params }));
  assert.equal(get.body.touches.length, 3);
  assert.equal(get.body.lead.lastTouch.kind, 'status');
  // A project from the lead: Won, logged, and from then on the lead stays.
  const started = await read(await projects.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { leadId: 'L1' } }), env, data: DATA }));
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal(started.body.answers.businessName, "Joe's Plumbing");
  assert.equal(started.body.answers.phone, '717-555-0199');
  assert.match(started.body.answers.notes, /Sent the Loom audit/);
  assert.doesNotMatch(started.body.answers.notes, /Replied → Meeting set/, 'status changes are not notes');
  assert.equal(env.INTAKE.tables.projects[0].lead_id, 'L1');
  assert.equal(env.INTAKE.tables.leads[0].status, 'won');
  const last = env.INTAKE.tables.lead_touches.at(-1);
  assert.equal(last.kind, 'project');
  assert.equal(last.status, 'won');
  assert.match(last.text, /Project started: Joe's Plumbing/);
  const del = await read(await leadOne.onRequestDelete({ env, params }));
  assert.equal(del.status, 409);
  assert.match(del.body.error, /A project was started from this lead/);
  assert.equal((await projects.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { leadId: 'nobody' } }), env, data: DATA })).status, 404);
});

test('a partner never becomes a project, and a lead with no project can be deleted with its log', async () => {
  const env = { INTAKE: fakeIntake({ leads: [{ id: 'P', received_at: 't', updated_at: 't', name: '', email: '', business: 'Lancaster Chamber', message: '', status: 'new', kind: 'partner' }], lead_touches: [{ id: 1, lead_id: 'P', at: 't', kind: 'note', text: 'x', status: null, who: 'daniel' }] }) };
  const r = await read(await projects.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { leadId: 'P' } }), env, data: DATA }));
  assert.equal(r.status, 400);
  assert.match(r.body.error, /A partner sends prospects/);
  assert.equal(env.INTAKE.tables.projects.length, 0);
  const del = await read(await leadOne.onRequestDelete({ env, params: { id: 'P' } }));
  assert.equal(del.status, 200);
  assert.equal(env.INTAKE.tables.leads.length, 0);
  assert.equal(env.INTAKE.tables.lead_touches.length, 0, 'the log goes with it');
  assert.equal((await leadOne.onRequestDelete({ env, params: { id: 'P' } })).status, 404);
});

test('import adds what is new, skips what is on the board, and the research list loads once', async () => {
  const env = { INTAKE: fakeIntake({ leads: [{ id: 'L1', received_at: 't', updated_at: 't', name: 'Joe', email: '', business: "Joe's Plumbing", message: '', status: 'new', kind: 'prospect' }] }) };
  const csv = ['Business,Town,Contact,Notes', 'Lititz Bakery,Lititz,"Smith, Ann",from a friend', "Joe's Plumbing,Lititz,,", 'Manheim Signs,Manheim,,'].join('\n');
  let r = await read(await leadsImport.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { text: csv } }), env }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.added, 2);
  assert.deepEqual(r.body.skipped, ["Joe's Plumbing"]);
  assert.equal(env.INTAKE.tables.leads.length, 3);
  assert.equal(env.INTAKE.tables.lead_touches.length, 1, 'the one note became a touch');
  assert.equal(env.INTAKE.tables.lead_touches[0].text, 'from a friend');
  r = await read(await leadsImport.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { seed: true } }), env }));
  assert.equal(r.body.added, seedLeads.length);
  assert.deepEqual(r.body.problems, []);
  r = await read(await leadsImport.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { seed: true } }), env }));
  assert.equal(r.body.added, 0);
  assert.equal(r.body.skipped.length, seedLeads.length);
  const board = await read(await leadsIndex.onRequestGet({ env }));
  assert.equal(board.body.seedAvailable, 0);
  assert.equal((await leadsImport.onRequestPost({ request: req('http://localhost/x', { method: 'POST', body: { text: '' } }), env })).status, 400);
  const csvOut = await leadsExport.onRequestGet({ env });
  assert.match(csvOut.headers.get('content-type'), /text\/csv/);
  const text = await csvOut.text();
  assert.match(text, /"Smith, Ann"/);
  assert.match(text, /Lancaster Chamber/);
  assert.match(text, /from a friend/);
});

test('the inbound endpoint is a door only with the secret, and lands a lead on the board as new', async () => {
  const env = { INTAKE: fakeIntake(), LEADS_INBOUND_SECRET: 's3cret' };
  const body = { name: 'Pat', email: 'pat@example.com', phone: '717', business: 'Pat Plumbing', message: 'Missed call: wants a quote for a site', sourceDetail: 'front-desk: missed call' };
  assert.equal((await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body }), env: { INTAKE: env.INTAKE } })).status, 404, 'no secret configured: no endpoint');
  assert.equal((await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body }), env })).status, 401);
  assert.equal((await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body, headers: { authorization: 'Bearer wrong' } }), env })).status, 401);
  assert.equal(env.INTAKE.tables.leads.length, 0);
  const ok = await read(await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body, headers: { authorization: 'Bearer s3cret' } }), env }));
  assert.equal(ok.status, 201);
  const row = env.INTAKE.tables.leads[0];
  assert.equal(row.id, ok.body.id);
  assert.equal(row.kind, 'inbound');
  assert.equal(row.status, 'new');
  assert.equal(row.source_detail, 'front-desk: missed call');
  assert.equal(env.INTAKE.tables.lead_touches[0].who, 'front-desk');
  assert.equal(env.INTAKE.tables.lead_touches[0].text, body.message);
  assert.equal((await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body: { message: 'no one' }, headers: { authorization: 'Bearer s3cret' } }), env })).status, 400);
  assert.equal((await inbound.onRequestPost({ request: req('http://localhost/api/leads/inbound', { method: 'POST', body: { name: 'x' }, headers: { authorization: 'Bearer s3cret' } }), env })).status, 400);
});

test('the leads page is built, noindex, self-contained, and carries the same statuses the server uses', () => {
  const html = fs.readFileSync(path.join(dist, 'admin', 'leads.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const m of html.matchAll(/(?:src|href)="(https?:)?\/\/([^"/]+)/g)) assert.equal(m[2], 'steadfastcode.tech', `the leads page loads ${m[0]}`);
  const config = JSON.parse(html.match(/<script type="application\/json" id="leads-config">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(config.statuses, STATUSES);
  assert.deepEqual(config.tiers.map((t) => t.id), websiteTiers.map((t) => t.id));
  for (const f of ['admin.html', 'admin/usage.html', 'admin/leads.html']) assert.match(fs.readFileSync(path.join(dist, f), 'utf8'), /href="\/admin\/leads"/, `${f} links the board`);
  const sitemaps = fs.readdirSync(dist).filter((f) => f.startsWith('sitemap') && f.endsWith('.xml'));
  for (const f of sitemaps) assert.doesNotMatch(fs.readFileSync(path.join(dist, f), 'utf8'), /\/admin/);
});
