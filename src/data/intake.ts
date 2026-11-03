// The admin intake (2026-11-01): every question Daniel asks a client about a new site, in the order
// he asks them, starting with the package. The /admin page renders its form from this file and the
// server (server/intake.js) validates answers and checks scope against it, so a question added here
// shows up and is saved in both places.
//
// Field types: text, email, tel, textarea, list (one item per line), choice (`options`: a string,
// or { value, you } where `you` is the answer as the client reads it; `value` is what's saved), bool,
// tier (the website packages from site.ts), pages (a list counted against the package's pages),
// hours ({ mode: 'set' | '247' | 'appointment', days: { mon: { open: '08:00', close: '17:00' } … },
// note } — structured so a client site can publish it as Google's opening-hours data).
// `required` fields are the minimum to start a first version; everything else improves it.
// A section with `tiers` only shows for those packages.
//
// Shared with the client (2026-11-01): their page at /client shows this same form, live, and they
// can edit every field except the ones marked `owner: 'daniel'` — the package, the add-on and the
// out-of-scope list, which set the price; they can see them, but only Daniel changes them (the
// out-of-scope list shows to them through the scope card, not as a field: `clientHidden`). Pages
// are theirs to edit too (Daniel, 2026-11-01): going past the package shows a scope note to both
// sides at once, and nothing a client types changes the price. Nothing is hidden from them;
// Daniel's call, to build trust. `you` is the question as the client reads it, where the wording
// differs from Daniel's ("Who their customers are" → "Who your customers are"), and `youHelp` the
// same for the help line under it.

