import { readFile, writeFile, rm } from 'node:fs/promises';

const url = process.argv[2]?.replace(/\/$/, '');
if (!['https://n0tl3ss.github.io', 'https://nmikic.rs'].includes(url)) {
  throw new Error('Use https://n0tl3ss.github.io or https://nmikic.rs. Connect and verify DNS before activating the custom domain.');
}
for (const file of ['index.html', 'robots.txt', 'sitemap.xml']) {
  const path = new URL(`../site/${file}`, import.meta.url);
  const content = await readFile(path, 'utf8');
  await writeFile(path, content.replaceAll(/https:\/\/(?:n0tl3ss\.github\.io|nmikic\.rs)\//g, `${url}/`));
}
const cname = new URL('../site/CNAME', import.meta.url);
if (url === 'https://nmikic.rs') await writeFile(cname, 'nmikic.rs\n');
else await rm(cname, { force: true });
console.log(`Canonical, structured data, sharing URLs, sitemap, robots and CNAME now use ${url}/. Commit and deploy together.`);
