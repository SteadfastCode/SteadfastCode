-- The standard lines of the website contract as library rows (2026-11-17, Daniel: the words all in
-- one place). Three new columns on contract_lines: standard (came with the contract; can be
-- reworded in the library, never forgotten), locked (can't be switched off on a project: who the
-- contract is between, the package heading, the electronic-signature paragraph) and position (the
-- order within the section; a line Daniel adds has none and goes after). A standard line carries
-- placeholders ({client}, {package}, {price}, {half} …) that src/data/agreement.ts fills in per
-- project; {packageLines} is where the package's bullet list expands. The seed is
-- standardLines in src/data/agreement.ts, and test/agreement.test.js checks the two agree.
ALTER TABLE contract_lines ADD COLUMN standard INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_lines ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_lines ADD COLUMN position INTEGER;

INSERT INTO contract_lines (id, section_id, text, created_at, standard, locked, position) VALUES
  ('s-who', 'who', 'This contract is between {owner} ({company}), {city}, {state}, “I” or “me” below, and {client}, “you” and “your” below. It covers building your website in the {package} package. {date}.', '2026-11-17T00:00:00Z', 1, 1, 0),
  ('s-build-head', 'build', 'The {package} package: {pages}, and everything listed here:', '2026-11-17T00:00:00Z', 1, 1, 1),
  ('s-build-list', 'build', '{packageLines}', '2026-11-17T00:00:00Z', 1, 0, 2),
  ('s-build-extra', 'build', 'Anything you ask for that isn’t in the package gets a written price from me first, and isn’t built unless you say yes to that price.', '2026-11-17T00:00:00Z', 1, 0, 3),
  ('s-price', 'price', '{priceLead} {price}{priceDetail}, plus any sales tax that applies.', '2026-11-17T00:00:00Z', 1, 0, 4),
  ('s-halves', 'price', 'Half ({half}) is due when you sign, to start. The other half ({rest}) is due at launch.', '2026-11-17T00:00:00Z', 1, 0, 5),
  ('s-deposit-1', 'deposit', 'Because I can start building your first version the same day we meet, the deposit isn’t refundable once the build has started.', '2026-11-17T00:00:00Z', 1, 0, 6),
  ('s-deposit-2', 'deposit', 'If you decide to stop before launch, you don’t owe the second half. The work done so far stays with me until it’s paid for; you can pay the second half at any time to get the site.', '2026-11-17T00:00:00Z', 1, 0, 7),
  ('s-timing-1', 'timing', '{package} usually launches {days} from the start. {launchNote}', '2026-11-17T00:00:00Z', 1, 0, 8),
  ('s-timing-2', 'timing', 'If I haven’t heard from you for 30 days after I’ve sent a preview, and I’ve checked in at least twice, I’ll consider the project delivered: the second half is due, and launching it later is still included whenever you’re ready.', '2026-11-17T00:00:00Z', 1, 0, 9),
  ('s-changes-1', 'changes', 'Changes are unlimited for 30 days from the day you first see your site, as long as they’re within the package: wording, photos, colors, layout, whatever it takes to make it yours. After that, changes come with a care plan or a quote.', '2026-11-17T00:00:00Z', 1, 0, 10),
  ('s-changes-2', 'changes', 'If something I built doesn’t work the way I said it would, I fix it free.', '2026-11-17T00:00:00Z', 1, 0, 11),
  ('s-yours-1', 'your-part', 'You’ll provide the content you want on the site (or tell me what you want it to say), and access to your domain and your Google Business Profile when it’s time to launch.', '2026-11-17T00:00:00Z', 1, 0, 12),
  ('s-yours-2', 'your-part', 'If you don’t have a domain yet, I’ll help you buy one. Either way it’s registered in your name and paid with your card, so it’s yours.', '2026-11-17T00:00:00Z', 1, 0, 13),
  ('s-yours-3', 'your-part', '{domainNote}', '2026-11-17T00:00:00Z', 1, 0, 14),
  ('s-yours-4', 'your-part', 'You confirm you have the right to use the words, photos and logos you give me, and that what you tell me about your business is true.', '2026-11-17T00:00:00Z', 1, 0, 15),
  ('s-own-1', 'ownership', 'Once it’s paid in full, the site is yours: its content, its design and its code. I hand the code over at launch, and you can host it anywhere.', '2026-11-17T00:00:00Z', 1, 0, 16),
  ('s-own-2', 'ownership', 'Tools and building blocks I use across projects stay mine, and you get a permanent, free license to use them as part of your site.', '2026-11-17T00:00:00Z', 1, 0, 17),
  ('s-own-3', 'ownership', 'Your site’s footer includes a small “Built by Steadfast Code” link. It’s yours to keep or remove; just ask.', '2026-11-17T00:00:00Z', 1, 0, 18),
  ('s-nop-1', 'no-promise', 'Sites are built to load in well under a second on most phones and connections, but load times are also not a guarantee.', '2026-11-17T00:00:00Z', 1, 0, 19),
  ('s-nop-2', 'no-promise', 'I build the site to follow search engines’ guidelines, but nobody can promise rankings, traffic or sales, and I don’t.', '2026-11-17T00:00:00Z', 1, 0, 20),
  ('s-nop-3', 'no-promise', 'No website can be certified as ADA compliant. I build and check to WCAG 2.1 AA, the standard websites are most commonly judged by for accessibility, and fix any accessibility problem you or a visitor reports.', '2026-11-17T00:00:00Z', 1, 0, 21),
  ('s-nop-4', 'no-promise', 'If something goes wrong, the most I’m responsible for is what you’ve paid me under this contract.', '2026-11-17T00:00:00Z', 1, 0, 22),
  ('s-fine-1', 'fine-print', 'Either of us can end this in writing. If you do, the deposit section above applies; if I do before launch, I refund what you’ve paid.', '2026-11-17T00:00:00Z', 1, 0, 23),
  ('s-fine-2', 'fine-print', 'This contract is governed by Pennsylvania law. It’s the whole contract for this website; anything we add later is in writing (an email is fine).', '2026-11-17T00:00:00Z', 1, 0, 24),
  ('s-fine-3', 'fine-print', 'By typing your name and ticking the box below, you agree to sign electronically, and that your electronic signature counts the same as one on paper. You’ll get a copy by email.', '2026-11-17T00:00:00Z', 1, 1, 25);
