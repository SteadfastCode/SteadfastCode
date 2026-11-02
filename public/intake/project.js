// The shared project form (2026-11-01). Daniel's /admin and the client's /client both mount this,
// so the two sides are the same form: the same questions (src/data/intake.ts, embedded by each page
// as config), the same scope notes and price, files, activity and build progress. The client can
// edit everything except fields marked owner: 'daniel'; nothing is hidden from them.
//
// Live, field by field: each side autosaves a field when typing pauses and checks for the other
// side's changes every 2 seconds. A field someone is typing in is never overwritten under them;
// the other screen shows "<name> is editing" on it instead.

const POLL_MS = 2000;
const STEPS = ['Picked up', 'Setting up', 'Building', 'Checking', 'Publishing', 'Done'];
const statusLabel = { intake: 'Getting started', 'build-requested': 'Build requested', building: 'Building', preview: 'Preview ready', live: 'Live', closed: 'Closed' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n, from) => (from ? 'from ' : '') + '$' + Number(n).toLocaleString('en-US');
const since = (iso) => { const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const clock = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
// Hours as the form holds them: an old free-text answer shows as the note.
const normHours = (v) => (!v ? { mode: 'set', days: {}, note: '' } : typeof v === 'string' ? { mode: 'set', days: {}, note: v } : { mode: v.mode || 'set', days: v.days || {}, note: v.note || '' });
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
  let newLink = null;
  let stopped = false;

  const api = async (path, init = {}) => {
    const isForm = init.body instanceof FormData;
    const r = await fetch(path, { credentials: 'same-origin', ...init, headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...(o.headers || {}), ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    return j;
  };
  const tierOf = (id) => C.tiers.find((t) => t.id === id);
  const applies = (x) => !x.tiers || (P.answers.tier && x.tiers.includes(P.answers.tier));
  const canEdit = (f) => admin || (P.editable || []).includes(f.id);
  const label = (f) => (!admin && f.you) || f.label;
  const building = () => ['build-requested', 'building'].includes(P.status);
  const gated = () => !admin && P.agreement?.needed;
  const shape = () => (gated() ? 'agreement:' + (P.agreement.reason || '') + ':' + (P.agreement.current?.sha256 || '') + '|' : '') + C.sections.filter(applies).map((s) => s.id + ':' + s.fields.filter(applies).map((f) => f.id).join(',')).join('|');

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
        ctl = `<input type="${f.type}" id="${id}" data-f="${f.id}" value="${esc(v)}" autocomplete="off"${dis}>`;
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
    if (gated()) return renderAgreement();
    const focus = document.activeElement?.closest?.('[data-f]') === document.activeElement ? document.activeElement.dataset.f : null;
    const sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const y = scrollY;
    root.innerHTML = `
      ${o.backHref ? `<p><a href="${o.backHref}">← All projects</a></p>` : ''}
      <h1 id="title"></h1>
      ${admin ? '' : '<p class="muted">This is the same page Daniel is working from. Anything you type here saves on its own, and he sees it as you go.</p>'}
      <section class="card" id="status"></section>
      <section class="card" id="scope" hidden><h2>Past the package</h2><ul class="scope" id="scopelist"></ul></section>
      ${admin ? '<section class="card" id="linkcard"></section>' : ''}
      <section class="card" id="files"></section>
      ${C.sections.filter(applies).map((s) => `<section class="card"><h2>${esc(s.title)}</h2>${s.fields.filter(applies).map(fieldHtml).join('')}</section>`).join('')}
      <section class="card" id="activity"></section>`;
    root.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => queue('tier', b.dataset.tier, true)));
    root.querySelectorAll('[data-f]').forEach((el) => {
      if (el.dataset.kind === 'hours') wireHours(el);
      else {
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

  function paint() {
    const a = P.answers, c = P.check, t = c.tier;
    root.querySelector('#title').textContent = a.businessName || (admin ? 'New project' : 'Your website');
    root.querySelector('#status').innerHTML = `
      <div><b>${esc(statusLabel[P.status] || P.status)}</b>${t ? ` · ${esc(t.name)} · ${money(c.price, t.from)}` : ' · no package yet'}</div>
      ${P.buildNote && !building() ? `<p class="${P.failed ? 'error' : 'muted'}" style="white-space:pre-line">${esc(admin || !P.failed ? P.buildNote : 'The last build didn’t finish. Daniel can see what happened and will start it again.')}</p>` : ''}
      ${P.previewUrl ? `<p><a class="btn" href="${esc(P.previewUrl)}" target="_blank" rel="noopener">Open the preview</a></p>` : ''}
      ${c.missing.length ? `<p class="muted">Needed to start a first version: ${c.missing.map((m) => esc(m.label)).join(', ')}.</p>` : ''}
      ${agreementLine()}`;
    const view = root.querySelector('[data-signed]');
    if (view) view.onclick = async (e) => {
      e.preventDefault();
      const box = root.querySelector('#signedcopy');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      try { const a = await api(routes.agreement + '?signed=1'); box.innerHTML = `<pre class="signed">${esc(a.text)}\n\nSigned electronically by ${esc(a.signer_name || a.name)} on ${esc(new Date(a.signed_at || a.signedAt).toLocaleString())}.\nFingerprint (SHA-256): ${esc(a.sha256)}</pre>`; } catch (err) { box.textContent = err.message; }
    };
    const sc = root.querySelector('#scope');
    sc.hidden = !c.scope.length;
    root.querySelector('#scopelist').innerHTML = c.scope.map((s) => `<li>${esc(s)}</li>`).join('');
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
        ${ag.reason === 'changed' ? '<p class="error">Your package changed since you signed, so here is the updated agreement.</p>' : ''}
        <p class="muted">This is the agreement for your website: what's included, the price, and how changes and launch work. Once it's signed, this page opens up for planning your site together.</p>
      </section>
      <section class="card agreement"><h2>${esc(ag.current.title)}</h2>${agreementHtml(ag.current)}</section>
      <section class="card" id="signbox">
        <h2>Sign</h2>
        <label for="signname">Your full name</label>
        <input type="text" id="signname" autocomplete="name" placeholder="First and last name">
        <label class="check"><input type="checkbox" id="signagree"> I agree to this agreement, and to signing it electronically.</label>
        <label class="check"><input type="checkbox" id="signportfolio"> It's OK to show my finished site on Steadfast Code's Work page.</label><span class="help">Optional, and separate from the agreement.</span>
        <p><button type="button" class="primary" id="signbtn" disabled>Sign and continue</button> <span id="signnote" class="muted"></span></p>
      </section>`;
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

  function agreementLine() {
    const ag = P.agreement;
    if (!ag) return '';
    if (ag.signed?.valid) return `<p class="muted">Agreement signed by ${esc(ag.signed.name)}, ${esc(new Date(ag.signed.signedAt).toLocaleString())}${ag.signed.portfolioOk === 1 ? ' · OK to show on the Work page' : ag.signed.portfolioOk === 0 ? ' · not on the Work page' : ''}. <a href="#" data-signed>View the signed copy</a></p><div id="signedcopy"></div>`;
    if (!admin) return '';
    if (ag.reason === 'no-package') return '<p class="muted">Agreement: picks up the package once it’s set.</p>';
    return `<p class="${ag.reason === 'changed' ? 'error' : 'muted'}">${ag.reason === 'changed' ? 'The package changed since the agreement was signed; the client will be asked to sign the updated one.' : 'Agreement not signed yet. It shows first on the client’s link; the build waits for it.'}</p>${ag.current ? `<details><summary>Preview what they’ll sign</summary><div class="agreement">${agreementHtml(ag.current)}</div></details>` : ''}`;
  }

  function paintBar() {
    const c = P.check;
    if (admin) {
      readyEl.textContent = c.ready ? (c.scope.length ? `Ready · ${c.scope.length} scope note${c.scope.length === 1 ? '' : 's'}` : 'Ready') : `${c.missing.length} to go`;
      buildBtn.hidden = false;
      buildBtn.disabled = !(c.ready && ['intake', 'preview'].includes(P.status) && !P.agreement?.needed);
      if (c.ready && P.agreement?.needed) readyEl.textContent = 'Ready · waiting on the signed agreement';
      buildBtn.textContent = P.status === 'preview' ? 'Rebuild' : building() ? 'Building…' : P.failed ? 'Restart build' : 'Start build';
    } else {
      readyEl.textContent = building() ? 'Your site is being built' : P.status === 'preview' ? (P.changedSinceBuild ? 'You’ve made changes since this preview' : 'Preview is up to date') : 'Daniel starts the first version';
      buildBtn.hidden = !(P.status === 'preview' || building());
      buildBtn.disabled = building() || !P.changedSinceBuild || !c.ready;
      buildBtn.textContent = building() ? 'Updating…' : 'Update my preview';
    }
  }

  function paintProgress() {
    let html = '';
    if (building() || P.status === 'preview') {
      const step = P.status === 'preview' ? 6 : P.status === 'build-requested' ? 0 : (P.buildStep || 1);
      const steps = `<div class="steps" role="progressbar" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${step}" aria-label="Build progress">${STEPS.map((_, i) => `<span class="${i + 1 < step || step === 6 ? 'done' : i + 1 === step ? 'now' : ''}"></span>`).join('')}</div>`;
      const details = building()
        ? `<div class="muted">${step === 0 ? 'Waiting for the build to start' : `Step ${step} of 6: ${STEPS[step - 1]}`}${P.buildStartedAt ? ` · <span id="elapsed">${since(P.buildStartedAt)}</span>` : ''}</div>${P.buildNote ? `<div class="muted">${esc(P.buildNote)}</div>` : ''}${P.buildActivity ? `<div class="activity">${esc(P.buildActivity)}</div>` : ''}`
        : `<div class="muted">Preview ready · <a href="${esc(P.previewUrl || '#')}" target="_blank" rel="noopener">open it</a></div>`;
      html = `${steps}<div class="in"><div class="details">${details}</div></div>`;
    }
    progress.hidden = !html;
    if (html) progress.innerHTML = html;
  }

  function paintLink() {
    const el = root.querySelector('#linkcard');
    const l = P.clientLink;
    el.innerHTML = `<h2>Client link</h2>
      ${newLink ? `<p class="muted">Send this to them. It's shown only now; if it gets lost, make a new one (the old one stops working).</p><input type="text" readonly value="${esc(newLink)}" id="linkurl"><p><button type="button" id="copylink">Copy</button> ${navigator.share ? '<button type="button" id="sharelink">Share…</button>' : ''}</p>` : ''}
      ${l ? `<p class="muted">On · made ${esc(ago(l.createdAt))} · ${l.lastUsedAt ? `last opened ${esc(ago(l.lastUsedAt))}` : 'not opened yet'} · works until ${esc(new Date(l.expiresAt).toLocaleDateString())}</p>` : '<p class="muted">No link yet. A link lets them see and fill in this same page, upload photos, and watch the build.</p>'}
      <p><button type="button" id="makelink">${l ? 'Make a new link' : 'Make a link'}</button> ${l ? '<button type="button" id="killlink">Turn it off</button>' : ''}</p>`;
    el.querySelector('#makelink').onclick = async () => { try { newLink = (await api(routes.link, { method: 'POST', body: '{}' })).url; await refresh(); } catch (e) { alert(e.message); } };
    const kill = el.querySelector('#killlink');
    if (kill) kill.onclick = async () => { if (!confirm('Turn the client link off? Their page stops working until you make a new one.')) return; newLink = null; await api(routes.link, { method: 'DELETE' }); await refresh(); };
    const copy = el.querySelector('#copylink');
    if (copy) copy.onclick = async () => { await navigator.clipboard.writeText(newLink); copy.textContent = 'Copied'; };
    const share = el.querySelector('#sharelink');
    if (share) share.onclick = () => navigator.share({ title: 'Your website', text: 'Here’s the page for your new website.', url: newLink }).catch(() => {});
  }

  function paintFiles() {
    const key = JSON.stringify([P.uploads, P.uploadsReady]);
    if (key === lastUploads) return;
    lastUploads = key;
    const el = root.querySelector('#files');
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
    const key = JSON.stringify(P.events);
    if (key === lastEvents) return;
    lastEvents = key;
    root.querySelector('#activity').innerHTML = `<h2>Activity</h2>${P.events.length ? `<ul class="events">${P.events.map((e) => `<li><span class="muted">${esc(ago(e.at))}</span> ${esc(e.what)}</li>`).join('')}</ul>` : '<p class="muted">Nothing yet.</p>'}`;
  }

  // ---- saving ----
  function queue(field, value, now) {
    pending[field] = value;
    localEditAt[field] = Date.now();
    savedEl.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, now ? 0 : 700);
  }

  async function flush() {
    const patch = pending;
    pending = {};
    if (!Object.keys(patch).length) return;
    try {
      const r = await api(routes.project, { method: 'PATCH', body: JSON.stringify({ answers: patch }) });
      savedEl.textContent = Object.keys(pending).length ? 'Saving…' : 'Saved';
      apply(r);
    } catch (e) {
      pending = { ...patch, ...pending };
      savedEl.innerHTML = '<span class="error">Not saved</span>';
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
    if (gated()) return;
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
  bar.hidden = false;
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
