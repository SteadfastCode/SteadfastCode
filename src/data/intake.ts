// The admin intake (2026-11-01): every question Daniel can ask a client about a new site, in the
// order he asks them, starting with the package. The /admin page renders its form from this file and
// the server (server/intake.js) validates answers and checks scope against it, so a question added
// here shows up and is saved in both places.
//
// Field types: text, url, email, tel, textarea, list (one item per line), choice (`options`: a
// string, or { value, you } where `you` is the answer as the client reads it; `value` is what's
// saved), bool, tier (the website packages from site.ts), pages (a list counted against the
// package's pages), hours ({ mode: 'set' | '247' | 'appointment', days: { mon: { open: '08:00',
// close: '17:00' } … }, note } — structured so a client site can publish it as Google's
// opening-hours data), fieldset (the ids of the questions asked on this project; see below).
// `required` fields are the minimum to start a first version; everything else improves it.
// A section or field with `tiers` only shows for those packages.
// `live` fields are the ones a client still keeps current after launch (2026-11-04): their portal's
// "Your details" tab shows only these, and their edits go straight to the live site.
//
// Which questions a project asks (2026-11-17): the form used to ask every question of every client,
// and a board game publisher got "Where you work" and "Google Business Profile" (Daniel, on the
// Deliverance intake). Now each project has a kind of site (`siteType`, one of `siteTypes`) and a
// set of asked questions: by default the preset for that kind and the package, or the list Daniel
// picks himself in the Questions menu on /admin (`asked`). The client sees only what's asked.
//   `ask`: who gets the question by default. 'always' is asked of everyone and can't be turned off
//   (the package, the name, the pages); 'all' is on for every kind of site; a list of site-type ids
//   is on for those kinds; 'off' waits in the menu until Daniel turns it on. Missing means 'all'.
//   `when`: a field id; the question shows only while that answer is set (what to change from the
//   mock-up needs a mock-up).
//   `wording`: { [siteType]: { label?, you?, help?, youHelp? } }, how the question reads for that
//   kind of site ("Services or products" is "Product lines or collections" on a store). A section
//   takes `wording: { [siteType]: { title?, you? } }` the same way.
//
//   `place`: 'links' puts the field on the Client links card on /admin, with the client's portal
//   link, in place of its own section (2026-11-24: the mock-up and lab links; Daniel, "they should
//   all be in one place").
//
// Shared with the client (2026-11-01): their page at /client shows this same form, live, and they
// can edit every field except the ones marked `owner: 'daniel'` — the package, the add-on, the
// kind of site, the question list, the mock-up link and the out-of-scope list, which set the price
// or the shape of the form; they can see the package, and only Daniel changes it (the rest shows to
// them through the status and scope cards, not as fields: `clientHidden`). Pages are theirs to
// edit too (Daniel, 2026-11-01): going past the package shows a scope note to both sides at once,
// and nothing a client types changes the price. Nothing is hidden from them; Daniel's call, to
// build trust. `you` is the question as the client reads it, where the wording differs from
// Daniel's ("Who their customers are" → "Who your customers are"), and `youHelp` the same for the
// help line under it.

/**
 * The kinds of site, each a preset of questions. `who` is the one-line hint in the Questions menu.
 * A new project is 'local' unless the package is the Online store, which is 'store'.
 */
export const siteTypes = [
  { id: 'local', name: 'Local service', who: 'Goes to the customer: plumber, handyman, landscaper, cleaner.' },
  { id: 'storefront', name: 'Shop or restaurant', who: 'Customers come in: a store, café, salon, studio.' },
  { id: 'professional', name: 'Office or practice', who: 'Appointments and credentials: law, accounting, therapy, dental.' },
  { id: 'church', name: 'Church or nonprofit', who: 'Service times, giving, ministries, events.' },
  { id: 'creative', name: 'Portfolio or personal brand', who: 'Photographer, artist, author, musician, maker.' },
  { id: 'store', name: 'Online store', who: 'Ships products: a shop with a cart and checkout.' },
] as const;

