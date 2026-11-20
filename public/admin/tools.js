// The admin pages' own two switches (2026-11-20), in the header beside the page links:
//
//   Theme   Auto (the device's setting) → Light → Dark. Saved in this browser under the same key
//           the main site and the client's page use, and applied before paint by ThemeBoot.astro.
//   Layout  on the project page (/admin) only: one readable column, or the cards across the whole
//           page (public/intake/form.css, body.layout-grid). Shown where there's room for it.
//
// Plain script, loaded with `defer` on every admin page, so it runs once the header exists.
(() => {
  const header = document.querySelector('.admin-head .in');
  if (!header) return;

  const stored = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const store = (key, value) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the choice lasts until the page is left.
    }
  };

  const tools = document.createElement('div');
  tools.className = 'head-tools';
  header.appendChild(tools);

  // ---- the layout switch, on the project page ----
  const onProjectPage = /^\/admin\/?$/.test(location.pathname);
  if (onProjectPage) {
    const layout = document.createElement('button');
    layout.type = 'button';
    layout.id = 'layouttoggle';
    tools.appendChild(layout);
    const isGrid = () => stored('adminLayout') === 'grid';
    const show = () => {
      document.body.classList.toggle('layout-grid', isGrid());
      layout.setAttribute('aria-pressed', String(isGrid()));
      layout.textContent = isGrid() ? 'Single column' : 'Use the whole page';
    };
    layout.addEventListener('click', () => {
      store('adminLayout', isGrid() ? 'column' : 'grid');
      show();
    });
    show();
  }

  // ---- the theme switch, on every admin page ----
  const THEMES = ['auto', 'light', 'dark'];
  const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  const root = document.documentElement;
  const current = () => (THEMES.includes(root.dataset.theme) ? root.dataset.theme : 'auto');

  const theme = document.createElement('button');
  theme.type = 'button';
  theme.id = 'themetoggle';
  theme.setAttribute('aria-live', 'polite');
  tools.appendChild(theme);
  const showTheme = () => { theme.textContent = `Theme: ${LABEL[current()]}`; };
  theme.addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length];
    if (next === 'auto') delete root.dataset.theme;
    else root.dataset.theme = next;
    store('theme', next === 'auto' ? null : next);
    showTheme();
  });
  showTheme();
})();
