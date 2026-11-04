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
  const applies = (x) => (!x.clientHidden || admin) && (!x.tiers || (P.answers.tier && x.tiers.includes(P.answers.tier)));
  const canEdit = (f) => admin || (P.editable || []).includes(f.id);
  const label = (f) => (!admin && f.you) || f.label;
  const building = () => ['build-requested', 'building'].includes(P.status);
  const gated = () => !admin && P.agreement?.needed;
  // The client's page is tabs (2026-11-04). Before signing: the contract, and planning for a head
  // start. After: Your site (preview or live site, progress, activity), Planning (the intake; after
  // launch, Your details: only the facts that change, and a Request a change box on Your site), the
  // Care plan once Daniel offers one (before or after launch), and Documents (everything signed).
  // The tab is remembered for this browser tab, so a reload stays where it was.
  const launched = () => !!P?.launched;
  const clientTabs = () => {
    if (admin) return [];
    // Messages with Daniel from the first day (2026-11-04), with the unread count on the tab.
    const msgs = ['messages', P.unreadMessages ? `Messages (${P.unreadMessages})` : 'Messages'];
    if (gated()) return P.agreement.reason !== 'no-package' ? [['contract', 'Contract'], ['planning', 'Planning'], msgs] : [];
    return [['site', 'Your site'], ['planning', launched() ? 'Details' : 'Planning'], msgs, ...(P.care ? [['care', 'Care plan']] : []), ['docs', 'Documents']];
  };
  let tab = (() => { try { return sessionStorage.getItem('clientTab') || ''; } catch { return ''; } })();
  const fixTab = () => { const ts = clientTabs(); if (ts.length && !ts.some(([id]) => id === tab)) tab = ts[0][0]; };
  const tabbed = () => clientTabs().length > 0;
  const shape = () => (gated() ? 'agreement:' + (P.agreement.reason || '') + ':' + (P.agreement.current?.sha256 || '') + ':' + P.agreement.signingOpen + '|' : '') + (admin ? '' : `tabs:${tab}:${launched()}:${!!P.care}|`) + C.sections.filter(applies).map((s) => s.id + ':' + s.fields.filter(applies).map((f) => f.id).join(',')).join('|');
  // What each tab shows. Daniel's page has everything; so does the client's planning tab before signing.
  const parts = () => {
    if (admin) return { status: 1, messages: 1, scope: 1, link: 1, files: 1, fields: 'all', activity: 1, intro: 0 };
    if (tab === 'messages') return { messages: 1 };
    if (gated()) return { status: 1, scope: 1, files: 1, fields: 'all', activity: 1, intro: 1 };
    return ({ site: { status: 1, scope: 1, request: launched(), activity: 1 }, planning: { files: 1, fields: launched() ? 'live' : 'all', intro: 1 }, care: { care: 1 }, docs: { docs: 1 } })[tab] || {};
  };
  const fieldShown = (mode) => (f) => applies(f) && (mode === 'all' || (f.live && f.id !== 'notes'));

  // ---- fields ----
  function fieldHtml(f) {
    const v = P.answers[f.id];
    const editable = canEdit(f);
    const dis = editable ? '' : ' disabled';
    const help = [(!admin && f.youHelp) || f.help, editable ? null : 'Daniel sets this'].filter(Boolean).map((h) => `<span class="help">${esc(h)}</span>`).join('');
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
  function wireHours(el) {
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
      queue(el.dataset.f, hoursValue(el), t.classList.contains('hnote') ? false : true);
    });
    // Delegated, so it survives the picker being redrawn with the other side's hours.
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.hcopy')) return;
      const on = DAYS.map(([d]) => d).filter((d) => el.querySelector(`[data-day="${d}"]`).checked);
      if (!on.length) return;
      for (const d of on.slice(1)) for (const w of ['open', 'close']) el.querySelector(`[data-${w}="${d}"]`).value = el.querySelector(`[data-${w}="${on[0]}"]`).value;
      queue(el.dataset.f, hoursValue(el), true);
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
    if (gated() && (!tabbed() || !['planning', 'messages'].includes(tab))) return renderAgreement();
    const show = parts();
    msgLoaded = false;
    // A redraw makes fresh, empty cards: everything that skips repainting when nothing changed starts over.
    docsLoaded = false;
    careKey = null;
    const notesField = C.sections.flatMap((x) => x.fields).find((f) => f.id === 'notes');
    if (admin) bar.hidden = false; // the client's bar shows only with a build or preview (paintBar)
    const focus = document.activeElement?.closest?.('[data-f]') === document.activeElement ? document.activeElement.dataset.f : null;
    const sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const y = scrollY;
    root.innerHTML = `
      ${o.backHref ? `<p><a class="back" href="${o.backHref}"><span aria-hidden="true">‹</span> All projects</a></p>` : ''}
      <h1 id="title"></h1>
      ${show.intro ? `<p class="muted">${launched() ? 'Keep these up to date: what you change here goes onto your site on its own, usually within a few minutes.' : 'This is the same page Daniel is working from. Anything you type here saves on its own, and he sees it as you go.'}</p>` : ''}
      ${show.status ? '<section class="card" id="status"></section>' : ''}
      ${show.request && notesField ? `<section class="card"><h2>Request a change</h2><p class="muted">New pages, new features, a different layout: anything bigger than your details goes to Daniel, who gets back to you about it.</p>${fieldHtml(notesField)}</section>` : ''}
      ${show.messages ? `<section class="card" id="messages"><h2>Messages</h2><p class="muted">${admin ? `Your conversation with ${esc(P.answers.contactName || 'the client')}. They get an email when you write, with their link.` : 'Write to Daniel any time, about anything. Daniel gets your message right away and answers here, and you’ll get an email when there’s a reply.'}</p><ol class="msgs${admin ? ' boxed' : ''}" id="msglist"><li class="muted">Loading…</li></ol><div class="composer${admin ? '' : ' fixed'}" id="composer"><div class="in"><label for="msgbody" class="sr">${admin ? 'Reply' : 'Message'}</label><div class="composer-row"><textarea id="msgbody" maxlength="4000" rows="1" placeholder="${admin ? 'Reply' : 'Message Daniel'} (Shift+Enter for a new line)" aria-describedby="msghint"></textarea><button type="button" class="primary" id="msgsend">Send</button></div><span id="msghint" class="help">Enter sends · Shift+Enter for a new line</span> <span id="msgnote" class="muted" role="status"></span></div></div></section>` : ''}
      ${show.care && P.care ? '<section class="card" id="care"></section>' : ''}
      ${show.docs ? '<section class="card" id="docs"><h2>Documents</h2><p class="muted">Loading…</p></section>' : ''}
      ${show.scope ? '<section class="card" id="scope" hidden><h2>Past the package</h2><ul class="scope" id="scopelist"></ul></section>' : ''}
      ${show.link ? '<section class="card" id="linkcard"></section>' : ''}
      ${show.files ? '<section class="card" id="files"></section>' : ''}
      ${show.fields ? C.sections.filter(applies).map((s) => { const fs = s.fields.filter(fieldShown(show.fields)); return fs.length ? `<section class="card"><h2>${esc((!admin && s.you) || s.title)}</h2>${fs.map(fieldHtml).join('')}</section>` : ''; }).join('') : ''}
      ${show.activity ? '<section class="card" id="activity"></section>' : ''}`;
    root.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => queue('tier', b.dataset.tier, true)));
    wirePricing();
    wireMessages();
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
    else lines.push(`<p>${c.billing.paidThrough ? `Paid through ${esc(longDate(c.billing.paidThrough))}. ` : c.endsAt || c.status === 'canceled' ? '' : `Your card is on file; the first charge is ${esc(longDate(c.firstBill))}. `}</p><p><button type="button" id="carebilling">${c.status === 'canceled' ? 'See past invoices' : ending ? 'Renew my plan' : 'Change card, see invoices or cancel'}</button> <span id="carenote" class="muted"></span></p>`);
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
  async function paintMessages() {
    const list = root.querySelector('#msglist');
    if (!list || msgLoading || (msgLoaded && !P.unreadMessages)) return;
    msgLoading = true;
    try {
      const d = await api(routes.messages);
      msgLoaded = true;
      showMessages(d.messages);
      P.unreadMessages = 0;
      if (!admin) paintTabs();
    } catch (e) { list.innerHTML = `<li class="error">${esc(/no such table/.test(e.message) ? 'Messages are being switched on.' : e.message)}</li>`; }
    msgLoading = false;
  }
  function showMessages(ms) {
    const list = root.querySelector('#msglist');
    if (!list) return;
    const atEnd = !list.dataset.shown || (admin ? list.scrollHeight - list.scrollTop - list.clientHeight < 40 : innerHeight + scrollY >= document.documentElement.scrollHeight - 80);
    const mine = admin ? 'daniel' : 'client';
    list.innerHTML = ms.length ? ms.map((m) => `<li class="msg ${m.sender === mine ? 'mine' : 'theirs'}"><div class="meta"><b>${m.sender === mine ? 'You' : esc(m.sender === 'daniel' ? 'Daniel' : m.name || 'Client')}</b> <span class="muted">${esc(ago(m.at))}</span>${m.sender === mine && m.read_at ? ' <span class="muted">· read</span>' : ''}</div><div class="body">${esc(m.body)}</div></li>`).join('') : `<li class="muted">No messages yet.${admin ? '' : ' Say hello!'}</li>`;
    // Like any chat: open on the latest message, and follow new ones if you were already at the end.
    list.dataset.shown = '1';
    if (atEnd) requestAnimationFrame(() => { if (admin) list.scrollTop = list.scrollHeight; else scrollTo(0, document.documentElement.scrollHeight); });
  }
  // The message box floats at the bottom of the screen, just above whatever else is pinned there (the
  // tabs, the build bar), and rides up with a phone's keyboard (2026-11-04). Android resizes the page
  // for the keyboard (interactive-widget in the viewport tag); iOS doesn't, so the gap comes from
  // visualViewport. While typing on a phone, the tabs and bar step aside to leave room.
  function placeComposer() {
    const c = root.querySelector('#composer');
    if (!c) return;
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
  function wireMessages() {
    const btn = root.querySelector('#msgsend');
    if (!btn) return;
    const body = root.querySelector('#msgbody'), note = root.querySelector('#msgnote');
    const grow = () => { body.style.height = 'auto'; body.style.height = Math.min(body.scrollHeight, 160) + 'px'; };
    body.addEventListener('input', grow);
    // Enter sends, Shift+Enter is a new line; never mid-composition (an IME's Enter picks a word).
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); btn.click(); } });
    body.addEventListener('focus', () => { document.body.classList.add('composing'); requestAnimationFrame(placeComposer); });
    body.addEventListener('blur', () => { document.body.classList.remove('composing'); requestAnimationFrame(placeComposer); });
    // Tapping Send mustn't blur the box first: on a phone that would drop the keyboard and move the button.
    btn.addEventListener('pointerdown', (e) => { if (document.activeElement === body) e.preventDefault(); });
    btn.addEventListener('click', async () => {
      if (!body.value.trim()) { note.textContent = 'Write a message first.'; return; }
      btn.disabled = true; note.className = 'muted'; note.textContent = 'Sending…';
      try {
        const d = await api(routes.messages, { method: 'POST', body: JSON.stringify({ body: body.value }) });
        body.value = ''; grow(); showMessages(d.messages);
        note.textContent = admin ? (d.emailed ? 'Sent. They got an email about it.' : 'Sent. No email went out (no address, or email is off).') : 'Sent. Daniel will answer here.';
      } catch (e) { note.className = 'error'; note.textContent = e.message; }
      btn.disabled = false;
    });
  }

  function paint() {
    paintPricing();
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
      ${c.missing.length ? `<p class="muted">Needed to start a first version: ${c.missing.map((m) => esc(label(C.sections.flatMap((x) => x.fields).find((f) => f.id === m.id) ?? m))).join(', ')}.</p>` : ''}
      ${agreementLine()}
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
    if (admin) paintLink();
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
      <section class="card">
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
    return `<p class="${ag.reason === 'changed' ? 'error' : 'muted'}">${ag.reason === 'changed' ? 'The package changed since the contract was signed; the client will be asked to sign the updated one.' : 'Contract not signed yet. It shows first on the client’s link; the build waits for it.'}</p>${toggle}${ag.current ? `<details><summary>Preview what they’ll sign</summary><div class="agreement">${agreementHtml(ag.current)}</div></details>` : ''}`;
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
    const key = JSON.stringify([l, madeUrl, P.linkKeySet]);
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    const url = l?.url || (l && madeUrl) || null;
    el.innerHTML = `<h2>Client link</h2>
      ${l ? `<p class="muted">On · made ${esc(ago(l.createdAt))} · ${l.lastUsedAt ? `last opened ${esc(ago(l.lastUsedAt))}` : 'not opened yet'} · works until ${esc(new Date(l.expiresAt).toLocaleDateString())}</p>` : '<p class="muted">No link yet. A link lets them see and fill in this same page, upload photos, and watch the build.</p>'}
      ${url ? `<input type="text" readonly value="${esc(url)}" id="linkurl" aria-label="Client link"><p><button type="button" id="copylink">Copy</button> ${navigator.share ? '<button type="button" id="sharelink">Share…</button>' : ''}</p>` : l ? `<p class="muted">${P.linkKeySet ? 'This link was made before links could be shown again.' : 'Links can only be shown right after they’re made until the LINK_KEY secret is set on the site.'} Make a new one to copy it (the old one stops working).</p>` : ''}
      ${url && !l?.url ? '<p class="help">Copy it now: without the LINK_KEY secret it won’t be shown again after you leave this page.</p>' : ''}
      <p><button type="button" id="makelink">${l ? 'Make a new link' : 'Make a link'}</button> ${l ? '<button type="button" id="killlink">Turn it off</button>' : ''}</p>`;
    el.querySelector('#makelink').onclick = async () => {
      if (l && !confirm('Make a new link? The current one stops working.')) return;
      try { madeUrl = (await api(routes.link, { method: 'POST', body: '{}' })).url; await refresh(); } catch (e) { alert(e.message); }
    };
    const kill = el.querySelector('#killlink');
    if (kill) kill.onclick = async () => { if (!confirm('Turn the client link off? Their page stops working until you make a new one.')) return; madeUrl = null; await api(routes.link, { method: 'DELETE' }); await refresh(); };
    const copy = el.querySelector('#copylink');
    if (copy) copy.onclick = async () => {
      try { await navigator.clipboard.writeText(url); } catch { const f = el.querySelector('#linkurl'); f.select(); document.execCommand('copy'); }
      copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 2000);
    };
    const share = el.querySelector('#sharelink');
    if (share) share.onclick = () => navigator.share({ title: 'Your website', text: 'Here’s the page for your new website.', url }).catch(() => {});
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
    if (gated() && (!tabbed() || !['planning', 'messages'].includes(tab))) return;
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
  }
  const tick = setInterval(() => { const el = progress.querySelector('#elapsed'); if (el && P?.buildStartedAt && building()) el.textContent = since(P.buildStartedAt); }, 1000);

  // ---- start ----
  root.innerHTML = '<p class="muted">Loading…</p>';
  try { P = await api(routes.project); } catch (e) { root.innerHTML = `<p class="error">${esc(e.message)}</p>${o.backHref ? `<p><a href="${o.backHref}">Back</a></p>` : ''}`; return { stop() {} }; }
  if (admin) bar.hidden = false;
  render();
  pollTimer = setInterval(() => { if (!stopped && document.visibilityState === 'visible' && !Object.keys(pending).length) refresh(); }, POLL_MS);
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
