// The Steadfast Code admin app (2026-11-04): the admin pages run inside an Android shell (app/, a
// Capacitor WebView on steadfastcode.tech, like Tethered). In the app this registers the phone for
// push, shows pushes that arrive with the app open, opens a tapped notification's page, and keeps
// the app itself up to date (in-app updates, like Plumb's). In a browser it does nothing. The
// plugins come from the shell (window.Capacitor.Plugins), so no build step here.
(() => {
  const C = window.Capacitor;
  if (!C?.isNativePlatform?.()) return;
  document.documentElement.classList.add('in-app');
  const { PushNotifications, ApkUpdate, Filesystem } = C.Plugins || {};
  const go = (url) => { if (url && /^https:\/\/steadfastcode\.tech\//.test(url)) location.href = url; };
  const say = (event, detail) => { window['__' + event] = detail; document.dispatchEvent(new CustomEvent(event, { detail })); };

  // ---- a banner at the top, for a push with the app open and for an update that's ready ----
  function banner(title, body, onTap) {
    if (!document.getElementById('pushbanner-style')) {
      const st = document.createElement('style');
      st.id = 'pushbanner-style';
      st.textContent = `.pushbanner{position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:99;display:block;width:auto;text-align:left;font:inherit;padding:12px 14px;border-radius:14px;border:1px solid var(--line,#333);background:var(--card,#1d232c);color:var(--ink,#e9ecf2);box-shadow:0 10px 30px -10px rgb(0 0 0/.6);transition:opacity .3s,transform .3s}.pushbanner b{display:block}.pushbanner span{display:block;color:var(--muted,#a9b2bf);font-size:.92rem;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3}.pushbanner.gone{opacity:0;transform:translateY(-12px)}`;
      document.head.appendChild(st);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pushbanner';
    b.setAttribute('role', 'status');
    b.innerHTML = '<b></b><span></span>';
    b.querySelector('b').textContent = title;
    b.querySelector('span').textContent = body;
    b.addEventListener('click', () => { b.remove(); onTap?.(); });
    document.body.appendChild(b);
    setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 400); }, 8000);
  }

  // ---- push ----
  // Only a build with Firebase in it can register (app/build-on-box.sh marks the user agent): in one
  // without, PushNotifications.register() crashes the app instead of failing.
  async function registerPush() {
    if (!PushNotifications) return;
    if (!/SteadfastCodeApp\/\d+ push\b/.test(navigator.userAgent)) { say('pushstatus', 'This build of the app has no notifications yet.'); return; }
    if (!window.__pushWired) {
      window.__pushWired = true;
      PushNotifications.addListener('registration', async (t) => {
        try {
          const r = await fetch('/api/admin/devices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t.value, label: navigator.userAgent.match(/Android[^;)]*;[^;)]*/)?.[0] || 'Android' }) });
          say('pushstatus', r.ok ? 'Notifications are on for this phone.' : 'Couldn’t save this phone for notifications.');
        } catch { say('pushstatus', 'Couldn’t save this phone for notifications.'); }
      });
      PushNotifications.addListener('registrationError', () => say('pushstatus', 'Couldn’t register for notifications.'));
      // With the app open Android doesn't show the notification itself, so it shows here as a banner
      // (not a local notification: on Android 14 those ask for "Alarms & reminders").
      PushNotifications.addListener('pushNotificationReceived', (n) => banner(n.title || n.data?.title || 'Steadfast Code', n.body || n.data?.body || '', () => go(n.data?.url)));
      PushNotifications.addListener('pushNotificationActionPerformed', (a) => go(a.notification?.data?.url));
    }
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') { say('pushstatus', 'Notifications are off for this app (Android settings).'); return; }
    // The channel the box's pushes name (scripts/push.mjs), high importance so they pop up.
    try { await PushNotifications.createChannel({ id: 'steadfast_alerts', name: 'Alerts', importance: 4, visibility: 1 }); } catch {}
    await PushNotifications.register();
  }

  // ---- updates (like Plumb's: web/app/src/lib/native/apk-decision.ts there) ----
  // The box publishes builds (app/build-on-box.sh --publish); this compares, downloads natively with
  // a ten-minute link (/api/admin/app-apk), and hands the file to Android's installer, which asks
  // once to confirm. Refused before downloading: a build that isn't newer, or one signed with a
  // different key (Android would fail it, and only an uninstall gets past that).
  const digest = (v) => String(v ?? '').replace(/[^0-9a-f]/gi, '').toLowerCase();
  let pending = null;
  async function checkUpdate() {
    if (!ApkUpdate) { say('apkstatus', { text: 'This build can’t update itself. Install the current one by hand once; after that it can.' }); return null; }
    try {
      const installed = await ApkUpdate.currentVersion();
      const here = `${installed.versionName} (${installed.versionCode})`;
      const r = await fetch('/api/admin/app-apk', { cache: 'no-store' });
      if (r.status === 404) { say('apkstatus', { text: `App ${here}. No newer build published.` }); return null; }
      if (!r.ok) throw new Error(`the server answered ${r.status}`);
      const m = await r.json();
      if (m.versionCode <= installed.versionCode) { say('apkstatus', { text: `App ${here}, the current build.` }); return null; }
      if (digest(m.signerSha256) && digest(installed.signerSha256) && digest(m.signerSha256) !== digest(installed.signerSha256)) {
        say('apkstatus', { text: `Build ${m.versionName} is signed with a different key than this app, so Android can’t update it in place. Uninstall, then install it by hand once.` });
        return null;
      }
      pending = { m, installed };
      const size = `${(m.size / 1048576).toFixed(1)} MB`;
      say('apkstatus', installed.canInstall
        ? { text: `Update ready: ${m.versionName} (this phone has ${here}). ${size}.`, action: 'Install' }
        : { text: `Update ready: ${m.versionName}. First, let Steadfast Code install apps (Android asks once).`, action: 'Allow installs' });
      return pending;
    } catch (e) { say('apkstatus', { text: `Couldn’t check for an update: ${e.message}` }); return null; }
  }
  async function installUpdate() {
    if (!pending) return;
    if (!pending.installed.canInstall) { await ApkUpdate.openInstallPermissionSettings(); return; }
    try {
      say('apkstatus', { text: 'Downloading the update…' });
      // A fresh link: the one from the check may be past its ten minutes.
      const m = await (await fetch('/api/admin/app-apk', { cache: 'no-store' })).json();
      const file = await Filesystem.downloadFile({ url: m.url, path: 'steadfast-code.apk', directory: 'CACHE' });
      say('apkstatus', { text: 'Handing it to Android…' });
      await ApkUpdate.installApk({ path: file.path, sha256: m.sha256 });
    } catch (e) { say('apkstatus', { text: `The update didn’t install: ${e.message}`, action: 'Try again' }); }
  }
  if (ApkUpdate && !window.__apkWired) {
    window.__apkWired = true;
    ApkUpdate.addListener('apkInstallStatus', (s) => say('apkstatus', { text: s.outcome === 'failed' ? `The update didn’t install: ${s.message}` : s.message, ...(s.outcome === 'failed' ? { action: 'Try again' } : {}) }));
    // Back from Android's "install unknown apps" screen (or anywhere else): look again.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  }
  window.__apk = { check: checkUpdate, install: installUpdate };

  // ---- the menu (2026-11-04): ☰ in the header instead of the row of tabs, with the pages, the app's
  // own settings (build and updates, notifications) and sign out. Only in the app: in a browser the
  // header stays as it is. ----
  function buildMenu() {
    const head = document.querySelector('.admin-head .in');
    if (!head || document.getElementById('appmenu')) return;
    const st = document.createElement('style');
    st.textContent = `html.in-app .admin-head nav{display:none}
      .menubtn{font:inherit;font-size:1.35rem;line-height:1;padding:6px 12px;border-radius:10px;background:none;border:1px solid var(--line);color:var(--ink)}
      .appmenu{position:fixed;inset:0;z-index:50;visibility:hidden}.appmenu.open{visibility:visible}
      .appmenu .shade{position:absolute;inset:0;background:rgb(0 0 0/.45);opacity:0;transition:opacity .2s}.appmenu.open .shade{opacity:1}
      .appmenu .panel{position:absolute;top:0;right:0;bottom:0;width:min(330px,88vw);background:var(--card);border-left:1px solid var(--line);overflow-y:auto;transform:translateX(100%);transition:transform .2s;padding:0 0 24px}
      .appmenu.open .panel{transform:none}
      .appmenu .top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)}
      .appmenu .top b{font-size:1.05rem}.appmenu .top button{font-size:1.3rem;line-height:1;padding:4px 10px}
      .appmenu nav{display:grid;padding:8px}.appmenu nav a{padding:12px;border-radius:10px;color:var(--ink);text-decoration:none;font-weight:600}
      .appmenu nav a[aria-current="page"]{background:var(--hover);box-shadow:inset 3px 0 0 var(--accent)}
      .appmenu h3{margin:14px 16px 6px;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
      .appmenu .set{margin:0 16px 10px;padding:12px;border:1px solid var(--line);border-radius:12px;display:grid;gap:8px}
      .appmenu .set p{margin:0;font-size:.92rem}.appmenu .set .row{display:flex;gap:8px;flex-wrap:wrap}
      .appmenu .set button{font-size:.88rem;padding:6px 12px}
      .appmenu .out{display:block;margin:16px;color:var(--muted)}`;
    document.head.appendChild(st);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'menubtn'; btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'appmenu');
    btn.textContent = '☰';
    head.appendChild(btn);
    const links = [...document.querySelectorAll('.admin-head nav a')].map((a) => a.outerHTML).join('');
    const m = document.createElement('div');
    m.id = 'appmenu'; m.className = 'appmenu';
    m.innerHTML = `<div class="shade" data-close></div><div class="panel" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="top"><b>Steadfast Code</b><button type="button" data-close aria-label="Close menu">×</button></div>
      <nav aria-label="Admin">${links}</nav>
      <h3>App</h3><div class="set"><p id="m-apk">Checking for an update…</p><div class="row"><button type="button" id="m-apkgo" hidden></button><button type="button" id="m-apkcheck">Check for updates</button></div></div>
      <h3>Notifications</h3><div class="set"><p id="m-push">Checking…</p><div class="row"><button type="button" id="m-pushtest">Send a test</button></div></div>
      <a class="out" href="/cdn-cgi/access/logout">Sign out</a></div>`;
    document.body.appendChild(m);
    const open = (on) => { m.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); if (on) { m.querySelector('[data-close]').focus?.(); checkUpdate(); } };
    btn.addEventListener('click', () => open(true));
    m.querySelectorAll('[data-close]').forEach((x) => x.addEventListener('click', () => open(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
    const apk = (d) => { if (!d) return; m.querySelector('#m-apk').textContent = d.text; const go = m.querySelector('#m-apkgo'); go.hidden = !d.action; if (d.action) go.textContent = d.action; };
    const push = (t) => { if (t) m.querySelector('#m-push').textContent = t; };
    apk(window.__apkstatus); push(window.__pushstatus);
    document.addEventListener('apkstatus', (e) => apk(e.detail));
    document.addEventListener('pushstatus', (e) => push(e.detail));
    m.querySelector('#m-apkgo').addEventListener('click', () => installUpdate());
    m.querySelector('#m-apkcheck').addEventListener('click', () => { apk({ text: 'Checking…' }); checkUpdate(); });
    m.querySelector('#m-pushtest').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { const r = await fetch('/api/admin/devices/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); push(r.ok ? 'Test sent: it should arrive in a few seconds.' : 'Couldn’t send a test.'); } catch { push('Couldn’t send a test.'); }
      e.target.disabled = false;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildMenu); else buildMenu();

  registerPush().catch(() => say('pushstatus', 'Couldn’t register for notifications.'));
  // A banner once per app start (not on every page) when there's an update to take.
  checkUpdate().then((p) => {
    let shown = false; try { shown = sessionStorage.getItem('apkBanner') === String(p?.m.versionCode); } catch {}
    if (p && !shown) {
      try { sessionStorage.setItem('apkBanner', String(p.m.versionCode)); } catch {}
      banner('App update ready', `Version ${p.m.versionName}. Tap to install.`, () => installUpdate());
    }
  });
})();
