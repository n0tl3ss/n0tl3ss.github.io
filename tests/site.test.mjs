import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('local page links and assets resolve, without publishing private evidence', async () => {
  const root = new URL('../site/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    assert.ok((await stat(new URL(link, root))).isFile(), link);
  }
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`), anchor);
  assert.equal([...html.matchAll(/class="guide"/g)].length, 6);
  assert.doesNotMatch(html, /Vojvode|335g|64-52-43-955|SPREADSHEET_ID|TURNSTILE_SECRET/);
  for (const name of ['cv-one-page.pdf', 'cv-two-pages.pdf']) {
    const bytes = await readFile(new URL(`assets/${name}`, root));
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  }
});
test('contact configuration exposes only a public endpoint and site key', async () => {
  const source = await readFile(new URL('../site/contact-config.js', import.meta.url), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const config = sandbox.window.CONTACT_CONFIG;
  assert.deepEqual(Object.keys(config).sort(), ['endpoint', 'turnstileSiteKey']);
  if (config.endpoint || config.turnstileSiteKey) {
    assert.match(config.endpoint, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
    assert.match(config.turnstileSiteKey, /^[A-Za-z0-9_-]{10,100}$/);
  }
});
