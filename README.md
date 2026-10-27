# steadfastcode.tech

The website for Steadfast Code — fast, custom websites, local SEO/GEO and software for small
businesses, churches and nonprofits in Lancaster County, PA. Astro 7, static, one font, no script
bundles, every page under the 200 KB budget the tests enforce.

```
corepack enable
yarn install --immutable
yarn gate        # build + tests
yarn dev
```

Prices and business facts live in `src/data/site.ts`. The plan behind the business is in
`docs/business-plan.md`. See `CLAUDE.md` for the rules.
