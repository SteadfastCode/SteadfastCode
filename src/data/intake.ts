// The admin intake (2026-11-01): every question Daniel asks a client about a new site, in the order
// he asks them, starting with the package. The /admin page renders its form from this file and the
// server (server/intake.js) validates answers and checks scope against it, so a question added here
// shows up and is saved in both places.
//
// Field types: text, email, tel, textarea, list (one item per line), choice (`options`), bool,
// tier (the website packages from site.ts), pages (a list counted against the package's pages),
// hours ({ mode: 'set' | '247' | 'appointment', days: { mon: { open: '08:00', close: '17:00' } … },
// note } — structured so a client site can publish it as Google's opening-hours data).
// `required` fields are the minimum to start a first version; everything else improves it.
// A section with `tiers` only shows for those packages.
//
// Shared with the client (2026-11-01): their page at /client shows this same form, live, and they
// can edit every field except the ones marked `owner: 'daniel'` — the package and everything that
// sets the scope and price, which they can see but only Daniel changes. Nothing is hidden from them;
// Daniel's call, to build trust. `you` is the question as the client reads it, where the wording
// differs from Daniel's ("Who their customers are" → "Who your customers are").

export const intakeSections = [
  {
    id: 'package',
    title: 'Package',
    fields: [
      { id: 'tier', label: 'Package', type: 'tier', required: true, owner: 'daniel' },
      { id: 'editor', label: 'Add the content editor', type: 'bool', help: 'One-time add-on for Starter and Business. Growth and Store include it.', tiers: ['starter', 'business'], owner: 'daniel' },
    ],
  },
  {
    id: 'business',
    title: 'The business',
    fields: [
      { id: 'businessName', label: 'Business name', type: 'text', required: true },
      { id: 'contactName', label: 'Contact name', type: 'text', required: true, you: 'Your name' },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: 'Phone', type: 'tel' },
      { id: 'currentSite', label: 'Current website', type: 'text', you: 'Your current website, if you have one' },
      { id: 'domain', label: 'Domain for the new site', type: 'text', help: 'Do they already own it?', you: 'The web address you want' },
      { id: 'serviceArea', label: 'Where they work', type: 'textarea', required: true, help: 'Towns, a radius, or the address if customers come to them.', you: 'Where you work' },
      { id: 'showAddress', label: 'Customers come to them (show the address)', type: 'bool', you: 'Customers come to you (show your address)' },
      { id: 'hours', label: 'Hours', type: 'hours', help: 'Days open with open and close times, or 24/7, or by appointment.' },
    ],
  },
  {
    id: 'offer',
    title: 'What they sell',
    fields: [
      { id: 'services', label: 'Services or products', type: 'list', required: true, help: 'One per line.', you: 'What you offer' },
      { id: 'mainAction', label: 'The one thing a visitor should do', type: 'choice', options: ['Call', 'Text', 'Fill out a form', 'Book online', 'Buy online', 'Visit in person'], you: 'The one thing you want visitors to do' },
      { id: 'bookingLink', label: 'Booking or scheduling link', type: 'text', help: 'If they book online: the page people book on.', you: 'Your booking link' },
      { id: 'customers', label: 'Who their customers are', type: 'textarea', you: 'Who your customers are' },
      { id: 'different', label: 'Why people pick them', type: 'textarea', you: 'Why people pick you' },
    ],
  },
  {
    id: 'pages',
    title: 'Pages',
    fields: [
      { id: 'pages', label: 'Pages', type: 'pages', required: true, help: 'One per line. Counted against the package.', owner: 'daniel', you: 'Pages on your site' },
    ],
  },
  {
    id: 'look',
    title: 'Look and feel',
    fields: [
      { id: 'logo', label: 'Logo', type: 'choice', options: ['Have one, will send', 'Need one', 'Just use the name'], you: 'Your logo' },
      { id: 'colors', label: 'Colors', type: 'text' },
      { id: 'sitesLiked', label: 'Sites they like', type: 'list', help: 'Links, one per line.', you: 'Websites you like the look of' },
      { id: 'tone', label: 'How they want to sound', type: 'text', you: 'How you want to sound' },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    fields: [
      { id: 'copy', label: 'Who writes the words', type: 'choice', options: ['They do', 'I draft, they edit', 'I write it'], you: 'Who writes the words' },
      { id: 'ownWords', label: 'In their own words', type: 'textarea', help: 'Anything they want the site to say, however rough: about them, how they work, what to promise.', you: 'Anything you want the site to say' },
      { id: 'photos', label: 'Photos', type: 'choice', options: ['They have good ones', 'Some, need more', 'None yet'], you: 'Your photos' },
      { id: 'reviews', label: 'Where their reviews are', type: 'text', help: 'Google, Facebook, Yelp…', you: 'Where your reviews are' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and access',
    fields: [
      { id: 'registrar', label: 'Where the domain is registered', type: 'text', you: 'Where your domain is registered' },
      { id: 'gbp', label: 'Google Business Profile', type: 'choice', options: ['Claimed, they have access', 'Exists, not claimed', 'None yet'], you: 'Your Google Business Profile' },
      { id: 'formsTo', label: 'Where form messages should go', type: 'text', help: 'An email address, or a phone for texts.', you: 'Where messages from the site should go' },
    ],
  },
  {
    id: 'growth',
    title: 'Growth extras',
    tiers: ['growth', 'store'],
    fields: [
      { id: 'integrations', label: 'Tools to connect', type: 'list', help: 'Scheduling, CRM, newsletter, payments. One per line.', you: 'Tools you want connected' },
      { id: 'blogTopics', label: 'First blog topics', type: 'list', you: 'First blog topics' },
    ],
  },
  {
    id: 'store',
    title: 'Store',
    tiers: ['store'],
    fields: [
      { id: 'productCount', label: 'How many products', type: 'text', you: 'How many products' },
      { id: 'platform', label: 'Platform', type: 'choice', options: ['Shopify', 'Headless', 'Not sure'] },
    ],
  },
  {
    id: 'extras',
    title: 'Outside the package',
    fields: [
      { id: 'outOfScope', label: 'Asked for, not covered', type: 'list', help: 'Anything past the package, one per line. Quoted separately before it is built.', owner: 'daniel', you: 'Asked for, outside the package' },
      { id: 'notes', label: 'Notes', type: 'textarea', you: 'Notes' },
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
