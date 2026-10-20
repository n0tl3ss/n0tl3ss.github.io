import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const sandbox = { window: {} };
vm.runInNewContext(await readFile(new URL('../site/contact-config.js', import.meta.url), 'utf8'), sandbox);
const config = sandbox.window.CONTACT_CONFIG || {};
if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint || '')
    || !/^[A-Za-z0-9_-]{10,100}$/.test(config.turnstileSiteKey || '')
    || /^[123]x0{10,}/.test(config.turnstileSiteKey)) {
  throw new Error('Live contact settings are not configured. Review the site and connect Apps Script + Turnstile before publishing.');
}
console.log('Public contact configuration is present. Verify live delivery after deployment.');