export const intakeSections = [
  {
    id: 'package',
    title: 'Package',
    fields: [
      { id: 'tier', label: 'Package', type: 'tier', required: true, owner: 'daniel' },
      { id: 'editor', label: 'Add the content editor', type: 'bool', help: 'One-time add-on for Starter and Business. Growth and Store include it.', tiers: ['starter', 'business'], owner: 'daniel' },
      // The control is Daniel's only; the client sees the price it makes, in the status line and the contract.
      { id: 'pricing', label: 'Price', type: 'pricing', help: 'A discount off the package price, or a price you set. The contract shows it, and a signed contract asks to be signed again when it changes.', owner: 'daniel', clientHidden: true },
    ],
  },
  {
    id: 'business',
    title: 'The business',
    you: 'Your business',
    fields: [
      { id: 'businessName', label: 'Business name', type: 'text', required: true },
      { id: 'contactName', label: 'Contact name', type: 'text', required: true, you: 'Your name' },
      { id: 'email', label: 'Email', type: 'email', required: true },
      { id: 'phone', label: 'Phone', type: 'tel' },
      { id: 'currentSite', label: 'Current website', type: 'text', you: 'Your current website, if you have one' },
      { id: 'domain', label: 'Domain for the new site', type: 'text', help: 'Do they already own it?', you: 'The web address you want', youHelp: 'Do you already own it? If so, where did you buy it?' },
      { id: 'serviceArea', label: 'Where they work', type: 'textarea', required: true, help: 'Towns, a radius, or the address if customers come to them.', you: 'Where you work', youHelp: 'Towns, a radius, or your address if customers come to you.' },
      { id: 'showAddress', label: 'Customers come to them (show the address)', type: 'bool', you: 'Customers come to you (show your address)' },
      { id: 'hours', label: 'Hours', type: 'hours', help: 'Days open with open and close times, or 24/7, or by appointment.' },
    ],
  },
  {
    id: 'offer',
    title: 'What they sell',
    you: 'What you sell',
    fields: [
      { id: 'services', label: 'Services or products', type: 'list', required: true, help: 'One per line.' },
      { id: 'mainAction', label: 'The one thing a visitor should do', type: 'choice', options: ['Call', 'Text', 'Fill out a form', 'Book online', 'Buy online', 'Visit in person'], you: 'The one thing you want visitors to do' },
      { id: 'bookingLink', label: 'Booking or scheduling link', type: 'text', help: 'If they book online: the page people book on.', you: 'Your booking link', youHelp: 'If customers book with you online, the link to your booking page.' },
      { id: 'customers', label: 'Who their customers are', type: 'textarea', you: 'Who your customers are' },
      { id: 'different', label: 'Why people pick them', type: 'textarea', you: 'Why people pick you' },
    ],
  },
  {
    id: 'pages',
    title: 'Pages',
    fields: [
      { id: 'pages', label: 'Pages', type: 'pages', required: true, help: 'One per line. Counted against the package.', you: 'Pages on your site' },
    ],
  },
  {
    id: 'look',
    title: 'Look and feel',
    fields: [
      { id: 'logo', label: 'Logo', type: 'choice', options: [{ value: 'Have one, will send', you: 'I have one and will send it' }, { value: 'Need one', you: 'I need one' }, { value: 'Just use the name', you: 'Just use my business name' }], you: 'Your logo' },
      { id: 'colors', label: 'Colors', type: 'text' },
      { id: 'sitesLiked', label: 'Sites they like', type: 'list', help: 'Links, one per line.', you: 'Websites you like the look of' },
      { id: 'tone', label: 'How they want to sound', type: 'text', you: 'How you want to sound' },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    fields: [
      { id: 'copy', label: 'Who writes the words', type: 'choice', options: [{ value: 'They do', you: 'I’ll write it myself' }, { value: 'I draft, they edit', you: 'Daniel drafts, I edit' }, { value: 'I write it', you: 'Daniel writes it' }], you: 'Who writes the words' },
      { id: 'ownWords', label: 'In their own words', type: 'textarea', help: 'Anything they want the site to say, however rough: about them, how they work, what to promise.', you: 'Anything you want the site to say', youHelp: 'However rough: about you, how you work, what you promise.' },
      { id: 'photos', label: 'Photos', type: 'choice', options: [{ value: 'They have good ones', you: 'I have good ones' }, { value: 'Some, need more', you: 'Some, but I need more' }, 'None yet'], you: 'Your photos' },
      { id: 'reviews', label: 'Where their reviews are', type: 'text', help: 'Google, Facebook, Yelp…', you: 'Where your reviews are' },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and access',
    fields: [
      { id: 'registrar', label: 'Where the domain is registered', type: 'text', you: 'Where your domain is registered' },
      { id: 'gbp', label: 'Google Business Profile', type: 'choice', options: [{ value: 'Claimed, they have access', you: 'I have one and can log in' }, { value: 'Exists, not claimed', you: 'There’s one, but I can’t log in to it' }, { value: 'None yet', you: 'I don’t have one' }, { value: 'Not sure', you: 'I’m not sure' }], you: 'Your Google Business Profile' },
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
    title: 'Extras and notes',
    you: 'Anything else',
    fields: [
      // Daniel's list of extras he's agreed to price; the client sees each one in "Past the package"
      // (the scope card), so the field itself isn't on their form (2026-11-02: it read as a second,
      // locked request box beside Notes).
      { id: 'outOfScope', label: 'Extras to quote', type: 'list', help: 'What you’ve agreed to price separately, one per line. They see these under “Past the package.”', owner: 'daniel', clientHidden: true },
      { id: 'notes', label: 'Notes', type: 'textarea', you: 'Bigger changes or anything else', youHelp: 'New pages, new features, a different layout: Daniel looks at these himself.' },
    ],
  },
] as const;


// Default pages offered when a package is picked and the list is still empty. Suggestions only.
// What a client's own edits can update on their own, and what comes to Daniel instead (2026-11-02).
// The box updates the preview from anything else a client changes; these never build on their own:
// notes are where bigger asks go, pages change the structure (and can change the scope), and sites
// they like are a redesign. Daniel's own edits aren't sorted; he builds when he means to.
export const reviewFields = ['notes', 'pages', 'sitesLiked'] as const;

export const defaultPages = {
  starter: ['Home'],
  business: ['Home', 'Services', 'About', 'Contact'],
  growth: ['Home', 'Services', 'About', 'Contact', 'Blog'],
  store: ['Home', 'Shop', 'About', 'Contact'],
} as const;
