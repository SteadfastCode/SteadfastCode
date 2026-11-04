// Care plans after launch (2026-11-03): the terms a client signs, and the dates billing follows.
// Daniel's calls: signed at launch; billing starts when the 30-day change window ends (or at launch,
// if that's later); every plan bills on the 1st; nothing is prorated, so the first charge is the
// 1st on or after that start, and the days before it are free. Stripe does the billing.
//
// Bump CARE_TERMS_VERSION whenever the wording changes. Written by Claude as a plain-English draft
// from Daniel's decisions and the plan list in site.ts; not reviewed by a lawyer yet.

import { business, money, carePlans, domainNote } from './site.ts';

export const CARE_TERMS_VERSION = '2026-11-03a';
export const CHANGE_WINDOW_DAYS = 30;

/** The hosting move at launch, in order. Daniel ticks each one on /admin/care. */
export const careChecklist = [
  { id: 'access', label: 'Access to the domain (GoDaddy Delegate Access, or the registrar’s equivalent)' },
  { id: 'records', label: 'Every DNS record copied into Cloudflare, email records checked one by one' },
  { id: 'nameservers', label: 'Nameservers switched to Cloudflare at the registrar' },
  { id: 'domain', label: 'Domain and www on the Pages project, HTTPS working' },
  { id: 'email', label: 'Email tested both ways after the switch' },
  { id: 'launch', label: 'Launched: noindex removed, Google Business Profile and search set up' },
  { id: 'oldhost', label: 'Old website host cancelled (never the email or the domain)' },
] as const;

type Plan = (typeof carePlans)[number];
export const carePlanById = (id: string) => carePlans.find((p) => p.id === id) ?? null;

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return day(d); };

/**
 * When billing starts: the later of launch and the end of the change window (first preview + 30
 * days), then the 1st on or after that. `minDate` keeps it at least a couple of days after signing
 * (Stripe needs a start date in the future), moving it to the next 1st when it's too close.
 */
export function firstBillDate({ firstPreview, launchedAt, minDate }: { firstPreview?: string | null; launchedAt?: string | null; minDate?: string | null }) {
  const windowEnds = firstPreview ? addDays(firstPreview.slice(0, 10), CHANGE_WINDOW_DAYS) : null;
  let start = [windowEnds, launchedAt?.slice(0, 10), minDate?.slice(0, 10)].filter(Boolean).sort().pop() as string | undefined;
  if (!start) return { windowEnds, firstBill: null };
  const d = new Date(start + 'T12:00:00Z');
  if (d.getUTCDate() !== 1) { d.setUTCMonth(d.getUTCMonth() + 1, 1); }
  return { windowEnds, firstBill: day(d) };
}

const longDate = (ymd: string) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Everything a plan includes, with "Everything in X" spelled out. */
export function planIncludes(plan: Plan): string[] {
  const i = carePlans.indexOf(plan);
  return carePlans.slice(0, i + 1).flatMap((p) => p.includes.filter((x) => !/^Everything in /.test(x)));
}

export type CareInput = { plan: string; price: number; firstBill: string; contactName?: string; businessName?: string };

/** The care plan terms as sections, and the same as one plain text block. */
export function careTermsFor(a: CareInput, date = new Date()) {
  const plan = carePlanById(a.plan);
  if (!plan || !a.firstBill) return null;
  const client = [a.contactName, a.businessName].filter(Boolean).join(', for ') || 'the client';
  const signedOn = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const listed = a.price === plan.price ? money(a.price) : `${money(a.price)} (the ${plan.name} plan is normally ${money(plan.price)})`;
  const sections: { h: string; p: string[] }[] = [
    {
      h: 'Who this is between',
      p: [`This care plan is between ${business.owner} (${business.name}), ${business.city}, ${business.state}, “I” or “me” below, and ${client}, “you” and “your” below. It covers hosting and looking after your website after launch, on the ${plan.name} plan. ${signedOn}.`],
    },
    {
      h: 'What’s included',
      p: ['Every month, for as long as the plan runs:', ...planIncludes(plan).map((x) => `• ${x}`)],
    },
    {
      h: 'Price and billing',
      p: [
        `${listed} a month, plus any sales tax that applies, billed on the 1st of each month to the card or bank account you add through Stripe, the payment company I use. I never see or keep your card details.`,
        `Your first charge is on ${longDate(a.firstBill)}. Nothing is charged before then, including the rest of your 30 days of changes after your site goes live.`,
        'If I ever change the price, I’ll tell you in writing at least 30 days before, and you can cancel before it applies.',
      ],
    },
    {
      h: 'Stopping the plan',
      p: [
        'It’s month to month: cancel any time by email or from the billing link I send you. The plan runs to the end of the month you’ve paid for, and there’s no charge after that.',
        'Leaving doesn’t cost you your site. I hand over the code and help move it and your domain’s settings to wherever you want, free.',
      ],
    },
    {
      h: 'If a payment doesn’t go through',
      p: ['Stripe tries again over the following days and emails you. If a month stays unpaid, I’ll get in touch before anything changes with your site.'],
    },
    {
      h: 'Your domain and email',
      p: [
        'Your domain stays registered in your name. While you’re on the plan I look after its settings, so your site points at the right place. Your email keeps working as it does now; I check it after any change I make.',
        domainNote,
      ],
    },
    {
      h: 'The fine print',
      p: [
        'Your website contract still covers who owns the site and what I don’t promise. If something goes wrong, the most I’m responsible for is what you’ve paid me for the plan in the last 12 months.',
        'This is governed by Pennsylvania law. By typing your name and ticking the box below, you agree to sign electronically, and that your electronic signature counts the same as one on paper.',
      ],
    },
  ];
  const text = [`Care plan — ${business.name}`, `Version ${CARE_TERMS_VERSION}`, '', ...sections.flatMap((s) => [s.h.toUpperCase(), ...s.p, ''])].join('\n');
  return { title: `Care plan — ${plan.name}`, version: CARE_TERMS_VERSION, plan: { id: plan.id, name: plan.name }, price: a.price, firstBill: a.firstBill, sections, text };
}
