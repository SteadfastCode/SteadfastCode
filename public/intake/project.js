// The shared project form (2026-11-01). Daniel's /admin and the client's /client both mount this,
// so the two sides are the same form: the same questions (src/data/intake.ts, embedded by each page
// as config), the same scope notes and price, files, activity and build progress. The client can
// edit everything except fields marked owner: 'daniel'; nothing is hidden from them.
//
// Live, field by field: each side autosaves a field when typing pauses and checks for the other
// side's changes every 2 seconds. A field someone is typing in is never overwritten under them;
// the other screen shows "<name> is editing" on it instead.

const POLL_MS = 2000;
// The stages the build service reports (steadfast-ai scripts/client-builds.mjs, build_step 1–8).
const STEPS = ['Picked up', 'Setting up', 'Reading the brief', 'Writing the site', 'Running the checks', 'Final check', 'Publishing', 'Done'];
const LAST = STEPS.length;
const statusLabel = { intake: 'Getting started', 'build-requested': 'Build requested', building: 'Building', preview: 'Preview ready', live: 'Live', closed: 'Closed' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n, from) => (from ? 'from ' : '') + '$' + Number(n).toLocaleString('en-US');
const since = (iso) => { const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const clock = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
// Hours as the form holds them: an old free-text answer shows as the note.
const normHours = (v) => (!v ? { mode: 'set', days: {}, note: '' } : typeof v === 'string' ? { mode: 'set', days: {}, note: v } : { mode: v.mode || 'set', days: v.days || {}, note: v.note || '' });
// "(717) 538-5640" as it's typed: digits only, a leading 1 dropped, ten digits at most.
export function phoneMask(value) {
  const d = String(value || '').replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString(); };

/**
 * @param {object} o
 * @param {HTMLElement} o.root      where the form goes
 * @param {HTMLElement} o.bar       the fixed bottom bar (#saved, #readiness, #build inside)
 * @param {HTMLElement} o.progress  the full-width sticky progress strip
 * @param {object} o.config         { sections, tiers, editorPrice }
 * @param {'admin'|'client'} o.mode
 * @param {object} o.routes         { project, presence, uploads, file(id), build, link? }
 * @param {object} [o.headers]      extra request headers (the client's bearer token)
 * @param {string} [o.backHref]     a back link (admin)
 */
export async function mountProject(o) {
  const { root, bar, progress, config: C, mode, routes } = o;
  const admin = mode === 'admin';
  const savedEl = bar.querySelector('#saved');
  const readyEl = bar.querySelector('#readiness');
  const buildBtn = bar.querySelector('#build');
  let P = null;
  let pending = {};
  const localEditAt = {};
  let saveTimer = null;
  let pollTimer = null;
  let lastUploads = '';
  let lastEvents = '';
  let stopped = false;
  // The link just made, for this visit: what the page can show when the site has no LINK_KEY to keep a copy.
  let madeUrl = null;

  const api = async (path, init = {}) => {
    const isForm = init.body instanceof FormData;
    const r = await fetch(path, { credentials: 'same-origin', ...init, headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...(o.headers || {}), ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  };
  const tierOf = (id) => C.tiers.find((t) => t.id === id);
  // Which questions are on this form (2026-11-17): the server says (check.asked), from the kind of
  // site's preset or Daniel's own list. A section shows when any of its questions does.
  const kind = () => P.check?.siteType || 'local';
  const asked = () => P.check?.asked || [];
  const tierOk = (x) => !x.tiers || (P.answers.tier && x.tiers.includes(P.answers.tier));
  const applies = (x) => (!x.clientHidden || admin) && tierOk(x) && (x.fields ? true : !x.menu && (!x.when || !!P.answers[x.when]) && asked().includes(x.id));
  const canEdit = (f) => admin || (P.editable || []).includes(f.id);
  // How a question reads: its wording for this kind of site when it has one, in the client's words on their side.
  const words = (x) => x.wording?.[kind()] || {};
  const label = (f) => { const w = words(f); return admin ? w.label || f.label : w.you || w.label || f.you || f.label; };
  const helpOf = (f) => { const w = words(f); return admin ? w.help ?? f.help : w.youHelp ?? w.help ?? f.youHelp ?? f.help; };
  const secTitle = (s) => { const w = words(s); return admin ? w.title || s.title : w.you || w.title || s.you || s.title; };
  const building = () => ['build-requested', 'building'].includes(P.status);
  const gated = () => !admin && P.agreement?.needed;
  // The client's page is tabs (2026-11-04). Before signing: the contract, and planning for a head
  // start. After: Your site (preview or live site, progress, activity), Planning (the intake; after
  // launch, Your details: only the facts that change, and a Request a change box on Your site), the
  // Care plan once Daniel offers one (before or after launch), and Documents (everything signed).
  // The tab is remembered for this browser tab, so a reload stays where it was.
  const launched = () => !!P?.launched;
  // The intake retires after the first meeting (2026-11-19): once Daniel closes it, the client's
  // planning tab is "Details", read-only, and every change is a message to him.
  const closed = () => !admin && !!P?.intakeClosed;
  const WIDE = matchMedia('(min-width: 900px)');
  const wide = () => !admin && WIDE.matches;
  const clientTabs = () => {
    if (admin) return [];
    // Messages with Daniel from the first day (2026-11-04), with the unread count on the tab.
    // On a wide screen Messages is a drawer on the right instead (2026-11-04), open from any tab.
    const msgs = wide() ? [] : [['messages', P.unreadMessages ? `Messages (${P.unreadMessages})` : 'Messages']];
    if (gated()) return P.agreement.reason !== 'no-package' ? [['contract', 'Contract'], ['planning', 'Planning'], ...msgs] : [];
    return [['site', 'Your site'], ['planning', launched() || closed() ? 'Details' : 'Planning'], ...msgs, ...(P.care ? [['care', 'Care plan']] : []), ['docs', 'Documents']];
  };
  let tab = (() => { try { return sessionStorage.getItem('clientTab') || ''; } catch { return ''; } })();
  const fixTab = () => { const ts = clientTabs(); if (ts.length && !ts.some(([id]) => id === tab)) tab = ts[0][0]; };
  const tabbed = () => clientTabs().length > 0;
  const shape = () => (gated() ? 'agreement:' + (P.agreement.reason || '') + ':' + (P.agreement.current?.sha256 || '') + ':' + P.agreement.signingOpen + '|' : '') + (admin ? '' : `tabs:${tab}:${launched()}:${closed()}:${!!P.care}:${(P.assets || []).length ? 'assets' : ''}:${(P.requests || []).length ? 'requests' : ''}|`) + C.sections.filter(applies).map((s) => s.id + ':' + s.fields.filter(applies).map((f) => f.id).join(',')).join('|');
  // What each tab shows. Daniel's page has everything; so does the client's planning tab before signing.
  const parts = () => {
    // Daniel's messages live in /admin/inbox (2026-11-04); his project page links there.
    if (admin) return { status: 1, scope: 1, link: 1, requests: 1, assets: 1, files: 1, fields: 'all', activity: 1, intro: 0 };
    if (tab === 'messages') return { messages: 1 };
    if (gated()) return { status: 1, scope: 1, assets: 1, files: 1, fields: 'all', activity: 1, intro: 1 };
    return ({ site: { status: 1, scope: 1, requests: 1, assets: 1, request: launched() && !closed(), activity: 1 }, planning: { assets: 1, files: 1, fields: launched() && !closed() ? 'live' : 'all', intro: 1 }, care: { care: 1 }, docs: { docs: 1 } })[tab] || {};
  };
  const fieldShown = (mode) => (f) => applies(f) && (mode === 'all' || (f.live && f.id !== 'notes'));

  // ---- fields ----
  function fieldHtml(f) {
    const v = P.answers[f.id];
    const editable = canEdit(f);
    const dis = editable ? '' : ' disabled';
    // A closed intake is a record, not a form: no hints about how to fill it in.
    const help = (closed() ? [] : [helpOf(f), editable ? null : 'Daniel sets this']).filter(Boolean).map((h) => `<span class="help">${esc(h)}</span>`).join('');
    const id = 'f-' + f.id;
    const who = `<span class="who" data-who="${f.id}" hidden></span>`;
    const req = f.required ? ' *' : '';
    // Each field is its label, then its control in a .ctl box; the "is editing" badge sits on that
    // box's top border, so it lands in the same place whatever the label and help text above it.
    let lab = '';
    let ctl;
    let after = '';
    switch (f.type) {
      case 'tier':
        ctl = `<div class="tiers">${C.tiers.map((t) => `<button type="button" data-tier="${t.id}" aria-pressed="${v === t.id}"${dis}><b>${esc(t.name)}</b><span>${money(t.price, t.from)} · ${t.scope.pages} page${t.scope.pages === 1 ? '' : 's'}</span></button>`).join('')}</div>`;
        after = editable ? '' : help;
        break;
      case 'bool':
        ctl = `<label class="check"><input type="checkbox" id="${id}" data-f="${f.id}" ${v ? 'checked' : ''}${dis}> ${esc(label(f))}${f.id === 'editor' && C.editorPrice ? ` (+${money(C.editorPrice)})` : ''}</label>`;
        after = help;
        break;
      case 'pricing':
        // Daniel's only (clientHidden). The buttons and the result line are painted from P.check, so they follow each save.
        lab = `<label for="pricecustom">${esc(label(f))}${help}</label>`;
        ctl = `<div class="pricing"><div class="pricebtns">${[0, ...C.discounts].map((d) => `<button type="button" data-discount="${d}">${d ? `${d}% off` : 'List price'}</button>`).join('')}</div>
          <div class="pricecustom"><input type="text" id="pricecustom" placeholder="12% or $1,200" autocomplete="off" inputmode="decimal"><button type="button" id="priceapply">Apply</button></div>
          <p class="muted" id="priceresult" role="status"></p></div>`;
        break;
      case 'hours':
        lab = `<label>${esc(label(f))}${req}${help}</label>`;
        ctl = `<div class="hours" data-f="${f.id}" data-kind="hours">${hoursInner(normHours(v), editable)}</div>`;
        break;
      case 'choice':
        lab = `<label for="${id}">${esc(label(f))}${req}${help}</label>`;
        ctl = `<select id="${id}" data-f="${f.id}"${dis}><option value=""></option>${f.options.map((x) => { const val = x.value ?? x; return `<option value="${esc(val)}"${v === val ? ' selected' : ''}>${esc((!admin && x.you) || val)}</option>`; }).join('')}</select>`;
        break;
      case 'list': case 'pages':
        lab = `<label for="${id}">${esc(label(f))}${req}${help}${f.type === 'pages' ? '<span class="help count" id="pagecount"></span>' : ''}</label>`;
        ctl = `<textarea id="${id}" data-f="${f.id}" data-list="1"${dis}>${esc((v || []).join('\n'))}</textarea>`;
        break;
      case 'textarea':
        lab = `<label for="${id}">${esc(label(f))}${req}${help}</label>`;
        ctl = `<textarea id="${id}" data-f="${f.id}"${dis}>${esc(v)}</textarea>`;
        break;
      default:
        lab = `<label for="${id}">${esc(label(f))}${req}${help}</label>`;
        ctl = f.type === 'tel'
          ? `<input type="tel" id="${id}" data-f="${f.id}" data-mask="phone" value="${esc(phoneMask(v) || v || '')}" placeholder="(###) ###-####" inputmode="tel" autocomplete="tel"${dis}>`
          : `<input type="${f.type}" id="${id}" data-f="${f.id}" value="${esc(v)}" autocomplete="off"${dis}>`;
    }
    return `<div class="field" data-field="${f.id}">${lab}<div class="ctl">${who}${ctl}</div>${after}</div>`;
  }

  // ---- hours: day boxes with open/close times, 24/7, by appointment, and a copy-to-all ----
  function hoursInner(h, editable) {
    const dis = editable ? '' : ' disabled';
    const sel = (d, which, val) => `<select data-${which}="${d}" aria-label="${which === 'open' ? 'Opens' : 'Closes'}"${dis}${h.days[d] ? '' : ' disabled'}>${TIMES.map((t) => `<option value="${t}"${t === val ? ' selected' : ''}>${clock(t)}</option>`).join('')}</select>`;
    const modeBtn = (m, text) => `<label class="check"><input type="radio" name="hmode-${P.id}" value="${m}"${h.mode === m ? ' checked' : ''}${dis}> ${text}</label>`;
    return `<div class="hmode">${modeBtn('set', 'Set hours')}${modeBtn('247', 'Open 24/7')}${modeBtn('appointment', 'By appointment')}</div>
      <div class="hdays"${h.mode === 'set' ? '' : ' hidden'}>
        ${DAYS.map(([d, name]) => { const x = h.days[d]; return `<div class="hday"><label class="check"><input type="checkbox" data-day="${d}"${x ? ' checked' : ''}${dis}> ${name}</label>${sel(d, 'open', x?.open || '08:00')}<span class="muted">to</span>${sel(d, 'close', x?.close || '17:00')}</div>`; }).join('')}
        ${editable ? '<button type="button" class="hcopy">Copy the first open day to all open days</button>' : ''}
      </div>
      <input type="text" class="hnote" placeholder="Anything else, like closed on holidays" value="${esc(h.note)}"${dis}>`;
  }
  function hoursValue(el) {
    const mode = el.querySelector('input[type=radio]:checked')?.value || 'set';
    const days = {};
    for (const [d] of DAYS) if (el.querySelector(`[data-day="${d}"]`).checked) days[d] = { open: el.querySelector(`[data-open="${d}"]`).value, close: el.querySelector(`[data-close="${d}"]`).value };
    // Days are kept whatever the mode, so a tap on 24/7 and back doesn't lose them; they only count under "Set hours".
    return { mode, days, note: el.querySelector('.hnote').value };
  }
  // `changed(value, now)` is what a change does: on the form it queues an autosave; the "Make a
  // change" block passes its own, because there the hours are only sent when the client says so.
  function wireHours(el, changed = (value, now) => queue(el.dataset.f, value, now)) {
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.day) {
        // A day switched on takes the first open day's times; switched off, its times grey out.
        const first = DAYS.map(([d]) => d).find((d) => d !== t.dataset.day && el.querySelector(`[data-day="${d}"]`).checked);
        for (const w of ['open', 'close']) {
          const s = el.querySelector(`[data-${w}="${t.dataset.day}"]`);
          s.disabled = !t.checked;
          if (t.checked && first) s.value = el.querySelector(`[data-${w}="${first}"]`).value;
        }
      }
      if (t.type === 'radio') el.querySelector('.hdays').hidden = t.value !== 'set';
      changed(hoursValue(el), t.classList.contains('hnote') ? false : true);
    });
    // Delegated, so it survives the picker being redrawn with the other side's hours.
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.hcopy')) return;
      const on = DAYS.map(([d]) => d).filter((d) => el.querySelector(`[data-day="${d}"]`).checked);
      if (!on.length) return;
      for (const d of on.slice(1)) for (const w of ['open', 'close']) el.querySelector(`[data-${w}="${d}"]`).value = el.querySelector(`[data-${w}="${on[0]}"]`).value;
      changed(hoursValue(el), true);
    });
  }

  const valueOf = (el) => (el.dataset.kind === 'hours' ? hoursValue(el) : el.type === 'checkbox' ? el.checked : el.dataset.list ? el.value.split('\n') : el.value);
  const shown = (el, v) => (el.type === 'checkbox' ? !!v : el.dataset.list ? (v || []).join('\n') : v ?? '');
  /** Put the other side's value in a field; true if it changed. */
  function setField(el, v) {
    if (el.dataset.kind === 'hours') {
      const want = normHours(v);
      if (JSON.stringify(hoursValue(el)) === JSON.stringify({ mode: want.mode, days: want.days, note: want.note })) return false;
      el.innerHTML = hoursInner(want, canEdit({ id: el.dataset.f }));
      return true;
    }
    const want = shown(el, v);
    if (el.type === 'checkbox' ? el.checked === want : el.value === want) return false;
    if (el.type === 'checkbox') el.checked = want; else el.value = want;
    return true;
  }

  // ---- render: the whole form; repaint: the parts that change without touching what's typed ----
  function render() {
    fixTab();
    paintTabs();
    ensureDrawer();
    paintQuestions();
    if (gated() && (!tabbed() || !['planning', 'messages'].includes(tab))) return renderAgreement();
    const show = parts();
    msgLoaded = false;
    // A redraw makes fresh, empty cards: everything that skips repainting when nothing changed starts over.
    docsLoaded = false;
    careKey = null;
    qKey = null;
    const notesField = C.sections.flatMap((x) => x.fields).find((f) => f.id === 'notes');
    if (admin) bar.hidden = false; // the client's bar shows only with a build or preview (paintBar)
    const focus = document.activeElement?.closest?.('[data-f]') === document.activeElement ? document.activeElement.dataset.f : null;
    const sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const y = scrollY;
    root.innerHTML = `
      ${o.backHref ? `<p><a class="back" href="${o.backHref}"><span aria-hidden="true">‹</span> All projects</a></p>` : ''}
      <h1 id="title"></h1>
      ${show.intro ? `<p class="muted">${closed() ? 'These are the details your site is built from. To change anything, big or small, send Daniel a message and he’ll take care of it.' : launched() ? 'Keep these up to date: what you change here goes onto your site on its own, usually within a few minutes.' : 'This is the same page Daniel is working from. Anything you type here saves on its own, and he sees it as you go.'}</p>` : ''}
      ${show.status ? '<section class="card" id="status"></section>' : ''}
      ${admin ? `<details class="card qmenu" id="qmenu"${qOpen ? ' open' : ''}><summary><h2>Questions</h2><span class="muted" id="qcount"></span></summary><div id="qbody"></div></details>` : ''}
      ${!admin && tab === 'site' && P.change && !gated() ? '<section class="card"><h2>Change something</h2><p class="muted">New hours, new photos, different wording, a new page: start here, and you’ll see where each one stands.</p><p><button type="button" class="primary" data-make-change>Make a change</button></p></section>' : ''}
      ${show.request && notesField && !P.change ? `<section class="card"><h2>Request a change</h2><p class="muted">New pages, new features, a different layout: anything bigger than your details goes to Daniel, who gets back to you about it.</p>${fieldHtml(notesField)}</section>` : ''}
      ${show.messages && !wide() ? `<section class="card" id="messages"><h2>Messages</h2><p class="muted">${MSG_INTRO}</p><ol class="msgs" id="msglist"><li class="muted">Loading…</li></ol>${composerHtml(true)}</section>` : ''}
      ${show.care && P.care ? '<section class="card" id="care"></section>' : ''}
      ${show.docs ? '<section class="card" id="docs"><h2>Documents</h2><p class="muted">Loading…</p></section>' : ''}
      ${show.scope ? '<section class="card" id="scope" hidden><h2>Past the package</h2><ul class="scope" id="scopelist"></ul></section>' : ''}
      ${admin ? '<section class="card" id="launchcard"></section>' : ''}
      ${show.link ? '<section class="card" id="linkcard"></section>' : ''}
      ${show.requests && (admin || (P.requests || []).length) ? '<section class="card" id="requests"></section>' : ''}
      ${show.assets && (admin || (P.assets || []).length) ? '<section class="card" id="assets"></section>' : ''}
      ${show.files ? '<section class="card" id="files"></section>' : ''}
      ${show.fields ? C.sections.filter(applies).map((s) => { const fs = s.fields.filter(fieldShown(show.fields)); return fs.length ? `<section class="card"><h2>${esc(secTitle(s))}</h2>${fs.map(fieldHtml).join('')}</section>` : ''; }).join('') : ''}
      ${show.activity ? '<section class="card" id="activity"></section>' : ''}`;
    root.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => queue('tier', b.dataset.tier, true)));
    wirePricing();
    wireQuestionsMenu();
    if (!wide()) wireMessages();
    root.querySelectorAll('[data-f]').forEach((el) => {
      if (el.dataset.kind === 'hours') wireHours(el);
      else {
        if (el.dataset.mask === 'phone') {
          let before = el.value;
          el.addEventListener('beforeinput', () => { before = el.value; });
          // Runs before the save listener below, so what's saved is the formatted number.
          el.addEventListener('input', (e) => {
            let next = phoneMask(el.value);
            // Backspacing over ")", " " or "-" would otherwise put it straight back: drop a digit instead.
            if (e.inputType === 'deleteContentBackward' && next === phoneMask(before) && before.length > el.value.length) next = phoneMask(before.replace(/\D/g, '').slice(0, -1));
            el.value = next;
          });
        }
        const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, () => queue(el.dataset.f, valueOf(el), ev === 'change'));
      }
      // focusin/focusout bubble, so a widget made of several inputs (hours) reports as one field.
      el.addEventListener('focusin', () => presence(el.dataset.f));
      el.addEventListener('focusout', () => presence(null));
    });
    if (focus) {
      const el = root.querySelector(`[data-f="${focus}"]`);
      if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(...sel); } catch { /* not a text field */ } }
    }
    scrollTo(0, y);
    lastUploads = ''; lastEvents = '';
    paint();
  }

  // ---- price: a standard discount, or a custom one ("12%") or price ("$1,200") ----
  function wirePricing() {
    const input = root.querySelector('#pricecustom');
    if (!input) return;
    root.querySelectorAll('[data-discount]').forEach((b) => b.addEventListener('click', () => { input.value = ''; queue('pricing', +b.dataset.discount ? { discountPct: +b.dataset.discount } : null, true); }));
    const apply = () => {
      const s = input.value.trim(), out = root.querySelector('#priceresult');
      const pct = s.match(/^(\d+(?:\.\d+)?)\s*%(?:\s*off)?$/i), dollars = s.match(/^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{0,2})?$/);
      if (pct && +pct[1] > 0 && +pct[1] < 100) queue('pricing', { discountPct: +pct[1] }, true);
      else if (dollars && +dollars[1].replace(/,/g, '') >= 1) queue('pricing', { price: +dollars[1].replace(/,/g, '') }, true);
      else { out.textContent = 'Type a discount like 12% or a price like $1,200.'; out.className = 'error'; return; }
      input.value = '';
    };
    root.querySelector('#priceapply').addEventListener('click', apply);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
  }
  function paintPricing() {
    const out = root.querySelector('#priceresult');
    if (!out) return;
    const p = P.answers.pricing, c = P.check, pr = c.pricing;
    root.querySelectorAll('[data-discount]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.discount ? p?.discountPct === +b.dataset.discount : !p)));
    out.className = 'muted';
    out.textContent = !pr ? 'Pick a package first.' : pr.custom ? `${money(pr.price)}, a price you set (list ${money(pr.base)}).` : pr.pct ? `${money(pr.price)}: ${pr.pct}% off ${money(pr.base)}, ${money(pr.base - pr.price)} less.` : `${money(pr.price)}, the list price.`;
  }
  const priceNote = (pr) => (!pr || pr.price === pr.base ? '' : ` <span class="muted">(${pr.custom ? 'special price' : `${pr.pct}% off`}, list ${money(pr.base)})</span>`);

  // ---- the Questions menu (2026-11-17), Daniel's side: the kind of site, then every question this
  // package can ask with a checkbox. Picking a kind starts from its preset; a checkbox makes the list
  // Daniel's own, and "Back to the preset" hands it back. The ones always asked are locked on.
  let qOpen = false;
  let qKey = null;
  const askable = (f) => !f.menu && f.ask !== 'always' && tierOk(f);
  function wireQuestionsMenu() {
    const menu = root.querySelector('#qmenu');
    if (!menu) return;
    menu.addEventListener('toggle', () => { qOpen = menu.open; });
    menu.addEventListener('click', (e) => {
      const k = e.target.closest('[data-kind]');
      if (k) { queue('siteType', k.dataset.kind, false); queue('asked', null, true); }
      if (e.target.closest('#qreset')) queue('asked', null, true);
    });
    menu.addEventListener('change', (e) => {
      const q = e.target.closest('[data-q]');
      if (!q) return;
      const on = new Set(asked().filter((id) => { const f = C.sections.flatMap((s) => s.fields).find((x) => x.id === id); return f && f.ask !== 'always'; }));
      if (q.checked) on.add(q.dataset.q); else on.delete(q.dataset.q);
      queue('asked', [...on], true);
    });
  }
  function paintQuestionsMenu() {
    const body = root.querySelector('#qbody');
    if (!body) return;
    const c = P.check;
    const kindName = (C.siteTypes || []).find((t) => t.id === c.siteType)?.name || c.siteType;
    const secs = C.sections.filter(tierOk).map((s) => ({ s, fs: s.fields.filter(askable) })).filter((x) => x.fs.length);
    const all = secs.flatMap((x) => x.fs);
    const on = all.filter((f) => c.asked.includes(f.id));
    root.querySelector('#qcount').textContent = `${on.length} of ${all.length} · ${kindName}${c.preset ? '' : ' · your own list'}`;
    const key = JSON.stringify([c.siteType, c.asked, c.preset, P.answers.tier, !!P.answers.mockUrl]);
    if (key === qKey) return;
    qKey = key;
    body.innerHTML = `
      <p class="muted">What the client is asked. The kind of site picks a preset; tick or untick anything on top of it. The client only sees what's ticked here.</p>
      <div class="kinds">${(C.siteTypes || []).map((t) => `<button type="button" data-kind="${t.id}" aria-pressed="${t.id === c.siteType}"><b>${esc(t.name)}</b><span>${esc(t.who)}</span></button>`).join('')}</div>
      <p class="qpreset muted">${c.preset ? `Following the ${esc(kindName)} preset.` : `Your own list, started from the ${esc(kindName)} preset.`} ${c.preset ? '' : '<button type="button" id="qreset">Back to the preset</button>'}</p>
      ${secs.map(({ s, fs }) => `<div class="qsec"><h3>${esc(s.title)} <span class="muted">${fs.filter((f) => c.asked.includes(f.id)).length} of ${fs.length}</span></h3><div class="qlist">${fs.map((f) => `<label class="check"><input type="checkbox" data-q="${f.id}"${c.asked.includes(f.id) ? ' checked' : ''}> ${esc(words(f).label || f.label)}${f.when ? ` <span class="muted">(with a ${f.when === 'mockUrl' ? 'mock-up' : f.when})</span>` : ''}</label>`).join('')}</div></div>`).join('')}
      <p class="help">Always asked, so not listed: the package, the name and contact, the email, the pages, and your own notes.</p>`;
  }

  // ---- the care plan on the client's portal (2026-11-03): read and sign, add a card, then billing ----
  let careKey = null;
  // Back from Stripe (?care=…): straight to the Care plan tab.
  const careNote = (() => { const q = new URLSearchParams(location.search).get('care'); if (q) { history.replaceState(null, '', location.pathname + location.hash); if (!admin) tab = 'care'; } return q; })();
  const longDate = (s) => (s ? new Date(s.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
  function paintCare() {
    const box = root.querySelector('#care'), c = P.care;
    if (!box || !c) return;
    const key = [c.status, c.terms?.sha256, c.billing?.hasCard, c.billing?.paidThrough, c.endsAt].join('|');
    if (key === careKey) return;
    careKey = key;
    // Ending or ended (2026-11-04): say when, and that nothing more is charged; the billing button can undo it.
    const ending = c.status !== 'canceled' && c.endsAt;
    const head = `<h2>Your care plan</h2><p><b>${esc(c.planName)}</b> · ${money(c.price)} a month${c.status === 'canceled' ? `. <b>Ended${c.endsAt ? ` ${esc(longDate(c.endsAt))}` : ''}</b>; nothing more is charged.` : ending ? `. <b>Set to end ${esc(longDate(c.endsAt))}</b>; nothing is charged after that. Changed your mind? Press Renew my plan below to keep it.` : `, billed on the 1st${c.firstBill ? `, starting ${esc(longDate(c.firstBill))}` : ''}.`}</p>`;
    if (!c.signed && c.terms) {
      box.innerHTML = `${head}<p class="muted">Nothing is charged before ${esc(longDate(c.firstBill))}. Read it over, then sign below and add a card.</p>
        <div class="agreement">${agreementHtml(c.terms)}</div>
        <label for="carename">Type your full name to sign</label><input type="text" id="carename" autocomplete="name" placeholder="First and last name">
        <label class="check"><input type="checkbox" id="careagree"> I agree to this care plan, and to signing it electronically.</label>
        <p><button type="button" class="primary" id="caresign" disabled>Sign the care plan</button> <span id="carenote" class="muted"></span></p>`;
      const n = box.querySelector('#carename'), a = box.querySelector('#careagree'), b = box.querySelector('#caresign');
      const ready = () => { b.disabled = !(a.checked && /\S+\s+\S+/.test(n.value.trim())); };
      n.addEventListener('input', ready); a.addEventListener('change', ready);
      b.addEventListener('click', async () => {
        b.disabled = true; box.querySelector('#carenote').textContent = 'Signing…';
        try { const r = await api(routes.care, { method: 'POST', body: JSON.stringify({ name: n.value, agreed: a.checked, sha256: c.terms.sha256 }) }); P.care = r.care; paintCare(); }
        catch (e) { box.querySelector('#carenote').textContent = e.message; b.disabled = false; }
      });
      return;
    }
    const hasCard = c.billing?.hasCard;
    const lines = [];
    if (c.signed) lines.push(`<p class="muted">Signed by ${esc(c.signed.name)} on ${esc(new Date(c.signed.at).toLocaleDateString())}.</p>`);
    if (careNote === 'done') lines.push(`<p><b>Thanks, your card is set up.</b>${hasCard ? '' : ' It can take a minute to show here.'}</p>`);
    if (c.status === 'past_due') lines.push('<p class="error">The last payment didn’t go through. Stripe will try again; you can update your card here.</p>');
    if (!hasCard) lines.push(`<p>Last step: add a card or bank account for the monthly bill. Stripe, the payment company, keeps it; nothing is charged before ${esc(longDate(c.firstBill))}.</p><p><button type="button" class="primary" id="carecard">Add a card</button> <span id="carenote" class="muted"></span></p>`);
    else lines.push(`<p>${c.endsAt || c.status === 'canceled' ? '' : c.billing.paidThrough ? `You’re paid up; the next charge is ${esc(longDate(c.billing.paidThrough))}. ` : `Your card is on file; the first charge is ${esc(longDate(c.firstBill))}. `}</p><p><button type="button" id="carebilling">${c.status === 'canceled' ? 'See past invoices' : ending ? 'Renew my plan' : 'Change card, see invoices or cancel'}</button> <span id="carenote" class="muted"></span></p>`);
    box.innerHTML = head + lines.join('');
    // Back from Stripe: bring the card into view once.
    if (careNote && !box.dataset.shown) { box.dataset.shown = '1'; setTimeout(() => box.scrollIntoView({ block: 'start' }), 0); }
    const go = (id, path) => { const el = box.querySelector(id); if (el) el.addEventListener('click', async () => { el.disabled = true; try { const r = await api(path, { method: 'POST', body: '{}' }); location.href = r.url; } catch (e) { box.querySelector('#carenote').textContent = e.message; el.disabled = false; } }); };
    go('#carecard', routes.care + '/checkout');
    go('#carebilling', routes.care + '/billing');
  }

  // After launch the button opens the client's own domain (2026-11-04).
  const liveUrl = () => (launched() && P.answers.domain ? 'https://' + String(P.answers.domain).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null);

  // ---- Documents: everything they've signed, word for word, any time (2026-11-04) ----
  let docsLoaded = false;
  async function paintDocs() {
    const box = root.querySelector('#docs');
    if (!box || docsLoaded) return;
    docsLoaded = true;
    const copy = async (path, title) => {
      try {
        const d = await api(path);
        return `<details><summary><b>${esc(title)}</b> <span class="muted">signed by ${esc(d.name || d.signer_name)}, ${esc(new Date(d.signedAt || d.signed_at).toLocaleDateString())}</span></summary><pre class="signed">${esc(d.text)}\n\nSigned electronically by ${esc(d.name || d.signer_name)} on ${esc(new Date(d.signedAt || d.signed_at).toLocaleString())}.\nFingerprint (SHA-256): ${esc(d.sha256)}</pre><p><button type="button" class="printdoc">Print or save as PDF</button></p></details>`;
      } catch { return ''; }
    };
    const parts = [await copy(routes.agreement + '?signed=1', 'Website contract'), P.care?.signed ? await copy(routes.care + '?signed=1', `${P.care.planName} care plan`) : ''].filter(Boolean);
    box.innerHTML = `<h2>Documents</h2>${parts.length ? parts.join('') : '<p class="muted">Nothing signed yet.</p>'}`;
    box.querySelectorAll('.printdoc').forEach((b) => b.addEventListener('click', () => {
      const w = open('', '_blank');
      if (!w) return;
      w.document.write(`<!doctype html><title>${esc(P.answers.businessName || 'Document')}</title><pre style="white-space:pre-wrap;font:14px/1.5 system-ui">${b.closest('details').querySelector('pre').innerHTML}</pre>`);
      w.document.close(); w.focus(); w.print();
    }));
  }

  // ---- messages (2026-11-04) ----
  let msgLoaded = false, msgLoading = false;
  // The conversation as last drawn, and the request statuses it was drawn with: when a status
  // changes (the project refreshes every couple of seconds) the cards in the thread are redrawn.
  let shownMessages = null;
  let shownRequestStates = '';
  const MSG_INTRO = 'Write to Daniel any time, about anything. Daniel gets your message right away and answers here, and you’ll get an email when there’s a reply.';
  const composerHtml = (fixed) => `<div class="composer${fixed ? ' fixed' : ''}" id="composer"><div class="in"><label for="msgbody" class="sr">Message</label>${admin ? '' : '<p class="change-row"><button type="button" data-make-change>Make a change</button> <span class="muted">Hours, photos, wording, a new page…</span></p>'}<div class="composer-row"><textarea id="msgbody" maxlength="4000" rows="1" placeholder="Message Daniel" aria-describedby="msghint"></textarea><button type="button" class="primary" id="msgsend">Send</button></div><span id="msghint" class="help">Enter sends · Shift+Enter for a new line</span> <span id="msgnote" class="muted" role="status"></span></div></div>`;
  // The drawer (wide screens): made once and kept across tab switches, so a half-typed message stays.
  let drawer = null;
  const drawerOpen = () => document.body.classList.contains('drawer-open');
  function setDrawer(open) {
    document.body.classList.toggle('drawer-open', open);
    try { sessionStorage.setItem('drawer', open ? '1' : ''); } catch {}
    const fab = document.getElementById('msgfab');
    if (fab) {
      fab.setAttribute('aria-expanded', String(open));
      fab.textContent = open ? 'Hide messages' : P?.unreadMessages ? `Messages (${P.unreadMessages})` : 'Messages';
    }
    if (open) { msgLoaded = false; paintMessages(); setTimeout(() => document.getElementById('msgbody')?.focus(), 50); }
    placeComposer();
  }
  // The drawer's width is theirs to set (2026-11-20): drag anywhere on its left edge, or focus the
  // edge and use the arrow keys. It's kept between 320 px and 60% of the window, and remembered in
  // this browser. The width lives in one CSS variable, so the page behind makes the same room.
  const DRAWER_MIN = 320;
  const drawerMax = () => Math.max(DRAWER_MIN, Math.round(innerWidth * 0.6));
  function setDrawerWidth(width, { remember = true } = {}) {
    const clamped = Math.min(drawerMax(), Math.max(DRAWER_MIN, Math.round(width)));
    document.documentElement.style.setProperty('--drawer-width', `${clamped}px`);
    document.querySelector('.drawer-resize')?.setAttribute('aria-valuenow', String(clamped));
    if (remember) { try { localStorage.setItem('drawerWidth', String(clamped)); } catch { /* storage blocked: it lasts until the page is left */ } }
    return clamped;
  }
  function wireDrawerResize(drawerEl) {
    const handle = document.createElement('div');
    handle.className = 'drawer-resize';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize messages');
    handle.setAttribute('aria-valuemin', String(DRAWER_MIN));
    handle.setAttribute('aria-valuemax', String(drawerMax()));
    drawerEl.prepend(handle);

    let saved = NaN;
    try { saved = Number(localStorage.getItem('drawerWidth')); } catch { /* no saved width */ }
    setDrawerWidth(saved >= DRAWER_MIN ? saved : 400, { remember: false });

    // The drawer is pinned to the right, so its width is the distance from the pointer to that edge.
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('drawer-resizing');
      const follow = (move) => setDrawerWidth(innerWidth - move.clientX, { remember: false });
      const finish = (end) => {
        handle.removeEventListener('pointermove', follow);
        document.body.classList.remove('drawer-resizing');
        setDrawerWidth(innerWidth - end.clientX);
      };
      handle.addEventListener('pointermove', follow);
      handle.addEventListener('pointerup', finish, { once: true });
      handle.addEventListener('pointercancel', finish, { once: true });
    });
    handle.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const now = drawerEl.getBoundingClientRect().width;
      setDrawerWidth(now + (event.key === 'ArrowLeft' ? 24 : -24));
    });
    // A smaller window can't keep a drawer wider than its share of it.
    addEventListener('resize', () => {
      handle.setAttribute('aria-valuemax', String(drawerMax()));
      setDrawerWidth(drawerEl.getBoundingClientRect().width, { remember: false });
    });
  }

  function ensureDrawer() {
    if (admin) return;
    if (!wide()) {
      if (drawer) { drawer.remove(); drawer = null; document.getElementById('msgfab')?.remove(); document.body.classList.remove('drawer-open'); }
      return;
    }
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'drawer';
      drawer.className = 'drawer';
      drawer.setAttribute('aria-label', 'Messages');
      drawer.innerHTML = `<div class="drawer-head"><h2>Messages</h2><button type="button" id="drawerclose" aria-label="Close messages">×</button></div><p class="muted drawer-intro">${MSG_INTRO}</p><div class="drawer-thread"><ol class="msgs" id="msglist"><li class="muted">Loading…</li></ol></div>${composerHtml(false)}`;
      document.body.appendChild(drawer);
      const fab = document.createElement('button');
      fab.type = 'button'; fab.id = 'msgfab'; fab.className = 'msgfab'; fab.setAttribute('aria-controls', 'drawer');
      fab.addEventListener('click', () => setDrawer(!drawerOpen()));
      document.body.appendChild(fab);
      drawer.querySelector('#drawerclose').addEventListener('click', () => setDrawer(false));
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawerOpen()) setDrawer(false); });
      wireMessages(drawer);
      wireDrawerResize(drawer);
      let was = false; try { was = sessionStorage.getItem('drawer') === '1'; } catch {}
      setDrawer(was);
    }
    const fab = document.getElementById('msgfab');
    // The same button closes the drawer, and says so while it's open.
    const label = drawerOpen() ? 'Hide messages' : P.unreadMessages ? `Messages (${P.unreadMessages})` : 'Messages';
    if (fab.textContent !== label) fab.textContent = label;
    fab.classList.toggle('unread', !!P.unreadMessages);
  }
  /** Open Messages wherever it lives: the drawer on a wide screen, the tab on a phone. */
  function openMessages() { if (wide()) setDrawer(true); else setTab('messages'); }
  async function paintMessages() {
    const list = document.getElementById('msglist');
    // Opening the conversation marks Daniel's messages read, so only when it's actually showing, and
    // only while this window has the client's attention: from a window left open it just peeks, so
    // the unread mark stays until they're back.
    if (drawer && !drawerOpen()) return;
    if (!list || msgLoading || (msgLoaded && !P.unreadMessages)) return;
    msgLoading = true;
    const peek = !document.hasFocus();
    try {
      const d = await api(routes.messages + (peek ? '?peek=1' : ''));
      msgLoaded = true;
      showMessages(d.messages);
      if (!peek) P.unreadMessages = 0;
      if (!admin) { paintTabs(); ensureDrawer(); }
    } catch (e) { list.innerHTML = `<li class="error">${esc(/no such table/.test(e.message) ? 'Messages are being switched on.' : e.message)}</li>`; }
    msgLoading = false;
  }
  function showMessages(ms) {
    const list = document.getElementById('msglist');
    if (!list) return;
    // What scrolls: the drawer's thread, Daniel's boxed list, or (the phone tab) the page itself.
    const box = list.closest('.drawer-thread') || (admin ? list : null);
    const atEnd = !list.dataset.shown || (box ? box.scrollHeight - box.scrollTop - box.clientHeight < 40 : innerHeight + scrollY >= document.documentElement.scrollHeight - 80);
    const mine = admin ? 'daniel' : 'client';
    list.innerHTML = ms.length ? ms.map((m) => `<li class="msg ${m.sender === mine ? 'mine' : 'theirs'}"><div class="meta"><b>${m.sender === mine ? 'You' : esc(m.sender === 'daniel' ? 'Daniel' : m.name || 'Client')}</b> <span class="muted">${esc(ago(m.at))}</span>${m.sender === mine && m.read_at ? ' <span class="muted">· read</span>' : ''}</div><div class="body">${esc(m.body)}</div>${m.request ? requestCardHtml(currentRequest(m.request)) : ''}</li>`).join('') : `<li class="muted">No messages yet.${admin ? '' : ' Say hello!'}</li>`;
    shownMessages = ms;
    shownRequestStates = requestStates();
    wireRequestButtons(list);
    // Like any chat: open on the latest message, and follow new ones if you were already at the end.
    list.dataset.shown = '1';
    if (atEnd) requestAnimationFrame(() => { if (box) box.scrollTop = box.scrollHeight; else scrollTo(0, document.documentElement.scrollHeight); });
  }
  // The message box floats at the bottom of the screen, just above whatever else is pinned there (the
  // tabs, the build bar), and rides up with a phone's keyboard (2026-11-04). Android resizes the page
  // for the keyboard (interactive-widget in the viewport tag); iOS doesn't, so the gap comes from
  // visualViewport. While typing on a phone, the tabs and bar step aside to leave room.
  function placeComposer() {
    const c = document.getElementById('composer');
    if (!c || !c.classList.contains('fixed')) return;
    // (offsetParent is always null for position: fixed, so look at display instead.)
    const h = (el) => (el && !el.hidden && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect().height : 0);
    const vv = window.visualViewport;
    const kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    c.style.bottom = `${h(document.getElementById('tabs')) + h(bar) + kb}px`;
  }
  if (!window.__composerWired) {
    window.__composerWired = true;
    window.visualViewport?.addEventListener('resize', () => placeComposer());
    window.visualViewport?.addEventListener('scroll', () => placeComposer());
    addEventListener('resize', () => placeComposer());
  }
  function wireMessages(scope = root) {
    const btn = scope.querySelector('#msgsend');
    if (!btn) return;
    const body = scope.querySelector('#msgbody'), note = scope.querySelector('#msgnote');
    const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight, 160) + 'px'; };
    body.addEventListener('input', grow);
    // Enter sends, Shift+Enter is a new line; never mid-composition (an IME's Enter picks a word).
    // Enter sends on a keyboard; on a touch screen it's a new line and Send sends, as in any messaging app.
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !matchMedia('(hover: none) and (pointer: coarse)').matches) { e.preventDefault(); btn.click(); } });
    body.addEventListener('focus', () => { document.body.classList.add('composing'); requestAnimationFrame(placeComposer); });
    body.addEventListener('blur', () => { document.body.classList.remove('composing'); requestAnimationFrame(placeComposer); });
    // Tapping Send mustn't blur the box first: on a phone that would drop the keyboard and move the button.
    btn.addEventListener('pointerdown', (e) => { if (document.activeElement === body) e.preventDefault(); });
    btn.addEventListener('click', async () => {
      if (!body.value.trim()) { note.textContent = 'Write a message first.'; return; }
      btn.disabled = true; note.className = 'muted'; note.textContent = 'Sending…';
      try {
        const text = body.value;
        const d = await api(routes.messages, { method: 'POST', body: JSON.stringify({ body: text }) });
        // Clear only what was sent: anything typed while it was sending stays.
        body.value = body.value.startsWith(text) ? body.value.slice(text.length).replace(/^\n/, '') : body.value; grow(); showMessages(d.messages);
        note.textContent = admin ? (d.emailed ? 'Sent. They got an email about it.' : 'Sent. No email went out (no address, or email is off).') : 'Sent. Daniel will answer here.';
      } catch (e) { note.className = 'error'; note.textContent = e.message; }
      btn.disabled = false;
    });
  }

  // The line under the page (2026-11-04): Messages first, then email; gone on the Messages tab itself.
  function paintQuestions() {
    const q = document.getElementById('questions');
    if (!q || admin) return;
    q.hidden = !wide() && tab === 'messages';
    const html = `Questions? Talk to Daniel <a href="#" data-open-messages>${wide() ? 'in Messages' : 'on the Messages tab'}</a> or email <a href="mailto:support@steadfastcode.tech">support@steadfastcode.tech</a>.`;
    if (q.dataset.html !== html) { q.innerHTML = html; q.dataset.html = html; q.querySelector('[data-open-messages]').addEventListener('click', (e) => { e.preventDefault(); openMessages(); }); }
  }

  function paint() {
    paintPricing();
    if (admin) { paintQuestionsMenu(); ensureContractPane(); paintContract(); }
    ensureDrawer();
    paintQuestions();
    paintMessages();
    placeComposer();
    if (!admin) paintTabs();
    paintCare();
    const a = P.answers, c = P.check, t = c.tier;
    root.querySelector('#title').textContent = a.businessName || (admin ? 'New project' : 'Your website');
    paintDocs();
    const statusEl = root.querySelector('#status');
    if (statusEl) statusEl.innerHTML = `
      <div><b>${esc(statusLabel[P.status] || P.status)}</b>${t ? ` · ${esc(t.name)} · ${money(c.price, t.from)}${priceNote(c.pricing)}` : ' · no package yet'}</div>
      ${P.buildNote && !building() ? `<p class="${P.failed ? 'error' : 'muted'}" style="white-space:pre-line">${esc(admin || !P.failed ? P.buildNote : 'The last build didn’t finish. Daniel can see what happened and will start it again.')}</p>` : ''}
      ${P.previewUrl ? `<p><a class="btn" href="${esc(liveUrl() || P.previewUrl)}" target="_blank" rel="noopener">${liveUrl() ? 'Open your site' : 'Open the preview'}</a>${admin && P.status === 'preview' ? ' <button type="button" id="fullrebuild">Full rebuild</button>' : ''}</p>` : ''}
      ${a.mockUrl && !P.previewUrl ? `<p><a class="btn" href="${esc(a.mockUrl)}" target="_blank" rel="noopener">Open the mock-up</a> <span class="muted">${admin ? 'The first build starts from it.' : 'Your new site starts from this mock-up. Say what to change under Look and feel.'}</span></p>` : ''}
      ${c.missing.length ? `<p class="muted">Needed to start a first version: ${c.missing.map((m) => esc(label(C.sections.flatMap((x) => x.fields).find((f) => f.id === m.id) ?? m))).join(', ')}.</p>` : ''}
      ${agreementLine()}
      ${admin ? `<p><button type="button" id="opencontract" aria-controls="cpane" aria-expanded="${cpaneOpen()}">${cpaneOpen() ? 'Hide the contract' : 'Show the contract'}</button></p>` : ''}
      ${admin ? `<p class="muted">Messages${P.unreadMessages ? `: <b>${P.unreadMessages} unread</b>` : ''} · <a href="/admin/inbox#p/${esc(P.id)}">Open in Inbox</a></p>` : ''}
      ${admin && P.previewUrl ? `<p class="muted">${P.care?.exists ? `Care plan: ${esc(P.care.planName)}, ${money(P.care.price)} a month · ${esc({ draft: 'draft', offered: 'offered, not signed', signed: 'signed, no card yet', active: 'active', past_due: 'payment past due', canceled: 'canceled' }[P.care.status] || P.care.status)}. ` : 'No care plan yet. '}<a href="/admin/care#p/${esc(P.id)}">Care plans</a></p>` : ''}
      ${updateLines()}`;
    const rv = root.querySelector('#markreviewed');
    if (rv) rv.onclick = async () => { rv.disabled = true; try { await api(routes.review, { method: 'POST', body: '{}' }); await refresh(); } catch (e) { alert(e.message); rv.disabled = false; } };
    const fr = root.querySelector('#fullrebuild');
    if (fr) fr.onclick = async () => {
      if (!confirm('Rebuild the whole site from the brief? It takes longer and uses more than an update; use it when an update isn’t enough.')) return;
      fr.disabled = true;
      try { await flush(); await api(routes.build, { method: 'POST', body: JSON.stringify({ full: true }) }); await refresh(); } catch (e) { alert(e.message); fr.disabled = false; }
    };
    const oc = root.querySelector('#opencontract');
    if (oc) oc.onclick = () => { setCpane(!cpaneOpen()); };
    const so = root.querySelector('#signingopen');
    if (so) so.onchange = async () => { so.disabled = true; try { await api(routes.signing, { method: 'POST', body: JSON.stringify({ open: so.checked }) }); await refresh(); } catch (e) { alert(e.message); so.checked = !so.checked; } so.disabled = false; };
    const view = root.querySelector('[data-signed]');
    if (view) view.onclick = async (e) => {
      e.preventDefault();
      const box = root.querySelector('#signedcopy');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      try { const a = await api(routes.agreement + '?signed=1'); box.innerHTML = `<pre class="signed">${esc(a.text)}\n\nSigned electronically by ${esc(a.signer_name || a.name)} on ${esc(new Date(a.signed_at || a.signedAt).toLocaleString())}.\nFingerprint (SHA-256): ${esc(a.sha256)}</pre>`; } catch (err) { box.textContent = err.message; }
    };
    const sc = root.querySelector('#scope');
    if (sc) { sc.hidden = !c.scope.length; root.querySelector('#scopelist').innerHTML = c.scope.map((s) => `<li>${esc(s)}</li>`).join(''); }
    const pc = root.querySelector('#pagecount');
    if (pc && t) { const n = (a.pages || []).length; pc.textContent = `${n} of ${t.scope.pages} in ${t.name}`; pc.classList.toggle('over', n > t.scope.pages); }
    // Who's in which field on the other side.
    root.querySelectorAll('.who').forEach((w) => { w.hidden = true; });
    for (const x of P.others || []) {
      if (!x.field) continue;
      const w = root.querySelector(`.who[data-who="${x.field}"]`);
      if (w) { w.hidden = false; w.textContent = `${x.name || (x.who === 'daniel' ? 'Daniel' : 'Your client')} is editing`; }
    }
    if (admin) paintLaunch();
    if (admin) paintLink();
    paintRequests();
    paintAssets();
    paintFiles();
    paintActivity();
    paintProgress();
    paintBar();
  }

  // ---- the agreement: on the client's page it comes first, until it's signed ----
  const agreementHtml = (a) => a.sections.map((x) => `<h3>${esc(x.h)}</h3>${x.p.map((t) => `<p>${esc(t)}</p>`).join('')}`).join('');

  function setTab(t) {
    if (tab === t) return;
    tab = t;
    docsLoaded = false;
    try { sessionStorage.setItem('clientTab', t); } catch {}
    scrollTo(0, 0);
    render();
  }

  function paintTabs() {
    let nav = document.getElementById('tabs');
    if (!tabbed()) { if (nav) nav.remove(); document.body.classList.remove('has-tabs'); return; }
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'tabs';
      nav.className = 'tabs';
      nav.setAttribute('aria-label', 'Your project');
      nav.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) setTab(b.dataset.t); });
      document.body.appendChild(nav);
    }
    const ts = clientTabs(), html = ts.map(([id, name]) => `<button type="button" data-t="${id}">${esc(name)}</button>`).join('');
    if (nav.dataset.tabs !== html) { nav.innerHTML = html; nav.dataset.tabs = html; nav.style.gridTemplateColumns = `repeat(${ts.length}, 1fr)`; nav.classList.toggle('many', ts.length > 4); }
    document.body.classList.add('has-tabs');
    nav.querySelectorAll('[data-t]').forEach((b) => { const on = b.dataset.t === tab; b.setAttribute('aria-current', on ? 'page' : 'false'); b.classList.toggle('on', on); });
  }

  function renderAgreement() {
    const ag = P.agreement;
    progress.hidden = true;
    bar.hidden = true;
    if (ag.reason === 'no-package' || !ag.current) {
      root.innerHTML = `<h1>Your website</h1><section class="card"><p>Daniel is setting up your project. This page updates on its own as soon as it's ready for you.</p></section>`;
      return;
    }
    root.innerHTML = `
      <h1>Before we start</h1>
      <section class="card" id="contractnote">
        ${ag.reason === 'changed' ? '<p class="error">Your package changed since you signed, so here is the updated contract.</p>' : ''}
        <p class="muted">This is the contract for your website: what's included, the price, and how changes and launch work. You can read it here and start planning in the Planning tab any time; building starts once it's signed.</p>
      </section>
      <section class="card agreement"><h2>${esc(ag.current.title)}</h2>${agreementHtml(ag.current)}</section>
      ${ag.signingOpen ? '' : `<section class="card" id="reviewonly"><h2>Sign at our meeting</h2><p>We’ll sign this together at our meeting. Feel free to read it over and bring any questions.</p><p>If you have info you’d like to start filling in now, tap the <a href="#" data-tab="planning">Planning</a> tab at the bottom of the screen to get a head start!</p></section>`}
      <section class="card" id="signbox"${ag.signingOpen ? '' : ' hidden'}>
        <h2>Sign</h2>
        <label for="signname">Your full name</label>
        <input type="text" id="signname" autocomplete="name" placeholder="First and last name">
        <label class="check"><input type="checkbox" id="signagree"> I agree to this contract, and to signing it electronically.</label>
        <label class="check"><input type="checkbox" id="signportfolio"> It's OK to show my finished site on Steadfast Code's Work page.</label><span class="help">Optional, and separate from the contract.</span>
        <p><button type="button" class="primary" id="signbtn" disabled>Sign and continue</button> <span id="signnote" class="muted"></span></p>
      </section>`;
    root.querySelectorAll('[data-tab]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setTab(a.dataset.tab); }));
    // In the whole-page layout the note and the signature box both stay in view beside the
    // contract. The box sits under the note, so the stylesheet needs to know how tall the note is.
    const contractNote = root.querySelector('#contractnote');
    const tellNoteHeight = () => root.style.setProperty('--contract-note-height', `${contractNote.offsetHeight}px`);
    tellNoteHeight();
    if (window.ResizeObserver) new ResizeObserver(tellNoteHeight).observe(contractNote);
    const name = root.querySelector('#signname'), agree = root.querySelector('#signagree'), btn = root.querySelector('#signbtn'), note = root.querySelector('#signnote');
    const ready = () => { btn.disabled = !(agree.checked && /\S+\s+\S+/.test(name.value.trim())); };
    name.addEventListener('input', ready);
    agree.addEventListener('change', ready);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      note.textContent = 'Signing…';
      try {
        const r = await api(routes.agreement, { method: 'POST', body: JSON.stringify({ name: name.value, agreed: agree.checked, sha256: ag.current.sha256, portfolio: root.querySelector('#signportfolio').checked }) });
        note.textContent = r.mailedTo?.length ? 'Signed. A copy is on its way to your email.' : 'Signed.';
        await refresh();
      } catch (e) {
        note.innerHTML = `<span class="error">${esc(e.message)}</span>`;
        ready();
        if (/changed while you were reading/.test(e.message)) await refresh();
      }
    });
  }

  // Automatic updates (2026-11-02): the client's small changes update the preview on their own;
  // bigger ones, and anything past the day's updates, wait for Daniel.
  function updateLines() {
    const flagged = P.reviewNeeded || [];
    if (admin) {
      if (!flagged.length) return '';
      return `<div class="review"><b>Needs your review</b><ul>${flagged.map((x) => `<li>${esc(x.what)} <span class="muted">${esc(ago(x.at))}</span></li>`).join('')}</ul><button type="button" id="markreviewed">Mark reviewed</button></div>`;
    }
    if (!P.previewUrl) return '';
    const lines = [];
    if (building()) lines.push('Your preview is updating with your latest changes.');
    else if (P.pendingChanges) lines.push('Your changes will show in your preview a few minutes after you stop.');
    else lines.push('Changes you make here go into your preview on their own, a few minutes after you stop.');
    if (P.askedDaniel) lines.push('Some of what you asked for is a bigger change, so Daniel will look at it himself.');
    return lines.map((l) => `<p class="muted">${esc(l)}</p>`).join('');
  }

  function agreementLine() {
    const ag = P.agreement;
    if (!ag) return '';
    if (ag.signed?.valid) return `<p class="muted">Contract signed by ${esc(ag.signed.name)}, ${esc(new Date(ag.signed.signedAt).toLocaleString())}${ag.signed.portfolioOk === 1 ? ' · OK to show on the Work page' : ag.signed.portfolioOk === 0 ? ' · not on the Work page' : ''}. <a href="#" data-signed>View the signed copy</a></p><div id="signedcopy"></div>`;
    if (!admin) return '';
    if (ag.reason === 'no-package') return '<p class="muted">Contract: picks up the package once it’s set.</p>';
    const toggle = `<label class="check"><input type="checkbox" id="signingopen"${ag.signingOpen ? ' checked' : ''}> Let them sign now</label><span class="help">${ag.signingOpen ? 'Turn off to let them read it ahead of the meeting without signing.' : 'Review only: they can read it, and sign once you turn this on.'}</span>`;
    return `<p class="${ag.reason === 'changed' ? 'error' : 'muted'}">${ag.reason === 'changed' ? 'The contract changed since it was signed; the client will be asked to sign the updated one.' : 'Contract not signed yet. It shows first on the client’s link; the build waits for it.'}</p>${toggle}`;
  }

  // ---- the Contract pane (2026-11-17), Daniel's side: the whole contract as a column on the right
  // (always there on a wide screen; slid in over a button on anything narrower), every section and
  // line with a checkbox, lines and sections added from the library or written new (a new one joins
  // the library for next time). Saved as answers.contract; the client's contract follows.
  let cpane = null;
  let cKey = null;
  const cpaneOpen = () => document.body.classList.contains('cpane-open');
  // Shown or hidden at every width (Daniel, 2026-11-17): hidden, the form is the one centered column
  // again. The Getting started card's button toggles it; on a wide screen it starts shown.
  function setCpane(open, repaint = true) {
    document.body.classList.toggle('cpane-open', open);
    try { sessionStorage.setItem('cpane', open ? '1' : '0'); } catch {}
    document.getElementById('cfab')?.setAttribute('aria-expanded', String(open));
    if (open) { cKey = null; paintContract(); }
    if (repaint && P) paint();
    // Opening narrows the form, which can make the bar wrap taller: measure again once laid out.
    requestAnimationFrame(() => cpane?.dock?.());
  }
  function ensureContractPane() {
    if (!admin || cpane) return;
    cpane = document.createElement('aside');
    cpane.id = 'cpane';
    cpane.className = 'cpane';
    cpane.setAttribute('aria-label', 'Contract');
    cpane.innerHTML = `<div class="drawer-head"><h2>Contract</h2><button type="button" id="cpaneclose" aria-label="Close the contract">×</button></div><div class="cbody" id="cbody"><p class="muted">Loading…</p></div>`;
    // The form and the card share a two-column grid on a wide screen (form.css .cols); the wrapper
    // is undone in stop(), so the next project starts from the page as it was.
    const cols = document.createElement('div');
    cols.className = 'cols';
    root.parentNode.insertBefore(cols, root);
    cols.appendChild(root);
    cols.appendChild(cpane);
    document.body.classList.add('has-cpane');
    // No floating button: on a phone it sat over Start build (Daniel, 2026-11-17). The Getting started
    // card's Show/Hide button opens and closes the card at every width; × closes it too.
    cpane.querySelector('#cpaneclose').addEventListener('click', () => setCpane(false));
    // The card's top sits 16px under the header while the page is at the top, and 16px from the
    // viewport once the header has scrolled away, so it lines up with the first card beside it.
    const head = document.querySelector('.admin-head');
    // …and its bottom clears the build bar, however tall the bar is at this width (none on a phone).
    const dock = () => {
      cpane.style.setProperty('--cpane-top', `${Math.max(16, (head ? head.getBoundingClientRect().bottom : 0) + 16)}px`);
      const barH = bar.hidden || getComputedStyle(bar).display === 'none' ? 0 : bar.getBoundingClientRect().height;
      cpane.style.setProperty('--cpane-bottom', `${Math.round(barH) + 16}px`);
    };
    dock();
    addEventListener('scroll', dock, { passive: true });
    addEventListener('resize', dock);
    cpane.dock = dock;
    cpane.undock = () => { removeEventListener('scroll', dock); removeEventListener('resize', dock); };
    wireContract(cpane.querySelector('#cbody'));
    let was = null; try { was = sessionStorage.getItem('cpane'); } catch {}
    setCpane(was === null || was === '' ? matchMedia('(min-width: 1240px)').matches : was === '1', false);
  }
  const contract = () => ({ off: [], add: {}, sections: [], edit: {}, ...(P.answers.contract || {}) });
  function saveContract(c) {
    const next = { off: [...new Set(c.off)], add: Object.fromEntries(Object.entries(c.add).filter(([, v]) => v.length)), sections: c.sections, edit: Object.fromEntries(Object.entries(c.edit).filter(([, v]) => v)) };
    const empty = !next.off.length && !Object.keys(next.add).length && !next.sections.length && !Object.keys(next.edit).length;
    queue('contract', empty ? null : next, true);
  }
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const unbullet = (s) => s.replace(/^• /, '');
  // Rewording a line or heading (2026-11-17): the ✎ beside it swaps the text for a small editor; Save
  // keeps the new wording on this project (the standard wording stays a click away), Esc cancels.
  function openEditor(btn) {
    const row = btn.closest('.cline, .csech');
    if (!row || row.querySelector('.cform')) return;
    const { edit: key, text, edited, heading, lib } = btn.dataset;
    row.dataset.editing = '1';
    // Every line can be saved to this project alone, or to the library too (Daniel, 2026-11-17): a
    // library line or section is reworded there, for every project that uses it; a standard line's
    // wording lives in the code, so its rewording becomes a new library line under this section, a
    // chip on every later contract. A standard section's heading has one Save: nothing to reuse.
    const to = lib || (heading ? '' : 'new');
    const saves = to ? `<button type="submit" data-to="project">Save to project</button><button type="submit" data-to="library" data-lib="${esc(to)}">Save to library</button>` : '<button type="submit">Save</button>';
    row.insertAdjacentHTML('beforeend', `<form class="cform" data-editkey="${esc(key)}"${heading ? ' data-heading="1"' : ''}><textarea rows="${heading ? 1 : 3}" maxlength="${heading ? 80 : 600}" aria-label="Wording">${esc(text)}</textarea>${heading || !(C.placeholders || []).length ? '' : `<span class="help">Placeholders fill in per project: ${C.placeholders.map((x) => '{' + x + '}').join(' ')}</span>`}<div class="cformbtns">${saves}<button type="button" data-cancel>Cancel</button>${edited ? `<button type="button" data-reset>${lib ? 'Library wording' : 'Standard wording'}</button>` : ''}</div></form>`);
    const ta = row.querySelector('textarea');
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cKey = null; paintContract(); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); } });
  }
  function wireContract(body) {
    body.addEventListener('change', (e) => {
      const t = e.target, c = contract();
      if (t.dataset.cs) {
        // An added section unticked leaves the contract; a standard one is switched off.
        if (c.sections.includes(t.dataset.cs)) c.sections = c.sections.filter((x) => x !== t.dataset.cs);
        else c.off = t.checked ? c.off.filter((x) => x !== t.dataset.cs) : [...c.off, t.dataset.cs];
        saveContract(c);
      }
      if (t.dataset.cl) {
        const sec = t.dataset.sec;
        if ((c.add[sec] || []).includes(t.dataset.cl)) c.add[sec] = c.add[sec].filter((x) => x !== t.dataset.cl);
        else c.off = t.checked ? c.off.filter((x) => x !== t.dataset.cl) : [...c.off, t.dataset.cl];
        saveContract(c);
      }
    });
    body.addEventListener('click', async (e) => {
      const add = e.target.closest('[data-addline]'), sec = e.target.closest('[data-addsec]'), forget = e.target.closest('[data-forget]');
      const more = e.target.closest('[data-more]'), edit = e.target.closest('[data-edit]'), cancel = e.target.closest('[data-cancel]'), reset = e.target.closest('[data-reset]');
      const c = contract();
      if (more) { const panel = more.nextElementSibling; panel.hidden = !panel.hidden; more.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) panel.querySelector('input')?.focus(); }
      if (edit) openEditor(edit);
      if (cancel) { cKey = null; paintContract(); }
      if (reset) { delete c.edit[reset.closest('form').dataset.editkey]; saveContract(c); }
      if (add) { c.add[add.dataset.sec] = [...(c.add[add.dataset.sec] || []), add.dataset.addline]; saveContract(c); }
      if (sec) { c.sections = [...c.sections, sec.dataset.addsec]; saveContract(c); }
      if (forget) {
        const isSec = forget.dataset.kind === 'section';
        if (!confirm(isSec ? 'Forget this section and its lines? Projects using them lose them.' : 'Forget this line? Projects using it lose it.')) return;
        try { await api(routes.library, { method: 'DELETE', body: JSON.stringify(isSec ? { sectionId: forget.dataset.forget } : { lineId: forget.dataset.forget }) }); cKey = null; await refresh(); } catch (err) { alert(err.message); }
      }
    });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target, c = contract();
      if (form.dataset.editkey) {
        // Rewording: the same words as the standard line mean no edit at all.
        const text = form.querySelector('textarea').value.replace(/\s+/g, ' ').trim();
        const base = unbullet(form.closest('.cline, .csech').querySelector('[data-edit]').dataset.base);
        if (e.submitter?.dataset.to === 'library') {
          if (!text) return;
          const key = form.dataset.editkey, lib = e.submitter.dataset.lib;
          e.submitter.disabled = true;
          try {
            if (lib === 'new') {
              // A standard line: the rewording stays on this project, and the library gets it as a new line here.
              const sec = form.closest('.cline').querySelector('[data-sec]').dataset.sec;
              await api(routes.library, { method: 'POST', body: JSON.stringify({ sectionId: sec, text }) });
              if (text === base) delete c.edit[key]; else c.edit[key] = text;
            } else {
              // A library line or section: its own wording changes, and this project's edit of it is dropped so it shows.
              await api(routes.library, { method: 'PATCH', body: JSON.stringify(lib === 'section' ? { sectionId: key, heading: text } : { lineId: key, text }) });
              delete c.edit[key];
            }
          } catch (err) { alert(err.message); e.submitter.disabled = false; return; }
          delete form.closest('.cline, .csech').dataset.editing;
          form.remove();
          saveContract(c);
          await flush();
          cKey = null;
          await refresh();
          return;
        }
        if (!text || text === base) delete c.edit[form.dataset.editkey]; else c.edit[form.dataset.editkey] = text;
        // The editor closes on Save whatever the server says back (a save that changes nothing redraws nothing).
        delete form.closest('.cline, .csech').dataset.editing;
        form.remove();
        saveContract(c);
        return;
      }
      const input = form.querySelector('input'), text = input.value.trim();
      if (!text) return;
      form.querySelector('button').disabled = true;
      try {
        if (form.dataset.newline) {
          const r = await api(routes.library, { method: 'POST', body: JSON.stringify({ sectionId: form.dataset.newline, text }) });
          if (!(c.add[form.dataset.newline] || []).includes(r.line.id)) c.add[form.dataset.newline] = [...(c.add[form.dataset.newline] || []), r.line.id];
        } else {
          const r = await api(routes.library, { method: 'POST', body: JSON.stringify({ heading: text }) });
          c.sections = [...c.sections, r.section.id];
        }
        input.value = '';
        saveContract(c);
        await flush();
      } catch (err) { alert(err.message); }
      form.querySelector('button').disabled = false;
    });
  }
  function paintContract() {
    const body = cpane?.querySelector('#cbody');
    if (!body) return;
    const ag = P.agreement;
    const fab = document.getElementById('cfab');
    if (fab) fab.classList.toggle('attention', !!ag?.needed && ag.reason === 'changed');
    const key = JSON.stringify([ag?.catalog, ag?.library, ag?.signed, ag?.reason, P.answers.contract]);
    if (key === cKey) return;
    cKey = key;
    if (!ag?.catalog) { body.innerHTML = '<p class="muted">Pick a package and the contract appears here.</p>'; return; }
    const lib = ag.library || { sections: [], lines: [] };
    const c = contract();
    const inContract = new Set(ag.catalog.flatMap((s) => s.p.map((l) => l.key)));
    // A filled placeholder is marked, so a glance shows which wording the project fills in.
    const marked = (x) => (x.parts ? x.parts.map((p) => (p.ph ? `<mark class="ph" title="{${esc(p.ph)}}">${esc(p.t)}</mark>` : esc(p.t))).join('') : esc(x.text));
    const pencil = (key, text, base, edited, heading, lib) => `<button type="button" class="cedit" data-edit="${esc(key)}" data-text="${esc(unbullet(text))}" data-base="${esc(unbullet(base ?? text))}"${edited ? ' data-edited="1"' : ''}${heading ? ' data-heading="1"' : ''}${lib ? ` data-lib="${lib}"` : ''} aria-label="Reword this ${heading ? 'heading' : 'line'}">✎</button>`;
    const chip = (l) => `<span class="chip"><button type="button" data-addline="${esc(l.id)}" data-sec="${esc(l.section_id)}" title="${esc(l.text)}">+ ${esc(trunc(l.text, 70))}</button><button type="button" class="forget" data-forget="${esc(l.id)}" data-kind="line" aria-label="Forget this line">×</button></span>`;
    const line = (s, l) => `<div class="cline${l.on ? '' : ' off'}"><label class="check"><input type="checkbox" data-cl="${esc(l.key)}" data-sec="${esc(s.key)}"${l.on ? ' checked' : ''}${l.locked ? ' disabled' : ''}> <span class="ctext">${marked(l)}${l.added ? ' <span class="muted">(yours)</span>' : ''}${l.edited ? ' <span class="muted">(reworded)</span>' : ''}${l.fixed ? ` <span class="muted drift" title="The library wording dropped ${esc(l.fixed.map((x) => '{' + x + '}').join(', '))}, so the website no longer feeds it; put the placeholder back to keep them in step.">(no longer follows ${esc(l.fixed.map((x) => '{' + x + '}').join(', '))} from the site)</span>` : ''}</span></label>${pencil(l.key, l.raw ?? l.text, l.base ?? l.text, l.edited, false, l.lib ? 'line' : '')}</div>`;
    const section = (s) => {
      const spare = lib.lines.filter((l) => l.section_id === s.key && !inContract.has(l.id));
      return `<div class="csec${s.on ? '' : ' off'}">
        <div class="csech"><label class="check"><input type="checkbox" data-cs="${esc(s.key)}"${s.on ? ' checked' : ''}${s.locked ? ' disabled' : ''}> <b>${marked({ text: s.h, parts: s.parts })}</b>${s.locked ? ' <span class="muted">(always)</span>' : ''}${s.edited ? ' <span class="muted">(reworded)</span>' : ''}</label>${pencil(s.key, s.raw ?? s.h, s.base ?? s.h, s.edited, true, s.added ? 'section' : '')}${s.added ? `<button type="button" class="forget" data-forget="${esc(s.key)}" data-kind="section" aria-label="Forget this section">×</button>` : ''}</div>
        <div class="clines">${s.p.map((l) => line(s, l)).join('')}</div>
        ${lib.missing ? '' : `<button type="button" class="cmore" data-more aria-expanded="false">+ Line</button><div class="cpanel" hidden>${spare.length ? `<div class="chips">${spare.map(chip).join('')}</div>` : ''}<form class="cadd" data-newline="${esc(s.key)}"><input type="text" placeholder="A new line for this section" maxlength="600" aria-label="New line for ${esc(s.h)}"><button type="submit">Add</button></form></div>`}
      </div>`;
    };
    const spareSections = lib.sections.filter((s) => !s.builtin && !c.sections.includes(s.id));
    body.innerHTML = `
      <p class="muted">${ag.signed?.valid ? `Signed by ${esc(ag.signed.name)}, ${esc(new Date(ag.signed.signedAt).toLocaleDateString())}. A change here asks them to sign again.` : ag.reason === 'changed' ? 'Changed since it was signed: the client is asked to sign this version.' : 'Not signed yet. Untick what doesn’t apply, reword or add what does; the client sees the result on their link.'}</p>
      ${lib.missing ? '<p class="error">The contract library isn’t switched on yet (migration 0016), so lines can’t be added here.</p>' : ''}
      ${ag.catalog.map(section).join('')}
      ${lib.missing ? '' : `<div class="csec"><button type="button" class="cmore" data-more aria-expanded="false">+ Section</button><div class="cpanel" hidden>${spareSections.length ? `<div class="chips">${spareSections.map((s) => `<span class="chip"><button type="button" data-addsec="${esc(s.id)}">+ ${esc(s.heading)}</button><button type="button" class="forget" data-forget="${esc(s.id)}" data-kind="section" aria-label="Forget this section">×</button></span>`).join('')}</div>` : ''}<form class="cadd" id="newsec"><input type="text" placeholder="A new section’s heading" maxlength="80" aria-label="New section heading"><button type="submit">Add section</button></form></div></div>`}
      <details class="cpreview"><summary>Read it as they will</summary><div class="agreement">${agreementHtml(ag.current)}</div></details>`;
  }

  function paintBar() {
    const c = P.check;
    if (admin) {
      readyEl.textContent = c.ready ? (c.scope.length ? `Ready · ${c.scope.length} scope note${c.scope.length === 1 ? '' : 's'}` : 'Ready') : `${c.missing.length} to go`;
      buildBtn.hidden = false;
      buildBtn.disabled = !(c.ready && ['intake', 'preview'].includes(P.status) && !P.agreement?.needed);
      if (c.ready && P.agreement?.needed) readyEl.textContent = 'Ready · waiting on the signed contract';
      buildBtn.textContent = P.status === 'preview' ? 'Rebuild' : building() ? 'Building…' : P.failed ? 'Restart build' : 'Start build';
    } else {
      // No button and no bar for the client: their changes update the preview on their own (updateLines).
      buildBtn.hidden = true;
      bar.hidden = true;
    }
  }

  function paintProgress() {
    let html = '';
    // Only while a build runs (2026-11-04): a finished preview has its button on the status card (Your
    // site), and a link inside this clickable strip was a control inside a control.
    if (building()) {
      const step = P.status === 'build-requested' ? 0 : Math.min(P.buildStep || 1, LAST);
      const steps = `<div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="${LAST}" aria-valuenow="${step}" aria-label="Build progress">${STEPS.map((_, i) => `<span class="${i + 1 < step || step === LAST ? 'done' : i + 1 === step ? 'now' : ''}"></span>`).join('')}</div>`;
      const details = building()
        ? `<div class="muted">${step === 0 ? 'Waiting for the build to start' : `Step ${step} of ${LAST}: ${STEPS[step - 1]}`}${P.buildStartedAt ? ` · <span id="elapsed">${since(P.buildStartedAt)}</span>` : ''}</div>${P.buildNote ? `<div class="muted">${esc(P.buildNote)}</div>` : ''}${P.buildActivity ? `<div class="activity">${esc(P.buildActivity)}</div>` : ''}`
        : '';
      html = `${steps}<div class="in"><div class="details">${details}</div></div>`;
    }
    progress.hidden = !html;
    if (html) progress.innerHTML = html;
  }

  function paintLink() {
    const el = root.querySelector('#linkcard');
    const l = P.clientLink;
    // Only redraw when the link itself changes, so a copy in progress isn't wiped by the 2 s refresh.
    const to = String(P.answers.email ?? '').trim();
    const key = JSON.stringify([l, madeUrl, P.linkKeySet, to, P.intakeClosedAt]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const url = l?.url || (l && madeUrl) || null;
    el.innerHTML = `<h2>Client link</h2>
      ${l ? `<p class="muted">On · made ${esc(ago(l.createdAt))} · ${l.lastUsedAt ? `last opened ${esc(ago(l.lastUsedAt))}` : 'not opened yet'} · works until ${esc(new Date(l.expiresAt).toLocaleDateString())}</p>` : '<p class="muted">No link yet. A link lets them see and fill in this same page, upload photos, and watch the build.</p>'}
      ${url ? `<input type="text" readonly value="${esc(url)}" id="linkurl" aria-label="Client link"><p><button type="button" id="copylink">Copy</button> ${navigator.share ? '<button type="button" id="sharelink">Share…</button>' : ''}</p>` : l ? `<p class="muted">${P.linkKeySet ? 'This link was made before links could be shown again.' : 'Links can only be shown right after they’re made until the LINK_KEY secret is set on the site.'} Make a new one to copy it (the old one stops working).</p>` : ''}
      ${url && !l?.url ? '<p class="help">Copy it now: without the LINK_KEY secret it won’t be shown again after you leave this page.</p>' : ''}
      <p><button type="button" id="makelink">${l ? 'Make a new link' : 'Make a link'}</button> ${l ? '<button type="button" id="killlink">Turn it off</button>' : ''}</p>
      <p>${to ? `<button type="button" id="emaillink">Email it to ${esc(to)}</button>` : '<span class="muted">Add their email under their details to send the link from here.</span>'} <span class="muted" id="emailsaid" role="status"></span></p>
      <h3>Intake</h3>
      <p class="muted">${P.intakeClosed
        ? `Closed ${esc(ago(P.intakeClosedAt))}. They see their details read-only, and changes come to you as messages.`
        : 'Open. They can edit their answers on their page. Close it after the first meeting, and changes come to you as messages instead.'}</p>
      <p><button type="button" id="intaketoggle">${P.intakeClosed ? 'Reopen the intake' : 'Close the intake'}</button></p>`;
    el.querySelector('#intaketoggle').onclick = async () => {
      try {
        apply(await api(routes.project, { method: 'PATCH', body: JSON.stringify({ intakeClosed: !P.intakeClosed }) }));
      } catch (e) { alert(e.message); }
    };
    el.querySelector('#makelink').onclick = async () => {
      if (l && !confirm('Make a new link? The current one stops working.')) return;
      try { madeUrl = (await api(routes.link, { method: 'POST', body: '{}' })).url; await refresh(); } catch (e) { alert(e.message); }
    };
    const kill = el.querySelector('#killlink');
    if (kill) kill.onclick = async () => { if (!confirm('Turn the client link off? Their page stops working until you make a new one.')) return; madeUrl = null; await api(routes.link, { method: 'DELETE' }); await refresh(); };
    const mail = el.querySelector('#emaillink');
    if (mail) mail.onclick = async () => {
      if (!confirm(`Email the client link to ${to}?${l?.url ? '' : ' A new link is made for it; any older one keeps working.'}`)) return;
      mail.disabled = true;
      try {
        await api(routes.link + '/email', { method: 'POST', body: '{}' });
        if (!l?.url) await refresh(); // a new link was made, so the card redraws: say it on the new one
        el.querySelector('#emailsaid').textContent = `Sent ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      }
      catch (e) { alert(e.message); }
      finally { mail.disabled = false; }
    };
    const copy = el.querySelector('#copylink');
    if (copy) copy.onclick = async () => {
      try { await navigator.clipboard.writeText(url); } catch { const f = el.querySelector('#linkurl'); f.select(); document.execCommand('copy'); }
      copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 2000);
    };
    const share = el.querySelector('#sharelink');
    if (share) share.onclick = () => navigator.share({ title: 'Your website', text: 'Here’s the page for your new website.', url }).catch(() => {});
  }

  // ---- launch (2026-11-20, server/launch.js) ----
  // One button on Daniel's page. Launching marks the project live; the box then lets search engines
  // in, marks the repo launched and deploys, usually within a couple of minutes, and says so in the
  // activity list. Taking it back does the reverse.
  let launchSaid = ''; // what the last press answered, shown under the buttons

  function paintLaunch() {
    const el = root.querySelector('#launchcard');
    if (!el) return;
    const launched = !!P.launchedAt || P.status === 'live';
    const key = JSON.stringify([launched, P.launchedAt, P.domain, P.previewUrl, P.status, launchSaid]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;

    const address = P.domain ? `<a href="https://${esc(P.domain)}" target="_blank" rel="noopener">${esc(P.domain)}</a>` : 'its domain';
    if (launched) {
      el.innerHTML = `<h2>Launch</h2>
        <p class="muted">Launched${P.launchedAt ? ` ${esc(ago(P.launchedAt))}` : ''}, live at ${address}. The box lets search engines in and deploys within a couple of minutes of launching; Activity says when it’s done.</p>
        <p><button type="button" id="unlaunch">Take it back to preview</button></p>
        <p class="muted" role="status">${esc(launchSaid)}</p>`;
    } else {
      const blockers = [
        P.previewUrl ? null : 'Build a first version.',
        P.domain ? null : 'Add the domain under their details.',
        building() ? 'Wait for the build to finish.' : null,
      ].filter(Boolean);
      el.innerHTML = `<h2>Launch</h2>
        <p class="muted">Launching marks the project live and takes the site out of preview mode: search engines are let in, and the client’s page switches to its after-launch view. The domain has to be pointing at the site already; that part is DNS and is done by hand.</p>
        ${blockers.length ? `<p class="muted">Before it can launch: ${blockers.map(esc).join(' ')}</p>` : ''}
        <p><button type="button" class="primary" id="launch"${blockers.length ? ' disabled' : ''}>Launch the site</button></p>
        <p class="muted" role="status">${esc(launchSaid)}</p>`;
    }

    const send = async (body) => {
      const response = await fetch(routes.launch, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { ok: response.ok, body: await response.json().catch(() => ({})) };
    };
    const finish = (answer, done) => {
      if (answer.ok) { launchSaid = done; apply(answer.body); } else { launchSaid = answer.body.error || 'That didn’t work.'; paintLaunch(); }
    };

    const launch = el.querySelector('#launch');
    if (launch) launch.onclick = async () => {
      if (!confirm(`Launch ${P.domain}? Search engines will be let in.`)) return;
      launch.disabled = true;
      let answer = await send({ launch: true });
      // The domain didn't answer: Daniel may know it's on its way.
      if (!answer.ok && answer.body.canForce && confirm(`${answer.body.error}\n\nLaunch anyway?`)) answer = await send({ launch: true, force: true });
      finish(answer, 'Launched. The box is taking the site out of preview mode now.');
    };
    const unlaunch = el.querySelector('#unlaunch');
    if (unlaunch) unlaunch.onclick = async () => {
      if (!confirm('Take the site back to preview? Search engines are shut out again. The care plan’s launch day stays as it is.')) return;
      unlaunch.disabled = true;
      finish(await send({ launch: false }), 'Back to preview. The box is putting the search-engine block back on.');
    };
  }

  // ---- the whole-page layout is a masonry (2026-11-20) ----
  // In "Use the whole page" the cards sit in a grid whose rows are 2px tall (form.css). This gives
  // each card as many rows as its height needs, and the grid's dense flow then puts every card in
  // the first gap it fits, which is the shortest column. So the page fills evenly whatever the
  // cards' heights, and the order of the cards gives way to that (Daniel: order doesn't matter).
  // It runs again whenever a card changes size, the cards are redrawn, the window is resized or
  // the layout is switched. The contract tab has its own two-part layout and is left alone.
  const MASONRY_ROW = 2;
  let masonryQueued = false;

  function layoutMasonry() {
    masonryQueued = false;
    const wide = matchMedia('(min-width: 1000px)').matches;
    const on = wide && document.body.classList.contains('layout-grid') && !root.querySelector(':scope > .card.agreement');
    root.classList.toggle('masonry', on);
    for (const child of root.children) {
      const shown = on && !child.hidden && getComputedStyle(child).display !== 'none';
      if (!shown) { child.style.gridRowEnd = ''; continue; }
      // A grid item's margins are part of its place, so they count toward its rows.
      const style = getComputedStyle(child);
      const height = child.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      const rows = `span ${Math.max(1, Math.ceil(height / MASONRY_ROW))}`;
      if (child.style.gridRowEnd !== rows) child.style.gridRowEnd = rows;
    }
  }
  /** Lays the cards out once before the next paint, however many things asked for it. */
  function queueMasonry() {
    if (masonryQueued) return;
    masonryQueued = true;
    requestAnimationFrame(layoutMasonry);
  }
  if (window.ResizeObserver && !root.dataset.masonryWired) {
    root.dataset.masonryWired = '1';
    const sizes = new ResizeObserver(queueMasonry);
    const watchCards = () => { for (const child of root.children) sizes.observe(child); queueMasonry(); };
    new MutationObserver(watchCards).observe(root, { childList: true });
    new MutationObserver(queueMasonry).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', queueMasonry);
    watchCards();
  }

  // ---- the client's page tools (2026-11-20) ----
  // A slim row above the title, on every tab (the contract too), with two switches:
  //   the theme: Auto (the device's setting) → Light → Dark, saved in this browser under the same
  //     key steadfastcode.tech uses, and applied before paint by the script in the page's <head>;
  //   the layout: one readable column, or the cards across the whole page. Only on a wide screen;
  //     a phone has one column either way.
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  const stored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const store = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage blocked: it lasts until the page is left */ } };
  const currentTheme = () => (THEMES.includes(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'auto');
  const gridLayout = () => stored('clientLayout') === 'grid';

  function mountPageTools() {
    if (admin || document.getElementById('pagetools')) return;
    const tools = document.createElement('div');
    tools.id = 'pagetools';
    tools.className = 'page-tools';
    tools.innerHTML = '<button type="button" id="layouttoggle"></button><button type="button" id="themetoggle" aria-live="polite"></button>';
    root.before(tools);
    const layout = tools.querySelector('#layouttoggle');
    const theme = tools.querySelector('#themetoggle');

    const showLayout = () => {
      const grid = gridLayout();
      document.body.classList.toggle('layout-grid', grid);
      layout.setAttribute('aria-pressed', String(grid));
      layout.textContent = grid ? 'Single column' : 'Use the whole page';
    };
    const showTheme = () => { theme.textContent = `Theme: ${THEME_LABEL[currentTheme()]}`; };

    layout.onclick = () => { store('clientLayout', gridLayout() ? 'column' : 'grid'); showLayout(); };
    theme.onclick = () => {
      const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
      if (next === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
      store('theme', next === 'auto' ? null : next);
      showTheme();
    };
    showLayout();
    showTheme();
  }
  mountPageTools();

  // ---- "Make a change" (2026-11-20, server/changes.js) ----
  // The client's way to change anything about their site: a button above the message box (and on
  // Your site) opens this block. They pick one of a few kinds of change, or type what they're
  // after and the search finds it: "hours" opens the same hours picker the intake used, "Darby"
  // finds that part of their site. A fact (hours, phone, email) is saved and goes onto the site on
  // its own. Anything else is sent in their words and becomes a request with a card in the
  // conversation. Before sending, the block says how the change travels and whether it's covered.

  /** Words people use for each thing, so the search doesn't need our labels. */
  const CHANGE_SYNONYMS = {
    hours: 'open opening close closing closed time times schedule days weekend holiday',
    phone: 'number call telephone cell mobile text',
    email: 'mail e-mail contact address',
    photos: 'photo picture pictures image images gallery logo swap replace',
    reword: 'text wording words typo spelling copy description sentence paragraph say says',
    section: 'new block area part add',
    page: 'new add another',
    broken: 'bug error wrong problem not working doesn’t work issue fix',
    other: 'different else question idea',
  };

  let changeDialog = null; // the <dialog>, made the first time it's opened
  let changeView = { name: 'home' }; // home | facts | fact | describe | sent
  let changeQuery = '';

  /**
   * How many slips separate two short words, for typos like "huors": a wrong, missing or extra
   * letter is one slip, and so is two neighbouring letters swapped.
   */
  function editDistance(a, b) {
    const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
    for (let i = 1; i <= a.length; i++) {
      rows[i] = [i];
      for (let j = 1; j <= b.length; j++) {
        const same = a[i - 1] === b[j - 1];
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (same ? 0 : 1));
        const swapped = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
        if (swapped) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
    return rows[a.length][b.length];
  }

  /** Whether one typed word matches one word of an entry: a prefix, a piece of it, or a near miss. */
  function wordMatches(typed, word) {
    if (word.startsWith(typed)) return true;
    if (typed.length >= 3 && word.includes(typed)) return true;
    return typed.length >= 4 && editDistance(typed, word.slice(0, typed.length + 1)) <= 1;
  }

  /** Everything the search can find: each kind of change, each fact, and each named part of the site. */
  function changeEntries() {
    const fact = (id) => C.sections.flatMap((section) => section.fields).find((f) => f.id === id);
    const kinds = P.change.kinds.filter((kind) => kind.id !== 'details').map((kind) => ({
      label: kind.name, hint: kind.hint, words: CHANGE_SYNONYMS[kind.id] || '', open: { name: 'describe', kind: kind.id },
    }));
    const facts = P.change.instantFields.filter(fact).map((id) => ({
      label: label(fact(id)), hint: 'Change it yourself; it goes onto your site in a few minutes', words: CHANGE_SYNONYMS[id] || '', open: { name: 'fact', field: id },
    }));
    const parts = P.change.parts.map((part) => ({
      label: part.label, hint: 'Reword this part of your site', words: '', open: { name: 'describe', kind: 'reword', part: part.key },
    }));
    return [...facts, ...parts, ...kinds];
  }

  /** The entries matching what was typed, best first: every typed word must match, the label counts double. */
  function searchChanges(query) {
    const typed = query.toLowerCase().split(/[^a-z0-9’']+/).filter(Boolean);
    if (!typed.length) return [];
    const scored = [];
    for (const entry of changeEntries()) {
      const labelWords = entry.label.toLowerCase().split(/[^a-z0-9’']+/).filter(Boolean);
      const otherWords = entry.words.toLowerCase().split(/\s+/).filter(Boolean);
      let score = 0;
      const all = typed.every((word) => {
        if (labelWords.some((w) => wordMatches(word, w))) { score += 2; return true; }
        if (otherWords.some((w) => wordMatches(word, w))) { score += 1; return true; }
        return false;
      });
      if (all) scored.push({ entry, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((found) => found.entry);
  }

  const changeKind = (id) => P.change.kinds.find((kind) => kind.id === id);
  /** The two lines under every form: how this change travels, and what it costs. */
  const changeFinePrint = (kind) => `<p class="change-says">${esc(kind.says)}</p><p class="change-cost">${esc(kind.coverage)}</p>`;
  const changeEntryButton = (entry, index) => `<li><button type="button" class="change-pick" data-change-entry="${index}"><strong>${esc(entry.label)}</strong><span class="muted">${esc(entry.hint)}</span></button></li>`;

  function changeHomeHtml() {
    const found = changeQuery.trim() ? searchChanges(changeQuery) : null;
    const kinds = P.change.kinds.map((kind) => ({ label: kind.name, hint: kind.hint, open: kind.id === 'details' ? { name: 'facts' } : { name: 'describe', kind: kind.id } }));
    const list = found ?? kinds;
    changeDialog.entries = list;
    return `<label for="changesearch" class="change-label">What would you like to change?</label>
      <input type="search" id="changesearch" placeholder="Type it (“hours”, “photos”…) or pick below" value="${esc(changeQuery)}" autocomplete="off">
      ${list.length ? `<ul class="change-list">${list.map(changeEntryButton).join('')}</ul>` : `<p class="muted">Nothing matches that. <button type="button" class="linklike" data-change-other>Tell Daniel in your own words</button>.</p>`}`;
  }

  function changeFactsHtml() {
    const fact = (id) => C.sections.flatMap((section) => section.fields).find((f) => f.id === id);
    const list = P.change.instantFields.filter(fact).map((id) => ({ label: label(fact(id)), hint: 'Change it yourself', open: { name: 'fact', field: id } }));
    changeDialog.entries = list;
    return `<p class="change-label">Which one?</p><ul class="change-list">${list.map(changeEntryButton).join('')}</ul>
      <p class="muted">Something else about your business, like your address or where you work? <button type="button" class="linklike" data-change-other>Tell Daniel in your own words</button>.</p>`;
  }

  /** One fact, with the editor the intake used for it. */
  function changeFactHtml(fieldId) {
    const field = C.sections.flatMap((section) => section.fields).find((f) => f.id === fieldId);
    const value = P.answers[fieldId];
    const editor = field.type === 'hours'
      ? `<div class="hours" id="changevalue" data-kind="hours">${hoursInner(normHours(value), true)}</div>`
      : `<input type="${field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}" id="changevalue" value="${esc(value || '')}" autocomplete="off">`;
    return `<p class="change-label">${field.type === 'hours' ? esc(label(field)) : `<label for="changevalue">${esc(label(field))}</label>`}</p>
      ${editor}
      ${changeFinePrint(changeKind('details'))}
      <p class="change-actions"><button type="button" class="primary" data-change-send>Save and update my site</button> <span class="muted" id="changesaid" role="status"></span></p>`;
  }

  /** Anything that isn't a fact: their words, the part it's about when it's a rewording, photos when it's photos. */
  function changeDescribeHtml(view) {
    const kind = changeKind(view.kind);
    const prompts = {
      photos: 'Which photos, and where should they go? If you’re replacing or removing some, say which.',
      reword: 'What should it say instead?',
      section: 'What should the new section be about, and which page does it go on?',
      page: 'What’s the page for, and what should be on it?',
      broken: 'What’s wrong, and where did you see it? The page and what you were doing help a lot.',
      other: 'What would you like?',
    };
    const partPicker = view.kind === 'reword' && P.change.parts.length
      ? `<label for="changepart" class="change-label">Which part of your site?</label>
        <select id="changepart"><option value="">I’ll describe it</option>${P.change.parts.map((part) => `<option value="${esc(part.key)}"${part.key === view.part ? ' selected' : ''}>${esc(part.label)}</option>`).join('')}</select>`
      : '';
    const photoPicker = view.kind === 'photos' && P.uploadsReady
      ? `<p class="upl"><label class="btn">Add photos<input type="file" id="changephotos" accept="image/*" multiple hidden></label> <span class="muted" id="changephotosaid" role="status"></span></p>`
      : '';
    return `<h3 class="change-kind">${esc(kind.name)}</h3>
      ${partPicker}
      ${photoPicker}
      <label for="changebody" class="change-label">${esc(prompts[view.kind])}</label>
      <textarea id="changebody" maxlength="4000" rows="5"></textarea>
      ${changeFinePrint(kind)}
      <p class="change-actions"><button type="button" class="primary" data-change-send>${view.kind === 'broken' ? 'Tell Daniel' : 'Send'}</button> <span class="muted" id="changesaid" role="status"></span></p>`;
  }

  function changeSentHtml(view) {
    return `<h3 class="change-kind">${view.instant ? 'Saved' : 'Sent'}</h3>
      <p>${esc(view.says)}</p>
      <p class="muted">You’ll find it in your messages and under Your requests, with where it stands.</p>
      <p class="change-actions"><button type="button" class="primary" data-change-close>Done</button> <button type="button" data-change-home>Change something else</button></p>`;
  }

  function paintChange() {
    const view = changeView;
    const body = { home: changeHomeHtml, facts: changeFactsHtml, fact: () => changeFactHtml(view.field), describe: () => changeDescribeHtml(view), sent: () => changeSentHtml(view) }[view.name]();
    // The form element keeps the hours picker's radio buttons apart from the ones on the page behind.
    changeDialog.innerHTML = `<form method="dialog" class="change-in" id="changeform">
      <div class="change-head">${view.name === 'home' || view.name === 'sent' ? '<h2>Make a change</h2>' : '<button type="button" class="change-back" data-change-home>‹ Back</button>'}<button type="button" data-change-close aria-label="Close">×</button></div>
      ${body}
    </form>`;
    wireChange();
  }

  function wireChange() {
    const dialog = changeDialog;
    const goTo = (next) => { changeView = next; paintChange(); dialog.querySelector('input, textarea, select, .change-pick')?.focus(); };
    dialog.querySelectorAll('[data-change-close]').forEach((button) => { button.onclick = () => dialog.close(); });
    dialog.querySelectorAll('[data-change-home]').forEach((button) => { button.onclick = () => { changeQuery = ''; goTo({ name: 'home' }); }; });
    dialog.querySelectorAll('[data-change-other]').forEach((button) => { button.onclick = () => goTo({ name: 'describe', kind: 'other' }); });
    dialog.querySelectorAll('[data-change-entry]').forEach((button) => { button.onclick = () => goTo(dialog.entries[Number(button.dataset.changeEntry)].open); });

    const search = dialog.querySelector('#changesearch');
    if (search) {
      search.oninput = () => {
        changeQuery = search.value;
        // Only the list is redrawn, so the box keeps its focus and its cursor.
        const found = changeQuery.trim() ? searchChanges(changeQuery) : null;
        const kinds = P.change.kinds.map((kind) => ({ label: kind.name, hint: kind.hint, open: kind.id === 'details' ? { name: 'facts' } : { name: 'describe', kind: kind.id } }));
        const list = found ?? kinds;
        dialog.entries = list;
        const old = dialog.querySelector('.change-list') || dialog.querySelector('#changeform > p.muted');
        const fresh = document.createElement('div');
        fresh.innerHTML = list.length ? `<ul class="change-list">${list.map(changeEntryButton).join('')}</ul>` : '<p class="muted">Nothing matches that. <button type="button" class="linklike" data-change-other>Tell Daniel in your own words</button>.</p>';
        old.replaceWith(fresh.firstElementChild);
        dialog.querySelectorAll('[data-change-entry]').forEach((button) => { button.onclick = () => goTo(dialog.entries[Number(button.dataset.changeEntry)].open); });
        dialog.querySelectorAll('[data-change-other]').forEach((button) => { button.onclick = () => goTo({ name: 'describe', kind: 'other' }); });
      };
      // Enter in the search box opens the first match instead of closing the dialog.
      search.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (dialog.entries?.length) goTo(dialog.entries[0].open);
      };
    }

    const hours = dialog.querySelector('#changevalue[data-kind="hours"]');
    if (hours) wireHours(hours, () => {});

    // Photos for a photo request go up as they're picked; the request then says how many came with it.
    const photos = dialog.querySelector('#changephotos');
    if (photos) photos.onchange = async () => {
      const said = dialog.querySelector('#changephotosaid');
      const files = [...photos.files];
      let done = 0;
      for (const file of files) {
        said.textContent = `Uploading ${done + 1} of ${files.length}…`;
        const form = new FormData();
        form.set('file', file);
        form.set('kind', 'photo');
        try { await api(routes.uploads, { method: 'POST', body: form }); done++; } catch (e) { said.textContent = `${file.name}: ${e.message}`; return; }
      }
      changeView.photosAdded = (changeView.photosAdded || 0) + done;
      said.textContent = `${changeView.photosAdded} added. They’re under Photos and logo now.`;
    };

    const send = dialog.querySelector('[data-change-send]');
    if (send) send.onclick = async () => {
      const said = dialog.querySelector('#changesaid');
      const view = changeView;
      let body;
      if (view.name === 'fact') {
        const box = dialog.querySelector('#changevalue');
        body = { kind: 'details', field: view.field, value: box.dataset.kind === 'hours' ? hoursValue(box) : box.value };
      } else {
        const words = dialog.querySelector('#changebody').value;
        const added = view.photosAdded ? `\n\n(${view.photosAdded} new ${view.photosAdded === 1 ? 'photo' : 'photos'} added with this.)` : '';
        body = { kind: view.kind, body: words.trim() ? words + added : words, part: dialog.querySelector('#changepart')?.value || undefined };
      }
      send.disabled = true;
      try {
        const answer = await api(routes.requests, { method: 'POST', body: JSON.stringify(body) });
        P.requests = answer.requests;
        if (view.name === 'fact') P.answers[view.field] = body.value;
        showMessages(answer.messages);
        paintRequests();
        const kind = changeKind(view.name === 'fact' ? 'details' : view.kind);
        changeView = { name: 'sent', says: kind.says, instant: view.name === 'fact' };
        paintChange();
        dialog.querySelector('[data-change-close]')?.focus();
      } catch (e) {
        said.textContent = e.message;
        send.disabled = false;
      }
    };
  }

  function openChange() {
    if (admin || !P.change) return;
    if (!changeDialog) {
      changeDialog = document.createElement('dialog');
      changeDialog.className = 'change';
      changeDialog.setAttribute('aria-label', 'Make a change');
      document.body.appendChild(changeDialog);
      // A click on the dimmed page behind closes it, like any sheet.
      changeDialog.addEventListener('click', (event) => { if (event.target === changeDialog) changeDialog.close(); });
    }
    changeView = { name: 'home' };
    changeQuery = '';
    paintChange();
    changeDialog.showModal();
    changeDialog.querySelector('#changesearch')?.focus();
  }
  // The button is drawn in several places (above the message box, on Your site), so one listener
  // on the page finds whichever was pressed.
  if (!admin && !window.__makeChangeWired) {
    window.__makeChangeWired = true;
    document.addEventListener('click', (event) => { if (event.target.closest?.('[data-make-change]')) openChange(); });
  }

  // ---- change requests (2026-11-20, server/requests.js) ----
  // One record per thing the client asks to change. It shows twice: as a card under the message it
  // came from, and in a list (Daniel's request queue on the project; "Your requests" on the client's
  // Your site tab). Daniel moves a request along; the client's one move is "Looks good" on a change
  // that's on their preview.

  /** How each status reads: to the client in their own terms, to Daniel as the queue's step. */
  const REQUEST_STATUS = {
    received: { you: 'Received', daniel: 'Received', badge: 'review' },
    working: { you: 'Being made', daniel: 'Working on it', badge: '' },
    preview: { you: 'On your preview', daniel: 'On the preview', badge: '' },
    approved: { you: 'Approved, going live', daniel: 'Approved by them', badge: 'ready' },
    live: { you: 'Live', daniel: 'Live', badge: 'ready' },
    closed: { you: 'Closed', daniel: 'Closed', badge: '' },
  };
  const REQUEST_KIND = { details: 'Business details', photos: 'Photos', reword: 'Reword something', section: 'Add a section', page: 'Add a page', broken: 'Something looks broken', other: 'Something else' };
  const requestOpen = (request) => request.status !== 'live' && request.status !== 'closed';

  /** The newest copy of a request: the project refreshes more often than the conversation does. */
  const currentRequest = (request) => (P.requests || []).find((r) => r.id === request.id) || request;
  const requestStates = () => JSON.stringify((P.requests || []).map((r) => [r.id, r.status, r.title, r.note]));

  function requestBadge(request) {
    const status = REQUEST_STATUS[request.status] || REQUEST_STATUS.received;
    // A change that's finished on a site that hasn't launched is "Done", not "Live".
    const words = request.status === 'live' && !launched() ? 'Done' : admin ? status.daniel : status.you;
    return `<span class="badge ${status.badge}">${esc(words)}</span>`;
  }

  /** The client's one button, where it applies. */
  const looksGoodButton = (request) => (!admin && request.status === 'preview' ? `<button type="button" class="primary" data-request-approve="${request.id}">Looks good</button>` : '');

  /** The card under a message that became a request. */
  function requestCardHtml(request) {
    return `<div class="request-card">
      <p class="request-line"><span class="request-word">Request</span> ${requestBadge(request)}</p>
      <p class="request-title">${esc(request.title)}</p>
      ${request.note ? `<p class="muted">${admin ? 'Your note' : 'Daniel'}: ${esc(request.note)}</p>` : ''}
      ${looksGoodButton(request)}
    </div>`;
  }

  /** "Looks good", wherever it's drawn: under a message or in the list. */
  function wireRequestButtons(scope) {
    scope.querySelectorAll('[data-request-approve]').forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          P.requests = (await api(`${routes.requests}/${button.dataset.requestApprove}`, { method: 'PATCH', body: JSON.stringify({ approved: true }) })).requests;
        } catch (e) {
          alert(e.message);
        }
        paintRequests();
      };
    });
  }

  function requestRowForDaniel(request) {
    // The step that usually comes next gets the first button; any other step is in the menu.
    const next = { received: 'working', working: 'preview', preview: 'live', approved: 'live' }[request.status];
    const nextLabel = { working: 'Start on it', preview: 'It’s on the preview', live: 'It’s live' }[next];
    const others = Object.keys(REQUEST_STATUS).filter((status) => status !== request.status && status !== next);
    return `<li class="asset" data-request="${request.id}">
      <p class="asset-title"><strong>${esc(request.title)}</strong> ${requestBadge(request)}</p>
      <p class="muted">${esc(REQUEST_KIND[request.kind] || REQUEST_KIND.other)} · opened ${esc(ago(request.createdAt))}${request.createdBy === 'client' ? ' by them' : ''}</p>
      ${request.note ? `<p class="asset-note">Your note to them: ${esc(request.note)}</p>` : ''}
      <p class="asset-actions">
        ${next ? `<button type="button" data-request-status="${next}">${nextLabel}</button>` : ''}
        <label class="sr" for="requestmove${request.id}">Move “${esc(request.title)}” to</label>
        <select id="requestmove${request.id}" data-request-move><option value="">Move to…</option>${others.map((status) => `<option value="${status}">${esc(REQUEST_STATUS[status].daniel)}</option>`).join('')}</select>
        <button type="button" data-request-note>${request.note ? 'Change the note' : 'Add a note'}</button>
      </p>
    </li>`;
  }

  function requestRowForClient(request) {
    return `<li class="asset" data-request="${request.id}">
      <p class="asset-title"><strong>${esc(request.title)}</strong> ${requestBadge(request)}</p>
      ${request.note ? `<p class="asset-note">Daniel: ${esc(request.note)}</p>` : ''}
      ${request.status === 'preview' ? `<p class="muted">Have a look at your preview. If it’s right, say so and it goes live.</p><p class="asset-actions">${looksGoodButton(request)}</p>` : ''}
    </li>`;
  }

  function paintRequests() {
    // The cards in the conversation follow the same statuses.
    if (shownMessages && shownRequestStates !== requestStates()) showMessages(shownMessages);

    const el = root.querySelector('#requests');
    if (!el) return;
    const requests = P.requests || [];
    const key = requestStates();
    if (el.dataset.key === key) return;
    el.dataset.key = key;

    const open = requests.filter(requestOpen);
    const done = requests.filter((request) => !requestOpen(request));
    const row = admin ? requestRowForDaniel : requestRowForClient;
    const typed = el.querySelector('#requesttitle')?.value ?? '';
    const doneList = done.length ? `<details class="request-done"><summary>${done.length} finished</summary><ul class="assets">${done.map(row).join('')}</ul></details>` : '';

    if (admin) {
      el.innerHTML = `<h2>Requests</h2>
        <p class="muted">${open.length ? `${open.length} open.` : 'Nothing open.'} Each one is also a card in the conversation, under the message it came from. To make one from a message of theirs, use Track as a request in the <a href="/admin/inbox#p/${esc(P.id)}">inbox</a>.</p>
        ${open.length ? `<ul class="assets">${open.map(row).join('')}</ul>` : ''}
        ${doneList}
        <div class="asset-add">
          <label for="requesttitle">Open a request yourself</label>
          <input type="text" id="requesttitle" maxlength="160" placeholder="The ask in a few words: Add a gallery page">
          <label class="sr" for="requestkind">What kind of request</label>
          <select id="requestkind">${Object.entries(REQUEST_KIND).map(([kind, name]) => `<option value="${kind}"${kind === 'other' ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>
          <p><button type="button" id="requestadd">Open it</button> <span class="muted" id="requestsaid" role="status"></span></p>
        </div>`;
      el.querySelector('#requesttitle').value = typed;
    } else {
      el.innerHTML = `<h2>Your requests</h2>
        <p class="muted">${open.length ? 'What you’ve asked for, and where each one is.' : 'Everything you’ve asked for is done.'}</p>
        ${open.length ? `<ul class="assets">${open.map(row).join('')}</ul>` : ''}
        ${doneList}`;
    }
    wireRequestButtons(el);

    const said = (message) => { const line = el.querySelector('#requestsaid'); if (line) line.textContent = message; else alert(message); };
    const change = async (path, init) => {
      try {
        P.requests = (await api(path, init)).requests;
      } catch (e) {
        said(e.message);
        return false;
      }
      paintRequests();
      return true;
    };
    const pathFor = (control) => `${routes.requests}/${control.closest('[data-request]').dataset.request}`;
    const patch = (control, body) => change(pathFor(control), { method: 'PATCH', body: JSON.stringify(body) });

    const add = el.querySelector('#requestadd');
    if (add) add.onclick = async () => {
      const title = el.querySelector('#requesttitle');
      const opened = await change(routes.requests, { method: 'POST', body: JSON.stringify({ title: title.value, kind: el.querySelector('#requestkind').value }) });
      if (opened) { root.querySelector('#requesttitle').value = ''; msgLoaded = false; }
    };
    el.querySelectorAll('[data-request-status]').forEach((button) => { button.onclick = () => patch(button, { status: button.dataset.requestStatus }); });
    el.querySelectorAll('[data-request-move]').forEach((menu) => { menu.onchange = () => { if (menu.value) patch(menu, { status: menu.value }); }; });
    el.querySelectorAll('[data-request-note]').forEach((button) => {
      button.onclick = () => {
        const request = requests.find((r) => r.id === Number(button.closest('[data-request]').dataset.request));
        const note = prompt('A note they’ll see on this request (a quote, or why it’s closed). Leave it empty to remove the note.', request?.note || '');
        if (note !== null) patch(button, { note });
      };
    });
  }

  // ---- what the project still needs from the client (2026-11-19, server/assets.js) ----
  // Daniel keeps the list on his page and says, per item, how the client can give it: photos or
  // files uploaded right on the card, a link, a typed answer (2026-11-20). The client sees the list
  // on theirs as a short list and opens an item to answer it in a popup; anything they give marks
  // the item sent and tells Daniel.
  // "I sent it another way" is always there, with a note saying where. Daniel marks it received.
  // A photo given on a card is an ordinary photo too, so it also shows under Photos and logo.
  let assetNoteOpen = null; // the item whose "where is it?" box is open on the client's page
  let assetEditing = null; // the item Daniel is rewording on his page
  const assetSaid = {}; // item id -> the last thing said under its inputs ("Uploading 2 of 3…")

  const ASSET_BADGE = {
    needed: () => '<span class="badge review">Needed</span>',
    sent: (item) => `<span class="badge">Sent ${esc(ago(item.sentAt))}</span>`,
    received: () => '<span class="badge ready">Received</span>',
  };
  /** The inputs a card can have, as Daniel's checkboxes name them. */
  const ASSET_INPUT = { photos: 'Photos', files: 'Files (fonts, vectors, documents)', link: 'A link', text: 'Typed text' };
  const assetUploads = (item) => (P.uploads || []).filter((upload) => upload.assetId === item.id);
  const fileSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  /** Daniel's checkboxes for what a card takes, in the add form and the edit form. */
  const assetInputChoices = (name, chosen = []) => `<fieldset class="asset-inputs"><legend>They can give it as</legend>${Object.entries(ASSET_INPUT).map(([input, label]) => `<label><input type="checkbox" name="${name}" value="${input}"${chosen.includes(input) ? ' checked' : ''}> ${esc(label)}</label>`).join('')}</fieldset>`;
  const chosenInputs = (scope, name) => [...scope.querySelectorAll(`input[name="${name}"]:checked`)].map((box) => box.value);

  /** What has been given on a card so far: photos as thumbnails, files as downloads, the link, the answer. */
  function assetGivenHtml(item, canRemove) {
    const uploads = assetUploads(item);
    const photos = uploads.filter((upload) => upload.kind !== 'file');
    const files = uploads.filter((upload) => upload.kind === 'file');
    const remove = (upload) => (canRemove ? ` <button type="button" class="asset-remove-upload" data-upload="${esc(upload.id)}" aria-label="Remove ${esc(upload.filename || 'this file')}">Remove</button>` : '');
    return `${photos.length ? `<div class="grid asset-photos">${photos.map((upload) => `<figure class="thumb"><img src="${esc(routes.file(upload.id))}" alt="${esc(upload.caption || upload.filename || 'Photo')}" loading="lazy">${canRemove ? `<figcaption>${remove(upload)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      ${files.length ? `<ul class="asset-files">${files.map((upload) => `<li><a href="${esc(routes.file(upload.id))}" download>${esc(upload.filename || 'File')}</a> <span class="muted">${esc(fileSize(upload.bytes))}</span>${remove(upload)}</li>`).join('')}</ul>` : ''}
      ${item.link ? `<p class="asset-note">Link: <a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${esc(item.link)}</a></p>` : ''}
      ${item.answer && admin ? `<p class="asset-note asset-answer">${esc(item.answer)}</p>` : ''}`;
  }

  function assetHtmlForDaniel(item) {
    if (assetEditing === item.id) {
      return `<li class="asset" data-asset="${item.id}">
        <label class="sr" for="assetedittitle">What’s needed</label>
        <input type="text" id="assetedittitle" maxlength="120" value="${esc(item.title)}">
        <label class="sr" for="asseteditdetail">The format, or what it’s for</label>
        <textarea id="asseteditdetail" maxlength="600" placeholder="The format, or what it’s for (optional)">${esc(item.detail || '')}</textarea>
        ${assetInputChoices('asseteditinput', item.inputs)}
        <p class="asset-actions"><button type="button" class="primary" data-asset-save>Save</button> <button type="button" data-asset-edit-cancel>Cancel</button> <span class="muted" id="asseteditsaid" role="status"></span></p>
      </li>`;
    }
    const buttons = {
      needed: '<button type="button" data-asset-status="received">Got it</button> <button type="button" data-asset-remove>Remove</button>',
      sent: '<button type="button" data-asset-status="received">Got it</button> <button type="button" data-asset-status="needed">Still needed</button>',
      received: '<button type="button" data-asset-status="needed">Still needed</button> <button type="button" data-asset-remove>Remove</button>',
    }[item.status];
    const takes = item.inputs.length ? `They can give it as: ${item.inputs.map((input) => ASSET_INPUT[input].replace(/ \(.*/, '').toLowerCase()).join(', ')}.` : 'No inputs on the card: they mark it sent and say where it is.';
    return `<li class="asset" data-asset="${item.id}">
      <p class="asset-title"><strong>${esc(item.title)}</strong> ${ASSET_BADGE[item.status](item)}</p>
      ${item.detail ? `<p class="muted">${esc(item.detail)}</p>` : ''}
      <p class="muted">${esc(takes)}</p>
      ${assetGivenHtml(item, false)}
      ${item.clientNote ? `<p class="asset-note">They said: ${esc(item.clientNote)}</p>` : ''}
      <p class="asset-actions">${buttons} <button type="button" data-asset-edit>Edit</button></p>
    </li>`;
  }

  /** The inputs on the client's card, for an item Daniel doesn't have yet. */
  function assetInputsHtml(item) {
    const has = (input) => item.inputs.includes(input);
    const uploadButtons = [
      has('photos') && P.uploadsReady ? '<label class="btn">Add photos<input type="file" accept="image/*" multiple data-asset-upload="photo" hidden></label>' : '',
      has('files') && P.uploadsReady ? '<label class="btn">Add files<input type="file" multiple data-asset-upload="file" hidden></label>' : '',
    ].filter(Boolean).join(' ');
    return `${uploadButtons ? `<p class="asset-actions upl">${uploadButtons}</p>` : ''}
      ${has('files') && P.uploadsReady ? '<p class="help">Up to 15 MB each. For anything bigger, share a link instead.</p>' : ''}
      ${has('link') ? `<label class="asset-where" for="assetlink${item.id}">A link to it</label>
        <div class="asset-row"><input type="text" inputmode="url" id="assetlink${item.id}" data-asset-link maxlength="500" placeholder="https://" value="${esc(item.link || '')}"><button type="button" data-asset-link-save>Save link</button></div>` : ''}
      ${has('text') ? `<label class="asset-where" for="assetanswer${item.id}">Notes or Text</label>
        <textarea id="assetanswer${item.id}" data-asset-answer maxlength="4000">${esc(item.answer || '')}</textarea>
        <p class="asset-actions"><button type="button" data-asset-answer-save>Save</button></p>` : ''}
      <p class="muted" data-asset-said role="status">${esc(assetSaid[item.id] || '')}</p>`;
  }

  /** What the client has given for an item so far, in a few words for its row in the list. */
  function assetGivenSummary(item) {
    const uploads = assetUploads(item);
    const photos = uploads.filter((upload) => upload.kind !== 'file').length;
    const files = uploads.length - photos;
    const count = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : '');
    return [count(photos, 'photo', 'photos'), count(files, 'file', 'files'), item.link ? 'a link' : '', item.answer ? 'your notes' : '', item.clientNote ? 'sent another way' : ''].filter(Boolean).join(', ');
  }

  /**
   * The client's row for an item: its name, where it stands, Daniel's note and what they've given,
   * with one button. The inputs themselves open in a popup (2026-11-20), so a long list stays short.
   */
  function assetHtmlForClient(item) {
    const given = assetGivenSummary(item);
    const button = item.status === 'received' ? '' : `<button type="button" data-asset-give>${item.status === 'sent' ? 'View or add more' : 'Add it'}</button>`;
    return `<li class="asset asset-compact" data-asset="${item.id}">
      <div class="asset-summary">
        <p class="asset-title"><strong>${esc(item.title)}</strong> ${ASSET_BADGE[item.status](item)}</p>
        ${item.detail ? `<p class="muted">${esc(item.detail)}</p>` : ''}
        ${given ? `<p class="muted">You gave: ${esc(given)}.</p>` : ''}
        ${item.status === 'received' ? '<p class="muted">Daniel has this one. Thank you!</p>' : ''}
      </div>
      ${button}
    </li>`;
  }

  /** The popup for one item: what's been given, the inputs Daniel allowed, and "sent another way". */
  function assetDialogHtml(item) {
    // "Sent another way": its note box when open, the way back when it's been used, or the button.
    let anotherWay = '';
    if (assetNoteOpen === item.id) {
      anotherWay = `<label class="asset-where" for="assetnote${item.id}">Where can Daniel find it?</label>
        <textarea id="assetnote${item.id}" maxlength="600" placeholder="Where you sent it (“in Discord”, “emailed Tuesday”). You can leave this empty."></textarea>
        <p class="asset-actions"><button type="button" class="primary" data-asset-sent="yes">Mark as sent</button> <button type="button" data-asset-cancel>Cancel</button></p>`;
    } else if (item.status === 'sent') {
      // "Not sent yet" undoes a "sent another way"; something given here is removed here instead.
      const givenHere = assetUploads(item).length > 0 || item.link || item.answer;
      anotherWay = `${item.clientNote ? `<p class="asset-note">You said: ${esc(item.clientNote)}</p>` : ''}
        ${givenHere ? '' : '<p class="asset-actions"><button type="button" data-asset-sent="no">Not sent yet</button></p>'}`;
    } else {
      anotherWay = `<p class="asset-actions"><button type="button" data-asset-open>${item.inputs.length ? 'I sent it another way' : 'I’ve sent this'}</button></p>`;
    }
    return `<div class="change-in" data-asset="${item.id}">
      <div class="change-head"><h2>${esc(item.title)}</h2><button type="button" data-asset-dialog-close aria-label="Close">×</button></div>
      <p>${ASSET_BADGE[item.status](item)}</p>
      ${item.detail ? `<p class="muted">${esc(item.detail)}</p>` : ''}
      ${assetGivenHtml(item, true)}
      ${assetInputsHtml(item)}
      ${anotherWay}
      <p class="change-actions"><button type="button" class="primary" data-asset-dialog-close>Done</button></p>
    </div>`;
  }

  let assetDialog = null; // the popup's <dialog>, made the first time an item is opened
  let assetDialogItem = null; // the item it's showing

  /** Draws the popup for the open item, keeping anything half-typed, and wires its controls. */
  function paintAssetDialog() {
    if (!assetDialog || assetDialogItem === null) return;
    const item = (P.assets || []).find((one) => one.id === assetDialogItem);
    // Daniel took it off the list, or has it now: nothing left to give.
    if (!item || item.status === 'received') { assetDialog.close(); return; }
    const key = JSON.stringify([item, assetUploads(item).map((upload) => upload.id), assetNoteOpen, assetSaid[item.id], P.uploadsReady]);
    if (assetDialog.dataset.key === key) return;
    assetDialog.dataset.key = key;
    const typed = {};
    assetDialog.querySelectorAll('[data-asset-link], [data-asset-answer], textarea[id^="assetnote"]').forEach((box) => { typed[box.id] = box.value; });
    assetDialog.innerHTML = assetDialogHtml(item);
    for (const [id, value] of Object.entries(typed)) { const box = assetDialog.querySelector(`#${id}`); if (box) box.value = value; }
    wireAssetDialog(item);
  }

  function openAssetDialog(id) {
    if (!assetDialog) {
      assetDialog = document.createElement('dialog');
      assetDialog.className = 'change';
      document.body.appendChild(assetDialog);
      assetDialog.addEventListener('click', (event) => { if (event.target === assetDialog) assetDialog.close(); });
      assetDialog.addEventListener('close', () => { assetDialogItem = null; assetNoteOpen = null; delete assetDialog.dataset.key; });
    }
    assetDialogItem = id;
    delete assetDialog.dataset.key;
    paintAssetDialog();
    if (!assetDialog.open) assetDialog.showModal();
  }

  /** Every control in the popup. A change sends itself, takes the list the server answers with, and redraws. */
  function wireAssetDialog(item) {
    const dialog = assetDialog;
    const id = item.id;
    const path = `${routes.assets}/${id}`;
    const redraw = () => { delete dialog.dataset.key; paintAssetDialog(); const card = root.querySelector('#assets'); if (card) { delete card.dataset.key; paintAssets(); } };
    const say = (message) => { assetSaid[id] = message; const line = dialog.querySelector('[data-asset-said]'); if (line) line.textContent = message; };
    const patch = async (body) => {
      try {
        P.assets = (await api(path, { method: 'PATCH', body: JSON.stringify(body) })).assets;
        return true;
      } catch (e) {
        say(e.message);
        return false;
      }
    };

    dialog.querySelectorAll('[data-asset-dialog-close]').forEach((button) => { button.onclick = () => dialog.close(); });

    dialog.querySelectorAll('[data-asset-upload]').forEach((input) => {
      input.onchange = async () => {
        const files = [...input.files];
        let done = 0;
        for (const file of files) {
          say(`Uploading ${done + 1} of ${files.length}…`);
          const form = new FormData();
          form.set('file', file);
          form.set('kind', input.dataset.assetUpload);
          form.set('asset', String(id));
          try {
            await api(routes.uploads, { method: 'POST', body: form });
            done++;
          } catch (e) {
            assetSaid[id] = `${file.name}: ${e.message}`;
            await refresh();
            return;
          }
        }
        assetSaid[id] = `Uploaded ${done}. Daniel can see ${done === 1 ? 'it' : 'them'} now.`;
        await refresh();
      };
    });
    dialog.querySelectorAll('.asset-remove-upload').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Remove this file?')) return;
        await api(routes.file(button.dataset.upload, true), { method: 'DELETE' }).catch((e) => alert(e.message));
        await refresh();
      };
    });
    dialog.querySelectorAll('[data-asset-link-save]').forEach((button) => {
      button.onclick = async () => {
        const box = dialog.querySelector(`#assetlink${id}`);
        if (!(await patch({ link: box.value }))) return;
        // Show the link as it was saved (with https:// in front), not as it was typed.
        box.value = P.assets.find((one) => one.id === id)?.link || '';
        assetSaid[id] = box.value ? 'Link saved. Daniel can see it now.' : 'Link removed.';
        redraw();
      };
    });
    dialog.querySelectorAll('[data-asset-answer-save]').forEach((button) => {
      button.onclick = async () => {
        if (!(await patch({ answer: dialog.querySelector(`#assetanswer${id}`).value }))) return;
        assetSaid[id] = 'Saved. Daniel can see it now.';
        redraw();
      };
    });
    dialog.querySelectorAll('[data-asset-open]').forEach((button) => {
      button.onclick = () => { assetNoteOpen = id; redraw(); dialog.querySelector(`#assetnote${id}`)?.focus(); };
    });
    dialog.querySelectorAll('[data-asset-cancel]').forEach((button) => { button.onclick = () => { assetNoteOpen = null; redraw(); }; });
    dialog.querySelectorAll('[data-asset-sent]').forEach((button) => {
      button.onclick = async () => {
        const sent = button.dataset.assetSent === 'yes';
        const note = sent ? dialog.querySelector(`#assetnote${id}`)?.value ?? '' : '';
        assetNoteOpen = null;
        if (await patch({ sent, note })) redraw();
      };
    });
  }

  function paintAssets() {
    // The popup shows the same item as the list, so it follows every refresh too.
    paintAssetDialog();
    const el = root.querySelector('#assets');
    if (!el) return;
    const items = P.assets || [];
    const given = (P.uploads || []).filter((upload) => upload.assetId).map((upload) => [upload.id, upload.assetId]);
    // Redraw only when something on the card changes, so typing isn't wiped by the refresh.
    const key = JSON.stringify([items, given, assetEditing, P.uploadsReady]);
    if (el.dataset.key === key) return;
    // While Daniel is rewording an item, a background refresh leaves the card alone.
    if (el.querySelector('#assetedittitle') && assetEditing !== null && el.dataset.editing === String(assetEditing)) return;
    el.dataset.key = key;
    el.dataset.editing = assetEditing === null ? '' : String(assetEditing);

    // Whatever Daniel has half-typed into the add form survives a redraw.
    const typed = { title: el.querySelector('#assettitle')?.value ?? '', detail: el.querySelector('#assetdetail')?.value ?? '', inputs: chosenInputs(el, 'assetinput') };
    const waiting = items.filter((item) => item.status === 'needed').length;
    const list = items.length ? `<ul class="assets">${items.map(admin ? assetHtmlForDaniel : assetHtmlForClient).join('')}</ul>` : '';

    if (admin) {
      el.innerHTML = `<h2>Assets needed</h2>
        <p class="muted">${items.length ? `${waiting} still needed of ${items.length}. ` : ''}What this project still needs from them. They see this list on their page and give each thing from there.</p>
        ${list}
        <div class="asset-add">
          <label for="assettitle">Add something</label>
          <input type="text" id="assettitle" maxlength="120" placeholder="What’s needed: Display font">
          <textarea id="assetdetail" maxlength="600" placeholder="The format, or what it’s for (optional)"></textarea>
          ${assetInputChoices('assetinput', typed.inputs)}
          <p><button type="button" id="assetadd">Add to the list</button> <span class="muted" id="assetsaid" role="status"></span></p>
        </div>`;
      el.querySelector('#assettitle').value = typed.title;
      el.querySelector('#assetdetail').value = typed.detail;
    } else {
      el.innerHTML = `<h2>What we still need from you</h2>
        <p class="muted">${waiting ? `${waiting} to go. Open one to add it, or to tell Daniel where to find it.` : 'That’s everything for now. Thank you!'}</p>
        ${list}`;
      el.querySelectorAll('[data-asset-give]').forEach((button) => {
        button.onclick = () => openAssetDialog(Number(button.closest('[data-asset]').dataset.asset));
      });
      return;
    }

    // ---- Daniel's controls ----
    const itemId = (control) => Number(control.closest('[data-asset]').dataset.asset);
    const itemPath = (control) => `${routes.assets}/${itemId(control)}`;
    const redraw = () => { delete el.dataset.key; delete el.dataset.editing; paintAssets(); };
    // One place for a change to the list: send it, take the list the server answers with, and redraw.
    const change = async (path, init, onError) => {
      try {
        P.assets = (await api(path, init)).assets;
      } catch (e) {
        if (onError) onError(e.message); else alert(e.message);
        return false;
      }
      redraw();
      return true;
    };

    el.querySelector('#assetadd').onclick = async () => {
      const body = { title: el.querySelector('#assettitle').value, detail: el.querySelector('#assetdetail').value, inputs: chosenInputs(el, 'assetinput') };
      const added = await change(routes.assets, { method: 'POST', body: JSON.stringify(body) }, (message) => { el.querySelector('#assetsaid').textContent = message; });
      if (added) {
        const fresh = root.querySelector('#assets');
        fresh.querySelector('#assettitle').value = '';
        fresh.querySelector('#assetdetail').value = '';
        fresh.querySelector('#assettitle').focus();
      }
    };
    el.querySelectorAll('[data-asset-status]').forEach((button) => {
      button.onclick = () => change(itemPath(button), { method: 'PATCH', body: JSON.stringify({ status: button.dataset.assetStatus }) });
    });
    el.querySelectorAll('[data-asset-remove]').forEach((button) => {
      button.onclick = () => { if (confirm('Take this off the list? They stop seeing it too.')) change(itemPath(button), { method: 'DELETE' }); };
    });
    el.querySelectorAll('[data-asset-edit]').forEach((button) => {
      button.onclick = () => { assetEditing = itemId(button); redraw(); root.querySelector('#assetedittitle')?.focus(); };
    });
    el.querySelectorAll('[data-asset-edit-cancel]').forEach((button) => { button.onclick = () => { assetEditing = null; redraw(); }; });
    el.querySelectorAll('[data-asset-save]').forEach((button) => {
      button.onclick = async () => {
        const body = { title: el.querySelector('#assetedittitle').value, detail: el.querySelector('#asseteditdetail').value, inputs: chosenInputs(el, 'asseteditinput') };
        try {
          P.assets = (await api(itemPath(button), { method: 'PATCH', body: JSON.stringify(body) })).assets;
        } catch (e) {
          el.querySelector('#asseteditsaid').textContent = e.message;
          return;
        }
        assetEditing = null;
        redraw();
      };
    });
  }

  function paintFiles() {
    const el = root.querySelector('#files');
    if (!el) return;
    const key = JSON.stringify([P.uploads, P.uploadsReady]);
    if (key === lastUploads) return;
    lastUploads = key;
    const tile = (u) => {
      const img = /^image\/(jpeg|png|gif|webp|avif)$/.test(u.content_type);
      return `<figure class="thumb" data-id="${esc(u.id)}">${img ? `<img src="${esc(routes.file(u.id))}" alt="${esc(u.caption || u.filename || u.kind)}" loading="lazy">` : `<div class="noprev">${esc(u.filename || u.kind)}<br><span class="help">can't preview here</span></div>`}
        <figcaption><span class="badge">${u.kind}</span><input type="text" class="caption" placeholder="Caption (optional)" value="${esc(u.caption)}"><button type="button" class="del" aria-label="Remove">Remove</button></figcaption></figure>`;
    };
    const logos = P.uploads.filter((u) => u.kind === 'logo');
    const photos = P.uploads.filter((u) => u.kind === 'photo');
    el.innerHTML = `<h2>Photos and logo</h2>
      ${P.uploadsReady ? `<p class="upl"><label class="btn">Add photos<input type="file" accept="image/*" multiple data-kind="photo" hidden></label> <label class="btn">Add a logo<input type="file" accept="image/*,application/pdf" data-kind="logo" hidden></label> <span class="muted" id="uplnote"></span></p>` : '<p class="muted">Uploads are being switched on. Until then, send photos to Daniel.</p>'}
      ${logos.length || photos.length ? `<div class="grid">${[...logos, ...photos].map(tile).join('')}</div>` : '<p class="muted">Nothing yet.</p>'}`;
    el.querySelectorAll('input[type=file]').forEach((inp) => inp.addEventListener('change', () => upload([...inp.files], inp.dataset.kind)));
    el.querySelectorAll('.thumb').forEach((fig) => {
      const id = fig.dataset.id;
      fig.querySelector('.caption').addEventListener('change', (e) => api(routes.file(id, true), { method: 'PATCH', body: JSON.stringify({ caption: e.target.value }) }).catch(() => {}));
      fig.querySelector('.del').addEventListener('click', async () => { if (!confirm('Remove this file?')) return; await api(routes.file(id, true), { method: 'DELETE' }).catch((e) => alert(e.message)); await refresh(); });
    });
  }

  async function upload(files, kind) {
    const note = root.querySelector('#uplnote');
    let done = 0;
    for (const f of files) {
      note.textContent = `Uploading ${done + 1} of ${files.length}…`;
      const fd = new FormData();
      fd.set('file', f); fd.set('kind', kind);
      try { await api(routes.uploads, { method: 'POST', body: fd }); done++; } catch (e) { note.innerHTML = `<span class="error">${esc(f.name)}: ${esc(e.message)}</span>`; await refresh(); return; }
    }
    note.textContent = `Uploaded ${done}.`;
    await refresh();
  }

  function paintActivity() {
    const box = root.querySelector('#activity');
    if (!box) return;
    const key = JSON.stringify(P.events);
    if (key === lastEvents) return;
    lastEvents = key;
    box.innerHTML = `<h2>Activity</h2>${P.events.length ? `<ul class="events">${P.events.map((e) => `<li><span class="muted">${esc(ago(e.at))}</span> ${esc(e.what)}</li>`).join('')}</ul>` : '<p class="muted">Nothing yet.</p>'}`;
  }

  // ---- saving ----
  // The save status: in the bar on Daniel's side; on the client's, a small note in the corner that
  // fades, since their bar only appears once there's a build or preview to show (Daniel, 2026-11-02).
  let toastTimer = null;
  function saved(text, error = false) {
    savedEl.innerHTML = error ? `<span class="error">${esc(text)}</span>` : esc(text);
    if (admin || !bar.hidden) return;
    let t = document.getElementById('savetoast');
    if (!t) { t = document.createElement('div'); t.id = 'savetoast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text;
    t.className = error ? 'error show' : 'show';
    clearTimeout(toastTimer);
    if (!error && text === 'Saved') toastTimer = setTimeout(() => { t.className = ''; }, 1500);
  }
  function queue(field, value, now) {
    pending[field] = value;
    localEditAt[field] = Date.now();
    saved('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, now ? 0 : 700);
  }

  async function flush() {
    const patch = pending;
    pending = {};
    if (!Object.keys(patch).length) return;
    try {
      const r = await api(routes.project, { method: 'PATCH', body: JSON.stringify({ answers: patch }) });
      saved(Object.keys(pending).length ? 'Saving…' : 'Saved');
      apply(r);
    } catch (e) {
      pending = { ...patch, ...pending };
      saved('Not saved', true);
      readyEl.textContent = e.message;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 5000);
    }
  }

  // ---- the other side's changes ----
  function apply(r) {
    const before = P ? shape() : null;
    // Unsaved local edits win over what the server says until they're saved.
    P = { ...r, answers: { ...r.answers, ...pending } };
    if (before !== shape()) return render();
    // On the agreement screen there's nothing else to update, and redrawing would wipe a half-typed name.
    if (gated() && (!tabbed() || !['planning', 'messages'].includes(tab))) { ensureDrawer(); paintMessages(); return; }
    for (const el of root.querySelectorAll('[data-f]')) {
      const f = el.dataset.f;
      if (el.contains(document.activeElement) || f in pending || Date.now() - (localEditAt[f] || 0) < 4000) continue;
      if (setField(el, P.answers[f])) {
        el.classList.add('changed');
        setTimeout(() => el.classList.remove('changed'), 1500);
      }
    }
    root.querySelectorAll('[data-tier]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tier === P.answers.tier)));
    paint();
  }

  async function refresh() {
    try { apply(await api(routes.project)); } catch (e) { if (/expired|turned off|isn’t valid/.test(e.message)) { stop(); root.innerHTML = `<p class="error">${esc(e.message)}</p>`; } }
  }

  // ---- presence ----
  let presenceTimer = null;
  let presenceField = null;
  function presence(field) {
    presenceField = field;
    clearTimeout(presenceTimer);
    // A blur followed by a focus (tabbing between fields) sends one update, not two.
    presenceTimer = setTimeout(() => api(routes.presence, { method: 'POST', body: JSON.stringify({ field: presenceField }) }).catch(() => {}), 250);
  }
  const heartbeat = setInterval(() => { if (presenceField && document.visibilityState === 'visible') presence(presenceField); }, 6000);

  // ---- build ----
  buildBtn.onclick = async () => {
    await flush();
    buildBtn.disabled = true;
    try { await api(routes.build, { method: 'POST', body: '{}' }); await refresh(); } catch (e) { readyEl.textContent = e.message; }
  };

  function stop() {
    stopped = true;
    clearInterval(pollTimer); clearInterval(heartbeat); clearInterval(tick);
    // The contract pane belongs to this project: gone with it (Daniel's page mounts the next one fresh).
    if (cpane) {
      cpane.undock?.(); cpane.remove(); cpane = null;
      const cols = root.parentNode;
      if (cols?.classList.contains('cols')) { cols.parentNode.insertBefore(root, cols); cols.remove(); }
      document.getElementById('cfab')?.remove();
      document.body.classList.remove('cpane-open', 'has-cpane');
    }
  }
  const tick = setInterval(() => { const el = progress.querySelector('#elapsed'); if (el && P?.buildStartedAt && building()) el.textContent = since(P.buildStartedAt); }, 1000);

  // Crossing the wide-screen line moves Messages between the drawer and a tab.
  WIDE.addEventListener('change', () => { if (P) { ensureDrawer(); render(); } });

  // ---- start ----
  root.innerHTML = '<p class="muted">Loading…</p>';
  try { P = await api(routes.project); } catch (e) { root.innerHTML = `<p class="error">${esc(e.message)}</p>${o.backHref ? `<p><a href="${o.backHref}">Back</a></p>` : ''}`; return { stop() {} }; }
  if (admin) bar.hidden = false;
  render();
  pollTimer = setInterval(() => { if (!stopped && document.visibilityState === 'visible' && !Object.keys(pending).length) refresh(); }, POLL_MS);
  // Back to this window: messages that only peeked while it sat in the background are read now.
  addEventListener('focus', () => { if (!stopped && P?.unreadMessages) paintMessages(); });
  addEventListener('beforeunload', (e) => { if (Object.keys(pending).length) { flush(); e.preventDefault(); } });
  return { stop() { stop(); presence(null); if (Object.keys(pending).length) flush(); }, flush };
}

/** The sticky progress strip: collapses to the step bars once scrolled; a tap or hover shows the details. */
export function wireProgress(progress) {
  const toggle = () => { progress.classList.toggle('pinned'); };
  progress.addEventListener('click', (e) => { if (!e.target.closest('a')) toggle(); });
  progress.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  addEventListener('scroll', () => { if (!progress.hidden) progress.classList.toggle('collapsed', scrollY > 60); }, { passive: true });
}
