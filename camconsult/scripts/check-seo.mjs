import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'

const base = (process.env.SEO_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const origin = new URL(process.env.SEO_EXPECTED_ORIGIN || 'https://camconsult.com.tn').origin
const indexable = process.env.SEO_EXPECT_INDEXABLE !== 'false'
const locales = ['fr', 'ar', 'en']

async function routes(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const children = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) =>
    routes(new URL(`${entry.name}/`, directory), `${prefix}/${entry.name}`)))
  return [...(entries.some((entry) => entry.name === 'page.tsx') ? [prefix] : []), ...children.flat()]
}

async function request(path, options) {
  return fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000), ...options })
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) =>
    [name.toLowerCase(), value.replaceAll('&amp;', '&')]))
}

const paths = await routes(new URL('../app/[lang]/', import.meta.url))
const expectedUrls = locales.flatMap((lang) => paths.map((path) => `${origin}/${lang}${path}`))
const sitemapResponse = await request('/sitemap.xml')
assert.equal(sitemapResponse.status, 200, 'Sitemap must be accessible without a locale redirect')
assert.match(sitemapResponse.headers.get('content-type') || '', /xml/)
const sitemap = await sitemapResponse.text()
const sitemapEntries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1])
const locations = sitemapEntries.map((entry) => entry.match(/<loc>(.*?)<\/loc>/)?.[1])
assert.deepEqual(locations.sort(), indexable ? [...expectedUrls].sort() : [], 'Sitemap must cover exactly the existing localized pages')
for (const entry of sitemapEntries) {
  const location = entry.match(/<loc>(.*?)<\/loc>/)[1]
  const path = new URL(location).pathname.replace(/^\/(fr|ar|en)/, '')
  const links = [...entry.matchAll(/<xhtml:link\b[^>]*>/g)].map(([tag]) => attributes(tag))
  for (const lang of [...locales, 'x-default']) {
    assert(links.some((link) => link.hreflang === lang && link.href === `${origin}/${lang === 'x-default' ? 'fr' : lang}${path}`), `Sitemap alternate ${lang}: ${location}`)
  }
}

const robotsResponse = await request('/robots.txt')
assert.equal(robotsResponse.status, 200)
assert.match(robotsResponse.headers.get('content-type') || '', /text\/plain/)
const robots = await robotsResponse.text()
if (indexable) {
  assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
  assert(!/^Disallow:\s*\/\s*$/m.test(robots), 'Production must permit crawling')
} else {
  assert.match(robots, /^Disallow: \/\s*$/m)
}

for (const lang of locales) {
  const titles = new Set()
  const descriptions = new Set()
  for (const path of paths) {
    const url = `/${lang}${path}`
    const response = await request(url)
    assert.equal(response.status, 200, url)
    assert(!/noindex/i.test(response.headers.get('x-robots-tag') || '') || !indexable, url)
    const html = await response.text()
    assert.match(html, new RegExp(`<html[^>]*lang="${lang}"`), url)
    assert.match(html, new RegExp(`<html[^>]*dir="${lang === 'ar' ? 'rtl' : 'ltr'}"`), url)
    assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length, 1, `One server-rendered H1: ${url}`)
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]
    assert(title && !titles.has(title), `Unique, nonempty title: ${url}`)
    titles.add(title)
    const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => attributes(tag))
    const description = metas.find((tag) => tag.name === 'description')?.content
    assert(description && !descriptions.has(description), `Unique, nonempty description: ${url}`)
    descriptions.add(description)
    const directive = metas.find((tag) => tag.name === 'robots')?.content || ''
    assert.match(directive, indexable ? /\bindex\b/ : /\bnoindex\b/, url)
    if (indexable) assert(!/noindex/.test(directive), url)
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attributes(tag))
    assert(links.some((link) => link.rel === 'canonical' && link.href === `${origin}${url}`), `Self-canonical: ${url}`)
    for (const alternate of [...locales, 'x-default']) {
      assert(links.some((link) => link.rel === 'alternate' && link.hreflang === alternate && link.href === `${origin}/${alternate === 'x-default' ? 'fr' : alternate}${path}`), `Page alternate ${alternate}: ${url}`)
    }
    assert(metas.some((tag) => tag.property === 'og:url' && tag.content === `${origin}${url}`), url)
    assert(metas.some((tag) => tag.name === 'twitter:card' && tag.content === 'summary_large_image'), url)
    const json = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1]
    const graph = JSON.parse(json)['@graph']
    assert(graph.some((item) => item['@type'] === 'AccountingService' && item.address.addressCountry === 'TN'), url)
    assert(graph.some((item) => item['@type'] === 'WebSite' && item.url === origin), url)
    for (const alternate of locales) {
      assert(html.includes(`href="/${alternate}${path}"`), `Crawlable language link ${alternate}: ${url}`)
    }
    if (process.env.SEO_EXPECT_GOOGLE_VERIFICATION) {
      assert(metas.some((tag) => tag.name === 'google-site-verification' && tag.content === process.env.SEO_EXPECT_GOOGLE_VERIFICATION), url)
    }
    if (process.env.SEO_EXPECT_BING_VERIFICATION) {
      assert(metas.some((tag) => tag.name === 'msvalidate.01' && tag.content === process.env.SEO_EXPECT_BING_VERIFICATION), url)
    }
  }
}

for (const lang of locales) {
  const response = await request('/', { headers: { 'Accept-Language': lang }, redirect: 'manual' })
  assert.equal(response.status, 307)
  assert.equal(new URL(response.headers.get('location'), base).pathname, `/${lang}`)
}
// Fetch controls the Host header itself; use the HTTP client to test a virtual host.
const wwwResponse = await new Promise((resolve, reject) => {
  const target = new URL('/fr/contact?source=seo', base)
  const client = target.protocol === 'https:' ? https : http
  const req = client.get(target, { headers: { Host: 'www.camconsult.com.tn' } }, (response) => {
    response.resume()
    resolve({ status: response.statusCode, location: response.headers.location })
  })
  req.setTimeout(30000, () => req.destroy(new Error('Host redirect check timed out')))
  req.on('error', reject)
})
assert.equal(wwwResponse.status, 308)
assert.equal(wwwResponse.location, `${origin}/fr/contact?source=seo`)
for (const path of ['/fr/this-page-does-not-exist', '/en/this-page-does-not-exist', '/ar/this-page-does-not-exist', '/zz/services']) {
  assert.equal((await request(path)).status, 404, `Real HTTP 404: ${path}`)
}
for (const path of ['/brand/logo-cabinet-navy.png', '/favicon.ico', '/icon.png', '/apple-icon.png']) {
  assert.equal((await request(path)).status, 200, `Discoverable image/icon: ${path}`)
}
console.log(`SEO checks passed: ${expectedUrls.length} pages, ${locations.length} sitemap URLs, language alternates, metadata, structured data, redirects, icons and 404s (indexable=${indexable}).`)
