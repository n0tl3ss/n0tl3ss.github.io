import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/main.js', import.meta.url), 'utf8');
function app(config = {}) {
  const events = {};
  const scripts = [];
  const nodes = new Map(['#contact-form','#send-message','#form-status','#year','#request-id'].map(id => [id, { dataset: {}, textContent: '', disabled: id === '#send-message', addEventListener: (type, callback) => { events[type] = callback; } }]));
  const windowEvents = {};
  let serial = 0;
  let widgetOptions;
  const resets = [];
  const window = { CONTACT_CONFIG: config, addEventListener: (type, callback) => { windowEvents[type] = callback; }, turnstile: { render: (selector, options) => { widgetOptions = options; return 'widget-1'; }, reset: id => resets.push(id) } };
  vm.runInNewContext(source, { window, crypto: { randomUUID: () => `request-${++serial}` }, document: { querySelector: selector => nodes.get(selector), createElement: () => ({}), head: { append: script => scripts.push(script) } }, Date });
  return { nodes, window, windowEvents, scripts, resets, events, options: () => widgetOptions };
}
const live = { endpoint: 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT/exec', turnstileSiteKey: 'public-test-sitekey' };

test('review mode makes no third-party request and prevents form submission', () => {
  const a = app();
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.scripts.length, 0);
  assert.match(a.nodes.get('#form-status').textContent, /does not send/);
});
test('untrusted endpoint configuration cannot enable the form', () => {
  for (const endpoint of ['javascript:alert(1)', 'https://attacker.example/exec', 'https://script.google.com.attacker.example/macros/s/x/exec']) {
    const a = app({ ...live, endpoint });
    assert.equal(a.scripts.length, 0);
    assert.equal(a.nodes.get('#send-message').disabled, true);
  }
});
test('live mode waits for a contact-specific Turnstile challenge', () => {
  const a = app(live);
  assert.equal(a.nodes.get('#contact-form').action, live.endpoint);
  assert.match(a.scripts[0].src, /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?/);
  a.window.onTurnstileReady();
  assert.equal(a.options().action, 'contact');
  assert.equal(a.options().sitekey, live.turnstileSiteKey);
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});
test('a solved challenge permits native POST and prevents repeat clicks', () => {
  const a = app(live);
  a.window.onTurnstileReady();
  a.options().callback('valid-server-verified-token');
  assert.equal(a.nodes.get('#send-message').disabled, false);
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.match(a.nodes.get('#form-status').textContent, /Sending/);
});
test('expired challenges and restored pages invalidate old tokens', () => {
  const a = app(live);
  a.window.onTurnstileReady();
  a.options().callback('old-token');
  a.options()['expired-callback']();
  assert.equal(a.nodes.get('#send-message').disabled, true);
  a.options().callback('another-token');
  const before = a.nodes.get('#request-id').value;
  a.windowEvents.pageshow({ persisted: true });
  assert.notEqual(a.nodes.get('#request-id').value, before);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.resets.length, 2);
});
test('provider loading failures leave submission disabled', () => {
  const a = app(live);
  a.scripts[0].onerror();
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.match(a.nodes.get('#form-status').textContent, /email link/);
});
