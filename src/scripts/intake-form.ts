// The half of /admin and /client that is the same (2026-11-19). Both pages mount the one project
// form — the same questions, scope notes, price, files and build progress — so both read the
// config their page embedded as JSON and both load the form the same way. This module is the typed
// door to it; what differs (Daniel's project list, the client's private link) stays on each page.
//
// The form itself is public/intake/project.js, plain JavaScript in public/ rather than a module in
// src/: both pages fetch the one copy by a versioned address (?v=<build>) that public/_headers
// keeps revalidating, so a deploy never leaves a page running yesterday's form.

/** One website package as the pages show it: the name, the price, what it covers. */
export type ConfigTier = {
  id: string;
  name: string;
  price: number;
  from: boolean;
  scope: { pages: number };
  /** Who the package is for; only Daniel's page has it. */
  who?: string;
};

/**
 * What a page embeds in its `intake-config` tag, built from src/data at build time, so the page
 * and the server (server/intake.js) can't disagree about the questions or the prices.
 *
 * Only `script` and `tiers` are read here or on the pages; the rest is the form's own business and
 * is passed through to it as it stands.
 */
export type IntakeConfig = {
  /** Where the form is, with this build's version on it. */
  script: string;
  tiers: ConfigTier[];
  sections: unknown[];
  siteTypes: unknown[];
  editorPrice: number | null;
  discounts: number[];
  defaultPages?: unknown;
  placeholders?: unknown;
};

/** Where the form reads and writes: admin's are one project's URLs, the client's are their own. */
export type ProjectRoutes = {
  project: string;
  presence: string;
  uploads: string;
  /** A picture's address. An <img> can't send a header, so the client's carries their token. */
  file: (id: string, forApi?: boolean) => string;
  build: string;
  link?: string;
  review?: string;
  agreement?: string;
  signing?: string;
  care?: string;
  messages?: string;
  library?: string;
};

export type MountOptions = {
  /** Where the form goes. */
  root: HTMLElement;
  /** The fixed bottom bar, with #saved, #readiness and #build inside it. */
  bar: HTMLElement;
  /** The full-width sticky progress strip. */
  progress: HTMLElement;
  config: IntakeConfig;
  mode: 'admin' | 'client';
  routes: ProjectRoutes;
  /** Extra request headers: the client's link, as a bearer token. */
  headers?: Record<string, string>;
  /** A back link, on Daniel's side. */
  backHref?: string;
};

/** A mounted form. `stop()` saves what is pending and drops its timers and presence. */
export type MountedProject = {
  stop: () => void;
  flush?: () => void;
};

/** public/intake/project.js, as the two pages use it. */
export type ProjectForm = {
  mountProject: (options: MountOptions) => Promise<MountedProject>;
  /** The sticky progress strip: wire it once per page, not once per project. */
  wireProgress: (progress: HTMLElement) => void;
};

/** The config out of the page's `intake-config` tag (test/admin.test.js reads the same tag). */
export function readIntakeConfig(): IntakeConfig {
  return JSON.parse(document.getElementById('intake-config')!.textContent!);
}

/** The form, from the address in the config. Vite leaves the import alone: it is a run-time URL. */
export async function loadProjectForm(config: IntakeConfig): Promise<ProjectForm> {
  return await import(/* @vite-ignore */ config.script);
}
