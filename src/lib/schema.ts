// The one place structured data comes from. Every page's JSON-LD is built here, from
// `src/data/site.ts`, and emitted as a single `@graph` block by `src/layouts/Base.astro` — so a
// price can never be true in the markup and false on the page, and there is one file to look at
// when Search Console complains.
//
// Nothing is invented to fill a field: a profile URL that is not set is not emitted, and there is
// no rating, review or client logo here until a real one exists.

import { business, carePlans, faq, money, seoPlans, websiteTiers } from '../data/site.ts';

export const SITE_URL = business.url;
export const BUSINESS_ID = `${SITE_URL}/#business`;
export const PERSON_ID = `${SITE_URL}/#daniel`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

type Node = Record<string, unknown>;

/** Absolute URL for a site path (`/websites` → `https://steadfastcode.tech/websites`). */
export function absolute(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

const PROFILE_FIELDS = ['github', 'googleBusinessProfile', 'linkedin', 'facebook'] as const;
export const profileUrls: string[] = PROFILE_FIELDS.map((f) => business[f]).filter((u) => u !== '');

function areaServed(): Node[] {
  return business.serviceTowns.map((town) => ({
    '@type': 'City',
    name: town,
    address: { '@type': 'PostalAddress', addressLocality: town, addressRegion: business.state, addressCountry: 'US' },
  }));
}

/** One `Offer` per priced thing on the site, with the price as a number the page also shows. */
function offer(name: string, description: string, price: number, opts: { per?: string; from?: boolean; url: string }): Node {
  const spec: Node = {
    '@type': opts.per ? 'UnitPriceSpecification' : 'PriceSpecification',
    priceCurrency: 'USD',
    ...(opts.from ? { minPrice: price } : { price }),
    ...(opts.per === 'mo' ? { unitCode: 'MON', unitText: 'month', billingIncrement: 1 } : {}),
    description: `${opts.from ? 'from ' : ''}${money(price, opts.per)}`,
  };
  return {
    '@type': 'Offer',
    name,
    description,
    url: opts.url,
    itemOffered: { '@type': 'Service', name, description, provider: { '@id': BUSINESS_ID } },
    priceSpecification: spec,
  };
}

function offerCatalog(): Node {
  return {
    '@type': 'OfferCatalog',
    name: `${business.name} services and prices`,
    itemListElement: [
      ...websiteTiers.map((t) =>
        offer(`${t.name} website`, t.who, t.price, { from: 'from' in t && Boolean(t.from), url: absolute('/websites') + `#${t.id}` }),
      ),
      ...carePlans.map((p) => offer(`${p.name} care plan`, p.who, p.price, { per: 'mo', url: absolute('/websites') + `#${p.id}` })),
      ...seoPlans.map((p) =>
        offer(p.name, p.who, p.price, { per: 'per' in p ? p.per : undefined, url: absolute('/seo') + `#${p.id}` }),
      ),
    ],
  };
}

/** The business: the node every page carries and the rest of the graph points at. */
export function organization(): Node {
  return {
    '@type': 'ProfessionalService',
    '@id': BUSINESS_ID,
    name: business.name,
    description: business.tagline,
    url: SITE_URL,
    email: business.email,
    image: absolute('/og.png'),
    logo: absolute('/logo.svg'),
    founder: { '@id': PERSON_ID },
    address: {
      '@type': 'PostalAddress',
      addressLocality: business.city,
      addressRegion: business.state,
      postalCode: business.zip,
      addressCountry: 'US',
    },
    areaServed: areaServed(),
    priceRange: '$$',
    currenciesAccepted: 'USD',
    knowsAbout: ['Web design', 'Web development', 'Local SEO', 'Generative engine optimization', 'Custom software', 'Astro', 'Cloudflare'],
    hasOfferCatalog: offerCatalog(),
    ...(profileUrls.length ? { sameAs: profileUrls } : {}),
  };
}

export function person(): Node {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: business.owner,
    jobTitle: 'Founder and developer',
    worksFor: { '@id': BUSINESS_ID },
    url: absolute('/about'),
    homeLocation: { '@type': 'Place', name: `${business.city}, ${business.state}` },
  };
}

export function webSite(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: business.name,
    url: SITE_URL,
    publisher: { '@id': BUSINESS_ID },
    inLanguage: 'en-US',
  };
}

/** `BreadcrumbList` for an inner page. The home page gets none: a one-item trail says nothing. */
export function breadcrumb(path: string, label: string): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absolute(path)}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absolute('/') },
      { '@type': 'ListItem', position: 2, name: label, item: absolute(path) },
    ],
  };
}

/**
 * `FAQPage` from question/answer pairs the page also renders. Google's guidance wants the same
 * Q&A visible to the visitor, so callers pass the list they are rendering, not a second one.
 */
export function faqPage(path: string, qa: readonly { readonly q: string; readonly a: string }[] = faq): Node {
  return {
    '@type': 'FAQPage',
    '@id': `${absolute(path)}#faq`,
    mainEntity: qa.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** The page's whole block: one `@graph` with `@context` at the top. */
export function graph(nodes: Node[]): string {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
  // `set:html` does not escape, and a `</script>` inside a string would close the tag early.
  return json.replace(/</g, '\\u003c');
}
