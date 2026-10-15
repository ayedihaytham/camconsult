# Public-site indexing and launch guide

Scope: this Next.js application only. Production origin:
`https://camconsult.com.tn`; localized pages: `/fr`, `/en`, `/ar`.

## What the code provides

- Localized titles and descriptions on all 12 routes (36 localized URLs).
- Each page has its own canonical URL, reciprocal French/English/Arabic
  `hreflang` links, and a French `x-default` fallback. Each translation stays
  canonical to itself.
- `/sitemap.xml` lists those URLs and their language alternates. It excludes
  redirects, the client portal, nonexistent articles and URL fragments. No
  fabricated modification dates are emitted.
- `/robots.txt` permits public-site crawling and advertises the sitemap.
- Open Graph and Twitter metadata reuse the existing cabinet logo.
- `AccountingService` and `WebSite` JSON-LD describe the business using the name,
  address, telephone, email and hours already displayed on the site. No ratings,
  reviews, social profiles or geographic coordinates have been invented.
- Language selectors and legal navigation use crawlable links. Pages render
  their initial headings and content on the server, including the homepage.
- Requests reaching Next.js at `www.camconsult.com.tn` permanently redirect to
  the canonical origin, preserving the path and query string.
- Existing favicon, app icon, Apple icon, language attributes and Arabic RTL
  rendering are retained.

Implementation: [SEO helpers](lib/seo.ts), [robots](app/robots.ts),
[sitemap](app/sitemap.ts), [root layout](app/[lang]/layout.tsx).

Validated on 15 October 2026: TypeScript, the production build, and the HTTP
audit of all 36 pages pass, including against the standalone server layout used
by Docker. A separate preview build passes with `noindex`, a blocking robots
file, an empty sitemap, and both optional verification tags. The final local
build is restored to production settings. Builds now enforce TypeScript errors.
Next.js still reports the existing `middleware.ts` deprecation warning; it does
not prevent these checks from passing. Live hosting, DNS ownership and search
engine submission still require the steps below.

## 1. Configure and deploy

Run commands from this `camconsult/` directory. Use the repository's pnpm lockfile.
For a source/PM2 deployment, add these values to `.env` or `.env.local` before
building (see [.env.example](.env.example)):

```dotenv
SITE_URL=https://camconsult.com.tn
SITE_INDEXABLE=true
NEXT_PUBLIC_CLIENT_PORTAL_URL=https://cabinet.camconsult.com.tn/login
```

`SITE_URL` must be an origin, without `/fr`, `/en`, `/ar`, a query or credentials.
For a preview/staging build set `SITE_INDEXABLE=false`; this emits `noindex`, a
blocking robots file and an empty sitemap. Restore `true` for production.

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

Restart the public-site process using your existing deployment workflow. For
the existing PM2 setup this is `pm2 restart camconsult-site --update-env`.
Do not restart the accounting app to deploy this site.

For Docker, the public-site Dockerfile already defaults to the production
values above. To customize them, pass `--build-arg SITE_URL=...` and
`--build-arg SITE_INDEXABLE=...` **when building the image**. Optional verification
tokens also have build arguments. Rebuild and deploy the public-site image via
your existing CI workflow; changing only a running container's environment will
not update generated HTML, robots or the sitemap.

The current [public-site workflow](../.github/workflows/camconsult-site.yml)
builds and pushes the image when public-site changes reach `main`. After your
normal review/merge, check that this workflow succeeds and that Watchtower
refreshes the `camconsult-site` container on the VPS. If manually updating,
run these from the VPS directory containing the deployed Compose file:

```sh
docker compose pull camconsult-site
docker compose up -d --no-deps camconsult-site
docker compose logs --tail=50 camconsult-site
```

Confirm that the registry namespace configured in the workflow matches the
`camconsult-site` image referenced by the deployed Compose file.

Ensure your live Nginx/hosting setup sends HTTP to HTTPS, has valid TLS for both
the apex and `www` hosts, and forwards public requests to this Next.js app.
The application can redirect `www` only after the request reaches it. Preserve
Certbot-managed TLS settings when editing live Nginx configuration; do not
overwrite the live configuration with the repository's pre-TLS template.

## 2. Check the deployed version

Open these URLs in a signed-out/private window:

- `https://camconsult.com.tn/fr`
- `https://camconsult.com.tn/en`
- `https://camconsult.com.tn/ar`
- `https://camconsult.com.tn/robots.txt`
- `https://camconsult.com.tn/sitemap.xml`

All five must return HTTP 200 without authentication, a bot challenge or an
error page. The sitemap should contain 36 `<url>` entries. Test one contact
and service page in each language. Use **View Page Source** to confirm the
title, description, self-canonical, four language alternates, `index, follow`
and JSON-LD. Arabic should have `lang="ar" dir="rtl"`.

Check `http://camconsult.com.tn/fr` and
`https://www.camconsult.com.tn/fr/contact`: they should ultimately lead to the
HTTPS apex URL with the same path. The `/` entry may temporarily redirect to
the visitor's preferred language; the sitemap contains the final localized URLs.
`/fr/a-page-that-does-not-exist` must return an actual HTTP 404.

