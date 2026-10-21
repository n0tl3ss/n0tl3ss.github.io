import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const site = new URL('../site/', import.meta.url);
function metadata(html) {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  return { canonical, graph: schema['@graph'] };
}

test('search identity, canonical, structured data and sharing metadata agree', async () => {
  const html = await readFile(new URL('index.html', site), 'utf8');
  const { canonical, graph } = metadata(html);
  assert.ok(['https://n0tl3ss.github.io/', 'https://nmikic.rs/'].includes(canonical));
  assert.match(html, /<title>Nemanja Mikic \| Software Engineer at Oracle<\/title>/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.includes(`property="og:url" content="${canonical}"`));
  assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
  const person = graph.find(node => node['@type'] === 'Person');
  const profile = graph.find(node => node['@type'] === 'ProfilePage');
  const website = graph.find(node => node['@type'] === 'WebSite');
  assert.equal(person.name, 'Nemanja Mikić');
  assert.ok(person.alternateName.includes('Nemanja Mikic'));
  assert.equal(person.email, 'n0t_l3ss@outlook.com');
  assert.ok(html.includes(`mailto:${person.email}`));
  assert.equal(profile.mainEntity['@id'], person['@id']);
  assert.equal(profile.isPartOf['@id'], website['@id']);
  for (const date of [profile.dateCreated, profile.dateModified]) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/);
    assert.ok(Number.isFinite(Date.parse(date)));
  }
  assert.ok(Date.parse(profile.dateCreated) <= Date.parse(profile.dateModified));
  for (const node of graph) {
    assert.equal(node.url, canonical);
    assert.ok(node['@id'].startsWith(canonical));
  }
  const image = await readFile(new URL('assets/social-card.png', site));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
  assert.ok(html.includes(`property="og:image" content="${canonical}assets/social-card.png"`));
});

test('crawling files use the live canonical and keep the privacy page out of the sitemap', async () => {
  const { canonical, graph } = metadata(await readFile(new URL('index.html', site), 'utf8'));
  const robots = await readFile(new URL('robots.txt', site), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml', site), 'utf8');
  assert.ok(robots.includes(`Sitemap: ${canonical}sitemap.xml`));
  assert.match(robots, /Allow: \//);
  assert.ok(sitemap.includes(`<loc>${canonical}</loc>`));
  assert.ok(sitemap.includes(`<lastmod>${graph.find(node => node['@type'] === 'ProfilePage').dateModified}</lastmod>`));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  assert.doesNotMatch(sitemap, /privacy|\.pdf/);
  assert.match(await readFile(new URL('privacy.html', site), 'utf8'), /name="robots" content="noindex"/);
  if (canonical === 'https://nmikic.rs/') assert.equal(await readFile(new URL('CNAME', site), 'utf8'), 'nmikic.rs\n');
  else await assert.rejects(readFile(new URL('CNAME', site)), { code: 'ENOENT' });
});

test('domain activation and rollback update all canonical references and CNAME together', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'cv-domain-test-'));
  try {
    await mkdir(join(temp, 'scripts'));
    await mkdir(join(temp, 'site'));
    await copyFile(new URL('../scripts/set-site-url.mjs', import.meta.url), join(temp, 'scripts/set-site-url.mjs'));
    for (const file of ['index.html', 'robots.txt', 'sitemap.xml']) await copyFile(new URL(file, site), join(temp, 'site', file));
    for (const host of ['nmikic.rs', 'n0tl3ss.github.io']) {
      execFileSync(process.execPath, [join(temp, 'scripts/set-site-url.mjs'), `https://${host}`]);
      const html = await readFile(join(temp, 'site/index.html'), 'utf8');
      assert.equal(metadata(html).canonical, `https://${host}/`);
      const other = host === 'nmikic.rs' ? 'n0tl3ss.github.io' : 'nmikic.rs';
      for (const file of ['index.html', 'robots.txt', 'sitemap.xml']) assert.ok(!(await readFile(join(temp, 'site', file), 'utf8')).includes(other));
      if (host === 'nmikic.rs') assert.equal(await readFile(join(temp, 'site/CNAME'), 'utf8'), 'nmikic.rs\n');
      else await assert.rejects(readFile(join(temp, 'site/CNAME')), { code: 'ENOENT' });
    }
    assert.throws(() => execFileSync(process.execPath, [join(temp, 'scripts/set-site-url.mjs'), 'https://wrong.example'], { stdio: 'pipe' }));
  } finally { await rm(temp, { recursive: true, force: true }); }
});
