// The admin intake (2026-11-01): every question Daniel asks a client about a new site, in the order
// he asks them, starting with the package. The /admin page renders its form from this file and the
// server (server/intake.js) validates answers and checks scope against it, so a question added here
// shows up and is saved in both places.
//
// Field types: text, email, tel, textarea, list (one item per line), choice (`options`), bool,
// tier (the website packages from site.ts), pages (a list counted against the package's pages).
// `required` fields are the minimum to start a first version; everything else improves it.
// A section with `tiers` only shows for those packages.

export const intakeSections = [
  {
    id: 'package',
    title: 'Package',
    fields: [
      { id: 'tier', label: 'Package', type: 'tier', required: true },
      { id: 'editor', label: 'Add the content editor', type: 'bool', help: 'One-time add-on for Starter and Business. Growth and Store include it.', tiers: ['starter', 'business'] },
    ],
  },
  {
    id: 'business',
    title: 'The business',
    fields: [
      { id: 'businessName', label: 'Business name', type: 'text', required: true },
      { id: 'contactName', label: 'Contact name', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: 'Phone', type: 'tel' },
      { id: 'currentSite', label: 'Current website', type: 'text' },
      { id: 'domain', label: 'Domain for the new site', type: 'text', help: 'Do they already own it?' },
      { id: 'serviceArea', label: 'Where they work', type: 'textarea', required: true, help: 'Towns, a radius, or the address if customers come to them.' },
      { id: 'showAddress', label: 'Customers come to them (show the address)', type: 'bool' },
      { id: 'hours', label: 'Hours', type: 'textarea' },
    ],
  },
  {
    id: 'offer',
    title: 'What they sell',
    fields: [
      { id: 'services', label: 'Services or products', type: 'list', required: true, help: 'One per line.' },
      { id: 'mainAction', label: 'The one thing a visitor should do', type: 'choice', options: ['Call', 'Text', 'Fill out a form', 'Book online', 'Buy online', 'Visit in person'] },
      { id: 'customers', label: 'Who their customers are', type: 'textarea' },
      { id: 'different', label: 'Why people pick them', type: 'textarea' },
    ],
  },
  {
    id: 'pages',
    title: 'Pages',
    fields: [
      { id: 'pages', label: 'Pages', type: 'pages', required: true, help: 'One per line. Counted against the package.' },
    ],
  },
  {
    id: 'look',
    title: 'Look and feel',
    fields: [
      { id: 'logo', label: 'Logo', type: 'choice', options: ['Have one, will send', 'Need one', 'Just use the name'] },
      { id: 'colors', label: 'Colors', type: 'text' },
      { id: 'sitesLiked', label: 'Sites they like', type: 'list', help: 'Links, one per line.' },
      { id: 'tone', label: 'How they want to sound', type: 'text' },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    fields: [
      { id: 'copy', label: 'Who writes the words', type: 'choice', options: ['They do', 'I draft, they edit', 'I write it'] },
      { id: 'photos', label: 'Photos', type: 'choice', options: ['They have good ones', 'Some, need more', 'None yet'] },
      { id: 'reviews', label: 'Where their reviews are', type: 'text', help: 'Google, Facebook, Yelp…' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and access',
    fields: [
      { id: 'registrar', label: 'Where the domain is registered', type: 'text' },
      { id: 'gbp', label: 'Google Business Profile', type: 'choice', options: ['Claimed, they have access', 'Exists, not claimed', 'None yet'] },
      { id: 'formsTo', label: 'Where form messages should go', type: 'text', help: 'An email address, or a phone for texts.' },
    ],
  },
  {
    id: 'growth',
    title: 'Growth extras',
    tiers: ['growth', 'store'],
    fields: [
      { id: 'integrations', label: 'Tools to connect', type: 'list', help: 'Scheduling, CRM, newsletter, payments. One per line.' },
      { id: 'blogTopics', label: 'First blog topics', type: 'list' },
    ],
  },
  {
    id: 'store',
    title: 'Store',
    tiers: ['store'],
    fields: [
      { id: 'productCount', label: 'How many products', type: 'text' },
      { id: 'platform', label: 'Platform', type: 'choice', options: ['Shopify', 'Headless', 'Not sure'] },
    ],
  },
  {
    id: 'extras',
    title: 'Outside the package',
    fields: [
      { id: 'outOfScope', label: 'Asked for, not covered', type: 'list', help: 'Anything past the package, one per line. Quoted separately before it is built.' },
      { id: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
] as const;

// Default pages offered when a package is picked and the list is still empty. Suggestions only.
export const defaultPages = {
  starter: ['Home'],
  business: ['Home', 'Services', 'About', 'Contact'],
  growth: ['Home', 'Services', 'About', 'Contact', 'Blog'],
  store: ['Home', 'Shop', 'About', 'Contact'],
} as const;