Check response headers for an unexpected `X-Robots-Tag: noindex` imposed by
the host/CDN. Do not block `/_next/`, CSS, JavaScript or public images in hosting
rules. If robots or the sitemap still return 404, the deployment is stale or
the reverse proxy is routing those files incorrectly.

The repeatable local HTTP check is:

```sh
pnpm start
# In a second terminal, from the same directory:
pnpm run check:seo
```

It checks every page route discovered on disk against sitemap coverage, page
metadata, language links, server-rendered H1s, JSON-LD, redirects, icons and 404s.
`SEO_BASE_URL` can point at another running instance. `SEO_EXPECTED_ORIGIN`
defaults to the production origin. For a staging build, set
`SEO_EXPECT_INDEXABLE=false` when running the check.

## 3. Verify ownership in Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console/).
2. Add a **Domain** property and enter `camconsult.com.tn`, without `https://`
   or `/fr`. This covers protocols, language paths and subdomains; the public
   sitemap still contains public-site URLs only.
3. Copy the TXT record supplied by Google.
4. Open the DNS provider managing the domain's authoritative nameservers and
   add a TXT record at the root (`@` or a blank host, according to that provider).
   Paste the exact `google-site-verification=...` value. Add a new record;
   preserve existing TXT, SPF, DKIM and other DNS records.
5. Return to Search Console and select **Verify** after DNS has propagated.
   Keep the verification TXT record after verification succeeds.

If you cannot edit DNS, create a **URL-prefix** property for
`https://camconsult.com.tn/` and choose the HTML-tag method. Put only the tag's
`content` value in `GOOGLE_SITE_VERIFICATION`, rebuild and deploy, confirm the
tag is visible in `/fr` source, then verify. For Docker this token must be a
build argument. Do not put the entire `<meta>` tag in the variable.

Reference: [Google ownership verification](https://support.google.com/webmasters/answer/9008080).

## 4. Submit the sitemap and inspect pages

1. Select the verified property in Search Console, open **Sitemaps**, and submit
   `https://camconsult.com.tn/sitemap.xml`.
2. Check that the sitemap is successfully fetched. Discovery and indexing counts
   can take time to update.
3. In **URL Inspection**, enter `https://camconsult.com.tn/fr`, run **Test live
   URL**, and confirm Google can fetch the rendered page and indexing is allowed.
4. Select **Request indexing**. Repeat for `/en`, `/ar`, `/fr/services` and
   `/fr/contact`. The sitemap handles discovery of the remaining URLs; there is
   no need to repeatedly request every URL.
5. Test the homepage in [Rich Results Test](https://search.google.com/test/rich-results)
   and [Schema Markup Validator](https://validator.schema.org/). Confirm the
   business details match reality. Optional recommended-property warnings are
   different from invalid markup; do not invent facts to silence them.

References: [Sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
[recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl),
[localized URLs](https://developers.google.com/search/docs/specialty/international/localized-versions),
[local-business markup](https://developers.google.com/search/docs/appearance/structured-data/local-business).

## 5. Add Bing and the local business listing

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/).
2. Import the verified property from Google Search Console, or add and verify
   `https://camconsult.com.tn/` manually. If using Bing's HTML-tag method, put
   its `content` value in `BING_SITE_VERIFICATION` and rebuild/deploy first.
3. Confirm Bing has `https://camconsult.com.tn/sitemap.xml`; submit it if absent.
4. Use Bing's URL inspection to check the homepage and key service pages.
5. Create or claim the cabinet's [Google Business Profile](https://business.google.com/).
   Use the real business name, appropriate accounting category, the displayed
   Tunis address, phone and hours, and the website link
   `https://camconsult.com.tn/fr`. Complete the verification process Google offers.

References: [Bing verification/import](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b),
[Google Business Profile](https://support.google.com/business/answer/7039811).

## 6. Content work and ongoing checks

The audit also found existing unfinished product/content flows. These do not
prevent the technical indexing setup from working, but should be reviewed
before promoting the site:

- Blog cards link to `#article`; there are no full article routes, and pagination
  buttons are placeholders. Publish real reviewed articles with dedicated URLs,
  authors and accurate dates before adding those URLs or Article schema.
- Resource download dialogs do not deliver actual guides. Publish real files or
  connect the promised delivery flow.
- Contact, application and newsletter success states are currently simulated;
  verify real message delivery before relying on them for leads.
- All eight service cards point to the same revision detail page. Write and
  publish separate service pages if you want each service to have a useful
  dedicated search result. Do not create duplicate thin pages for keywords.
- Legal text includes generic hosting details. Complete the real publisher and
  hosting information, and confirm business details and translations.
- Fiscal examples and editorial dates need a professional content review for
  accuracy and freshness. Metadata alone does not validate financial content.

After launch, check Search Console's page-indexing and performance reports
weekly at first. Inspect excluded URLs individually: a redirect or alternate
canonical may be expected; `noindex`, blocked crawling, unexpected 404s and
server errors on intended public pages need investigation. Use the live test
to distinguish an old crawl from a current issue. Review mobile performance
with [PageSpeed Insights](https://pagespeed.web.dev/) and Core Web Vitals as
field data becomes available.

Indexing can take days or weeks and is not guaranteed. Sitemap submission and
valid structured data do not guarantee rankings or rich results. Focus on real,
useful service information, accurate business details and working contact flows.
