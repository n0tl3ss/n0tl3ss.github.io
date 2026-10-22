import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const site = new URL('../site/', import.meta.url);
const pages = ['index.html', 'sr/index.html', 'privacy.html', 'sr/privacy.html'];

test('both languages and privacy pages have working navigation, assets and anchors', async () => {
  for (const page of pages) {
    const html = await readFile(new URL(page, site), 'utf8');
    assert.ok(html.includes(`<html lang="${page.startsWith('sr/') ? 'sr-Latn' : 'en'}">`));
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const url = new URL(href, `https://portfolio.test/${page}`);
      const path = url.pathname.slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
      const target = new URL(path, site);
      assert.ok((await stat(target)).isFile(), `${page}: ${href}`);
      if (url.hash) assert.ok((await readFile(target, 'utf8')).includes(`id="${url.hash.slice(1)}"`), `${page}: ${href}`);
    }
    const selector = html.match(/<div class="language-switch"[\s\S]*?<\/div>/)[0];
    const current = page.startsWith('sr/') ? 'SR' : 'EN';
    assert.match(selector, new RegExp(`aria-current="page">${current}</a>`));
    if (page.includes('privacy')) assert.match(html, /name="robots" content="noindex"/);
  }
});

test('localized profiles share identity and evidence while keeping distinct search URLs', async () => {
  const en = await readFile(new URL('index.html', site), 'utf8');
  const sr = await readFile(new URL('sr/index.html', site), 'utf8');
  const base = en.match(/<link rel="canonical" href="([^"]+)"/)[1];
  const externalLinks = html => [...html.matchAll(/<a\b[^>]*href="(https:[^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(externalLinks(sr), externalLinks(en));
  const fieldNames = html => [...html.matchAll(/<(?:input|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(fieldNames(sr), fieldNames(en));
  const sitemap = await readFile(new URL('sitemap.xml', site), 'utf8');
  for (const [html, lang, url] of [[en, 'en', base], [sr, 'sr-Latn', `${base}sr/`]]) {
    for (const [alternate, href] of [['en', base], ['sr-Latn', `${base}sr/`], ['x-default', base]]) {
      assert.ok(html.includes(`<link rel="alternate" hreflang="${alternate}" href="${href}">`));
    }
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
    assert.ok(html.includes(`property="og:url" content="${url}"`));
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
    const profile = graph.find(n => n['@type'] === 'ProfilePage');
    assert.equal(profile.inLanguage, lang);
    assert.equal(profile.url, url);
    assert.equal(profile.mainEntity['@id'], `${base}#person`);
    assert.equal(graph.find(n => n['@type'] === 'Person')['@id'], `${base}#person`);
    assert.deepEqual(graph.find(n => n['@type'] === 'WebSite').inLanguage, ['en', 'sr-Latn']);
    assert.ok(sitemap.includes(`<loc>${url}</loc>\n    <lastmod>${profile.dateModified}</lastmod>`));
    assert.equal((html.match(/data-cf-beacon=/g) || []).length, 1);
    assert.match(profile.dateCreated, /T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
  }
  assert.match(sr, /Ja sam Nemanja Mikić/);
  assert.match(sr, /Oba PDF dokumenta su na engleskom/);
});