export type SiteType = (typeof siteTypes)[number]['id'];

// The kinds people visit or call locally: the address, hours and Google Business Profile questions,
// and the contract's map and local-SEO lines (agreement.ts).
export const LOCAL_KINDS = ['local', 'storefront', 'professional', 'church'];

export const intakeSections = [
  {
    id: 'package',
    title: 'Package',
    fields: [
      { id: 'tier', label: 'Package', type: 'tier', required: true, owner: 'daniel', ask: 'always' },
      { id: 'editor', label: 'Add the content editor', type: 'bool', help: 'One-time add-on for Starter and Business. Growth and Store include it.', tiers: ['starter', 'business'], owner: 'daniel', ask: 'always' },
      // The control is Daniel's only; the client sees the price it makes, in the status line and the contract.
      { id: 'pricing', label: 'Price', type: 'pricing', help: 'A discount off the package price, or a price you set. The contract shows it, and a signed contract asks to be signed again when it changes.', owner: 'daniel', clientHidden: true, ask: 'always' },
      // The kind of site and the questions asked: both painted by the Questions menu on /admin, not as fields.
      { id: 'siteType', label: 'Kind of site', type: 'choice', options: siteTypes.map((t) => t.id), owner: 'daniel', clientHidden: true, ask: 'always', menu: true },
      { id: 'asked', label: 'Questions asked', type: 'fieldset', owner: 'daniel', clientHidden: true, ask: 'always', menu: true },
      // Daniel's edits to the contract (src/data/agreement.ts), made in the Contract pane on /admin.
      { id: 'contract', label: 'Contract', type: 'contract', owner: 'daniel', clientHidden: true, ask: 'always', menu: true },
      // A mock-up built for the lead (2026-11-09) comes along when the project starts from it; both sides
      // see "Open the mock-up" on the status card, and the look-and-feel questions start from it.
      { id: 'mockUrl', label: 'Mock-up link', type: 'url', help: 'Filled in from the lead when there is one. Both sides get an Open the mock-up button, and Look and feel asks what to change from it.', owner: 'daniel', clientHidden: true, ask: 'always', place: 'links' },
      // A lab (2026-11-24, first for Deliverance): a page where pieces of the site are tried out
      // before they go on the mock-up or the preview. Both sides get an Open the lab button beside
      // the mock-up or preview one; the lab itself links back to the full site.
      { id: 'labUrl', label: 'Lab link', type: 'url', help: 'A page of pieces being tried out for this client, if there is one. Both sides get an Open the lab button. Leave it empty until the lab is ready for the client to see.', owner: 'daniel', clientHidden: true, ask: 'always', place: 'links' },
    ],
  },
  {
    id: 'business',
    title: 'The business',
    you: 'Your business',
    wording: { church: { title: 'The church', you: 'Your church' }, creative: { title: 'About them', you: 'About you' } },
    fields: [
      { id: 'businessName', label: 'Business name', type: 'text', required: true, live: true, ask: 'always', wording: { church: { label: 'Church or organization name' }, creative: { label: 'Their name, or the name they work under', you: 'Your name, or the name you work under' } } },
      { id: 'contactName', label: 'Contact name', type: 'text', required: true, you: 'Your name', live: true, ask: 'always' },
      { id: 'people', label: 'Who’s behind the business', type: 'list', help: 'Everyone to name on the site, one per line, the contact included; a role after a comma if they want one (Nicole Cesavice, co-owner). Empty means just the contact.', you: 'Who’s behind the business', youHelp: 'Everyone you’d like named on the site, one per line, yourself included. Add a role after a comma if you like.', live: true, wording: { church: { label: 'Pastors and staff to name', help: 'One per line, a role after a comma (Mark Lee, lead pastor).', youHelp: 'One per line, a role after a comma (Mark Lee, lead pastor).' }, store: { label: 'Who’s behind the brand' }, creative: { label: 'Anyone else to name', help: 'Collaborators, a manager, an agent; one per line. Empty means just the contact.', youHelp: 'Collaborators, a manager, an agent; one per line. Empty means just you.' } } },
      { id: 'email', label: 'Email', type: 'email', required: true, live: true, ask: 'always' },
      { id: 'phone', label: 'Phone', type: 'tel', live: true },
      { id: 'founded', label: 'When the business started', type: 'text', help: 'A year is plenty. Only goes on the site if it’s given here.', you: 'When you started', youHelp: 'A year is plenty.', ask: LOCAL_KINDS, wording: { church: { label: 'When the church was founded', you: 'When the church was founded' } } },
      { id: 'currentSite', label: 'Current website', type: 'text', you: 'Your current website, if you have one' },
      { id: 'domain', label: 'Domain for the new site', type: 'text', help: 'Do they already own it?', you: 'The web address you want', youHelp: 'Do you already own it? If so, where did you buy it?' },
      { id: 'serviceArea', label: 'Where they work', type: 'textarea', required: true, help: 'Towns, a radius, or the address if customers come to them.', you: 'Where you work', youHelp: 'Towns, a radius, or your address if customers come to you.', live: true, ask: LOCAL_KINDS, wording: { storefront: { label: 'Address and the area they serve', help: 'The street address, and the towns people come from.', you: 'Your address and the area you serve', youHelp: 'Your street address, and the towns people come from.' }, professional: { label: 'Address and the area they serve', help: 'The street address, and the towns clients come from.', you: 'Your address and the area you serve', youHelp: 'Your street address, and the towns clients come from.' }, church: { label: 'Address', help: 'The street address, and the towns people come from.', you: 'Your address', youHelp: 'Your street address, and the towns people come from.' } } },
      { id: 'showAddress', label: 'Customers come to them (show the address)', type: 'bool', you: 'Customers come to you (show your address)', live: true, ask: LOCAL_KINDS, wording: { church: { label: 'Show the address', you: 'Show the address' } } },
      { id: 'hours', label: 'Hours', type: 'hours', help: 'Days open with open and close times, or 24/7, or by appointment.', live: true, ask: LOCAL_KINDS, wording: { church: { label: 'Office hours', help: 'The office, not the services: service times have a question of their own below.', youHelp: 'The office, not the services: service times are asked about below.' } } },
      { id: 'socials', label: 'Social media and other profiles', type: 'list', help: 'Links, one per line: Facebook, Instagram, YouTube, Yelp, LinkedIn…', you: 'Your social media and other profiles', youHelp: 'Links, one per line: Facebook, Instagram, YouTube, Yelp, LinkedIn…', live: true },
    ],
  },
  {
    id: 'offer',
    title: 'What they sell',
    you: 'What you sell',
    wording: { church: { title: 'What they offer', you: 'What you offer' }, creative: { title: 'What they make', you: 'What you make' } },
    fields: [
      { id: 'services', label: 'Services or products', type: 'list', required: true, help: 'One per line.', live: true, wording: { store: { label: 'Product lines or collections', help: 'One per line, the way the shop should be grouped.', youHelp: 'One per line, the way the shop should be grouped.' }, storefront: { label: 'What they sell or serve', you: 'What you sell or serve' }, church: { label: 'Ministries and groups', help: 'Kids, youth, small groups, outreach; one per line.', youHelp: 'Kids, youth, small groups, outreach; one per line.' }, creative: { label: 'What they make or offer', you: 'What you make or offer', help: 'Prints, commissions, lessons, bookings; one per line.', youHelp: 'Prints, commissions, lessons, bookings; one per line.' }, professional: { label: 'Services', you: 'Your services' } } },
      { id: 'mainAction', label: 'The one thing a visitor should do', type: 'choice', options: ['Call', 'Text', 'Fill out a form', 'Book online', 'Buy online', 'Visit in person'], you: 'The one thing you want visitors to do', ask: ['local', 'storefront', 'professional', 'church', 'creative'] },
      { id: 'bookingLink', label: 'Booking or scheduling link', type: 'text', help: 'If they book online: the page people book on.', you: 'Your booking link', youHelp: 'If customers book with you online, the link to your booking page.', ask: ['local', 'storefront', 'professional', 'creative'], wording: { storefront: { label: 'Reservation or booking link', you: 'Your reservation or booking link' } } },
      { id: 'customers', label: 'Who their customers are', type: 'textarea', you: 'Who your customers are', wording: { church: { label: 'Who comes, and who they hope to reach', you: 'Who comes, and who you hope to reach' }, creative: { label: 'Who their work is for', you: 'Who your work is for' } } },
      { id: 'different', label: 'Why people pick them', type: 'textarea', you: 'Why people pick you', wording: { store: { label: 'What makes the product special', you: 'What makes your product special' }, church: { label: 'What a first-time visitor should know', help: 'Parking, kids, what people wear, how long a service runs, what to expect.', you: 'What a first-time visitor should know', youHelp: 'Parking, kids, what people wear, how long a service runs, what to expect.' } } },
      { id: 'pricingInfo', label: 'Prices or starting prices to show, if any', type: 'textarea', help: '“From $95” is fine. Blank means no prices on the site.', youHelp: '“From $95” is fine. Blank means no prices on the site.', live: true, ask: ['local', 'storefront', 'professional', 'creative'] },
      { id: 'faq', label: 'Questions customers ask most', type: 'list', help: 'One per line, with the answer after a dash if it’s short.', you: 'Questions you get asked most', youHelp: 'One per line, with the answer after a dash if it’s short.', wording: { church: { label: 'Questions visitors ask most', you: 'Questions visitors ask most' } } },
    ],
  },
  {
    id: 'pages',
    title: 'Pages',
    fields: [
      { id: 'pages', label: 'Pages', type: 'pages', required: true, help: 'One per line. Counted against the package.', you: 'Pages on your site', ask: 'always' },
    ],
  },
  {
    id: 'church',
    title: 'Services and giving',
    fields: [
      { id: 'serviceTimes', label: 'Service times', type: 'textarea', help: 'Each service with its day and time, and anything regular in the week.', live: true, ask: ['church'] },
      { id: 'denomination', label: 'Denomination or affiliation', type: 'text', ask: ['church'] },
      { id: 'beliefs', label: 'What they believe', type: 'textarea', help: 'A statement of faith, or a link to one.', you: 'What you believe', ask: ['church'] },
      { id: 'givingLink', label: 'Online giving link', type: 'text', live: true, ask: ['church'] },
      { id: 'sermonsLink', label: 'Where sermons are posted', type: 'text', help: 'YouTube, a podcast, SermonAudio…', ask: ['church'] },
      { id: 'livestream', label: 'Livestream link', type: 'text', ask: ['church'] },
      { id: 'events', label: 'Regular events to list', type: 'textarea', help: 'Weekly and monthly things; one-off events come later through the editor.', live: true, ask: ['church'] },
    ],
  },
  {
    id: 'practice',
    title: 'The practice',
    you: 'Your practice',
    fields: [
      { id: 'credentials', label: 'Licenses, certifications and memberships', type: 'list', help: 'One per line, with the number where there is one. Only what can be checked.', youHelp: 'One per line, with the number where there is one.', ask: ['professional', 'local'] },
      { id: 'insurance', label: 'Insurance accepted', type: 'text', help: 'For a medical or dental practice; blank otherwise.', you: 'Insurance you accept', youHelp: 'If it applies; blank otherwise.', ask: ['professional'] },
      { id: 'consult', label: 'First meeting', type: 'choice', options: ['Free consultation', 'Paid consultation', 'No consultation'], ask: ['professional'] },
      { id: 'clientForms', label: 'New-client forms or portal link', type: 'text', help: 'Anything a new client fills in or signs in to.', ask: ['professional'] },
    ],
  },
  {
    id: 'work',
    title: 'Their work',
    you: 'Your work',
    fields: [
      { id: 'portfolio', label: 'What to show, and where it is now', type: 'textarea', help: 'The pieces or projects for the site, and where the files or links live today.', ask: ['creative'] },
      { id: 'commissions', label: 'How people hire or commission them', type: 'textarea', you: 'How people hire or commission you', ask: ['creative'] },
      { id: 'sellNow', label: 'Where they sell now', type: 'text', help: 'Etsy, Bandcamp, galleries, in person…', you: 'Where you sell now', ask: ['creative'] },
      { id: 'press', label: 'Press, awards or features to mention', type: 'list', help: 'One per line with a link; only what’s real.', youHelp: 'One per line with a link.', ask: ['creative'] },
    ],
  },
  {
    id: 'look',
    title: 'Look and feel',
    fields: [
      { id: 'mockChanges', label: 'What should change from the mock-up', type: 'textarea', help: 'Colors, words, layout, anything they didn’t like. The rest carries over.', youHelp: 'Colors, words, layout, anything you didn’t like. The rest carries over.', when: 'mockUrl' },
      { id: 'logo', label: 'Logo', type: 'choice', options: [{ value: 'Have one, will send', you: 'I have one and will send it' }, { value: 'Need one', you: 'I need one' }, { value: 'Just use the name', you: 'Just use my business name' }], you: 'Your logo' },
      { id: 'colors', label: 'Colors', type: 'text', help: 'Brand colors, or a feel (“white or black behind the text, never beige”).', youHelp: 'Your brand colors, or a feel (“white or black behind the text, never beige”).' },
      { id: 'avoid', label: 'Anything to avoid', type: 'text', help: 'Colors, words, styles or clichés they don’t want.', youHelp: 'Colors, words, styles or clichés you don’t want.' },
      { id: 'brandGuide', label: 'Brand guide or style sheet', type: 'choice', options: [{ value: 'Have one, will send', you: 'I have one and will send it' }, 'None'], ask: ['store', 'professional', 'creative', 'church'] },
      { id: 'sitesLiked', label: 'Sites they like', type: 'list', help: 'Links, one per line.', you: 'Websites you like the look of' },
      { id: 'tone', label: 'How they want to sound', type: 'text', you: 'How you want to sound' },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    fields: [
      // "Mostly from the current site" (Daniel, 2026-11-17, for a rebuild like Deliverance): the words
      // and pictures already exist; the build reuses what came in with the mock-up or from Daniel,
      // tidied, and asks only for what's new. A build never fetches the old site itself.
      { id: 'copy', label: 'Who writes the words', type: 'choice', options: [{ value: 'Mostly from the current site', you: 'Mostly from my current site, tidied up' }, { value: 'They do', you: 'I’ll write it myself' }, { value: 'I draft, they edit', you: 'Daniel drafts, I edit' }, { value: 'I write it', you: 'Daniel writes it' }], you: 'Who writes the words', help: '“Mostly from the current site” keeps what’s there, tidied; anything new is asked for in Notes.', youHelp: '“Mostly from my current site” keeps what’s there, tidied; tell Daniel what’s new in Notes.' },
      { id: 'ownWords', label: 'In their own words', type: 'textarea', help: 'Anything they want the site to say, however rough: about them, how they work, what to promise.', you: 'Anything you want the site to say', youHelp: 'However rough: about you, how you work, what you promise.' },
      { id: 'photos', label: 'Photos', type: 'choice', options: [{ value: 'Use the ones on the current site', you: 'Use the ones on my current site' }, { value: 'They have good ones', you: 'I have good ones' }, { value: 'Some, need more', you: 'Some, but I need more' }, 'None yet'], you: 'Your photos', wording: { store: { label: 'Product photos and art', you: 'Your product photos and art' }, creative: { label: 'Photos of the work', you: 'Photos of your work' } } },
      { id: 'videos', label: 'Videos to include', type: 'list', help: 'Links, one per line. Embedded without tracking.', youHelp: 'Links, one per line.', ask: ['church', 'creative', 'store'] },
      { id: 'reviews', label: 'Where their reviews are', type: 'text', help: 'Google, Facebook, Yelp…', you: 'Where your reviews are', wording: { store: { label: 'Where product reviews live', help: 'The current store, Amazon, a reviews app…', you: 'Where your product reviews live', youHelp: 'The current store, Amazon, a reviews app…' } } },
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and access',
    fields: [
      { id: 'registrar', label: 'Where the domain is registered', type: 'text', you: 'Where your domain is registered' },
      { id: 'currentHost', label: 'Where the current site is hosted', type: 'text', help: 'GoDaddy, Wix, Squarespace, WordPress.com, a web designer…', you: 'Where your current site is hosted' },
      { id: 'gbp', label: 'Google Business Profile', type: 'choice', options: [{ value: 'Claimed, they have access', you: 'I have one and can log in' }, { value: 'Exists, not claimed', you: 'There’s one, but I can’t log in to it' }, { value: 'None yet', you: 'I don’t have one' }, { value: 'Not sure', you: 'I’m not sure' }], you: 'Your Google Business Profile', ask: LOCAL_KINDS },
      { id: 'formsTo', label: 'Where form messages should go', type: 'text', help: 'An email address, or a phone for texts.', you: 'Where messages from the site should go' },
      // Who else a form button can send to (2026-11-18, N & J's Darby rental goes to its property
      // manager). The site names one by its name, never by its address; the relay sends only to an
      // address on this list, so a post can't be aimed anywhere else. The main email is copied
      // unless `formAlone` is on.
      { id: 'formAlso', label: 'Others a form button can send to', type: 'list', help: 'One per line: a short name, a colon, then the email. Example: Darby manager: name@example.com', you: 'Others a form button can send to', ask: 'off' },
      { id: 'formAlone', label: 'Send those messages only to that person, without copying the main email', type: 'bool', you: 'Send those messages only to that person, without copying the main email', when: 'formAlso', ask: 'off' },
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
      { id: 'currentPlatform', label: 'Where the store runs now', type: 'text', help: 'WooCommerce, Squarespace, Etsy, Big Cartel… or nothing yet.', you: 'Where your store runs now' },
      { id: 'platform', label: 'Platform for the new store', type: 'choice', options: ['Shopify', 'Headless', 'Keep the current one', 'Not sure'] },
      { id: 'productCount', label: 'How many products', type: 'text', help: 'Roughly, counting variants (sizes, colors) once.' },
      { id: 'regions', label: 'Where they sell and ship to', type: 'textarea', help: 'Countries or regions, and which currencies to show.', you: 'Where you sell and ship to', live: true },
      { id: 'fulfillment', label: 'Who ships the orders, and from where', type: 'textarea', help: 'Their own stock, a fulfillment partner, Amazon, print on demand. Which region each one covers, if it differs.', youHelp: 'Your own stock, a fulfillment partner, Amazon, print on demand. Which region each one covers, if it differs.' },
      { id: 'entities', label: 'Separate companies by region', type: 'choice', options: ['One company everywhere', 'Separate companies in some regions', 'Not sure'], help: 'A separate company with its own tax and payment accounts usually means a separate store.' },
      { id: 'migrate', label: 'What moves over from the current store', type: 'list', help: 'Products, customers, past orders, reviews, gift cards, discount codes: one per line.', you: 'What moves over from your current store' },
      { id: 'preorders', label: 'Pre-orders, crowdfunding or pledge-manager orders', type: 'textarea', help: 'Anything sold before it ships, and the tools behind it (Kickstarter, BackerKit, Gamefound).' },
      { id: 'promotions', label: 'Discounts, bundles and gift cards they use', type: 'textarea', you: 'Discounts, bundles and gift cards you use' },
      { id: 'shipping', label: 'Shipping rates and carriers', type: 'textarea', help: 'Flat rate, free over an amount, live rates; USPS, UPS, a partner’s rates.', live: true },
      { id: 'returns', label: 'Return and refund policy', type: 'textarea', help: 'Or a link to it.', live: true },
      { id: 'taxes', label: 'Sales tax and VAT', type: 'textarea', help: 'Where they collect today, and anything registered abroad.', youHelp: 'Where you collect today, and anything registered abroad.' },
      { id: 'payments', label: 'Payment methods to offer', type: 'list', help: 'Cards, PayPal, Shop Pay, Apple Pay, Google Pay… one per line.' },
      { id: 'storeRunner', label: 'Who runs the store day to day', type: 'text', help: 'Who gets the orders, answers customers and needs the training.' },
      { id: 'wholesale', label: 'Sell wholesale too', type: 'bool' },
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
      { id: 'outOfScope', label: 'Extras to quote', type: 'list', help: 'What you’ve agreed to price separately, one per line. They see these under “Past the package.”', owner: 'daniel', clientHidden: true, ask: 'always' },
      { id: 'notes', label: 'Notes', type: 'textarea', you: 'Bigger changes or anything else', youHelp: 'New pages, new features, a different layout: Daniel looks at these himself.', ask: 'always' },
    ],
  },
] as const;

// What a client's own edits can update on their own, and what comes to Daniel instead (2026-11-02).
// The box updates the preview from anything else a client changes; these never build on their own:
// notes are where bigger asks go, pages change the structure (and can change the scope), and sites
// they like are a redesign. Daniel's own edits aren't sorted; he builds when he means to.
export const reviewFields = ['notes', 'pages', 'sitesLiked'] as const;

// Default pages offered when a package is picked and the list is still empty. Suggestions only.
// By package alone (the older shape, still embedded by the admin page)…
export const defaultPages = {
  starter: ['Home'],
  business: ['Home', 'Services', 'About', 'Contact'],
  growth: ['Home', 'Services', 'About', 'Contact', 'Blog'],
  store: ['Home', 'Shop', 'About', 'Contact'],
} as const;

// …and by the kind of site (2026-11-17): a church gets Visit and Ministries, not Services.
const pagesByKind: Record<string, string[]> = {
  local: ['Home', 'Services', 'About', 'Contact'],
  storefront: ['Home', 'What we offer', 'About', 'Visit'],
  professional: ['Home', 'Services', 'About', 'Contact'],
  church: ['Home', 'About', 'Visit', 'Ministries', 'Contact'],
  creative: ['Home', 'Portfolio', 'About', 'Contact'],
  store: ['Home', 'Shop', 'About', 'Contact'],
};
const growthExtra: Record<string, string[]> = { church: ['Sermons', 'Events'] };

/** The kind of site a project is, from its answers: what Daniel picked, or the package's usual kind. */
export function siteTypeFor(answers: { siteType?: string; tier?: string }): SiteType {
  if (answers.siteType && siteTypes.some((t) => t.id === answers.siteType)) return answers.siteType as SiteType;
  return answers.tier === 'store' ? 'store' : 'local';
}

export function defaultPagesFor(tier: string | undefined, siteType: SiteType): string[] {
  if (tier === 'starter') return ['Home'];
  const base = pagesByKind[tier === 'store' ? 'store' : siteType] ?? pagesByKind.local;
  if (tier === 'growth' || tier === 'store') return [...base, ...(growthExtra[siteType] ?? ['Blog'])];
  return [...base];
}
