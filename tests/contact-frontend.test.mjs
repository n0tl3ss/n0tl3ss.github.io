import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/main.js', import.meta.url), 'utf8');
function app(config = {}) {
  const events = {};
  const scripts = [];
  const fields = new Map();
  const nodes = new Map(['#send-message', '#form-status', '#year', '#request-id', '#recaptcha-container']
    .map(id => [id, {
      dataset: {},
      textContent: '',
      disabled: id === '#send-message',
      value: '',
      children: [],
      replaceChildren(...children) { this.children = children; },
      addEventListener: (type, callback) => { events[type] = callback; },
    }]));
  const form = {
    action: '',
    append(field) {
      fields.set(field.name, field);
    },
    querySelector(selector) {
      return selector === '[name="g-recaptcha-response"]'
        ? fields.get('g-recaptcha-response') || null
        : null;
    },
    addEventListener: (type, callback) => { events[type] = callback; },
  };
  nodes.set('#contact-form', form);
  const windowEvents = {};
  let serial = 0;
  let widgetOptions;
  const renderings = [];
  const resets = [];
  const root = { dataset: { theme: 'light' } };
  const window = {
    CONTACT_CONFIG: config,
    addEventListener: (type, callback) => { windowEvents[type] = callback; },
    grecaptcha: {
      enterprise: {
        render: (selector, options) => {
          const response = { name: 'g-recaptcha-response', value: '' };
          fields.set(response.name, response);
          const renderedOptions = {
            ...options,
            callback(token) {
              response.value = token;
              options.callback(token);
            },
          };
          widgetOptions = renderedOptions;
          renderings.push({ selector, options: renderedOptions, response });
          return `widget-${renderings.length}`;
        },
        reset: id => {
          resets.push(id);
          const response = fields.get('g-recaptcha-response');
          if (response) response.value = '';
        },
      },
    },
  };
  vm.runInNewContext(source, {
    window,
    crypto: { randomUUID: () => `request-${++serial}` },
    document: {
      documentElement: root,
      querySelector: selector => nodes.get(selector),
      createElement: tagName => ({ tagName, value: '', name: '', type: '', className: '' }),
      head: { append: script => scripts.push(script) },
    },
    Date,
  });
  return {
    nodes,
    window,
    windowEvents,
    scripts,
    resets,
    root,
    events,
    fields,
    renderings,
    options: () => widgetOptions,
  };
}
const live = { endpoint: 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT/exec', recaptchaSiteKey: 'public-test-sitekey' };

test('review mode makes no third-party request and prevents form submission', () => {
  const a = app();
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.scripts.length, 0);
  assert.match(a.nodes.get('#form-status').textContent, /currently unavailable/);
});

test('untrusted endpoint configuration cannot enable the form', () => {
  for (const endpoint of ['javascript:alert(1)', 'https://attacker.example/exec', 'https://script.google.com.attacker.example/macros/s/x/exec']) {
    const a = app({ ...live, endpoint });
    assert.equal(a.scripts.length, 0);
    assert.equal(a.nodes.get('#send-message').disabled, true);
  }
});

test('live mode waits for a contact checkbox challenge', () => {
  const a = app(live);
  assert.equal(a.nodes.get('#contact-form').action, live.endpoint);
  assert.match(a.scripts[0].src, /^https:\/\/www\.google\.com\/recaptcha\/enterprise\.js\?/);
  a.window.onRecaptchaReady();
  assert.equal(a.options().sitekey, live.recaptchaSiteKey);
  assert.equal(a.options().size, 'normal');
  assert.equal(a.renderings.length, 1);
  assert.equal(a.renderings[0].selector.tagName, 'div');
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.nodes.get('#form-status').textContent, 'Please complete the spam check before sending.');
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});

test('narrow screens use the compact checkbox variant', () => {
  const a = app(live);
  a.window.matchMedia = query => ({ matches: query === '(max-width: 344px)' });
  a.window.onRecaptchaReady();
  assert.equal(a.options().size, 'compact');
});

test('a solved checkbox permits native POST and prevents repeat clicks', () => {
  const a = app(live);
  a.window.onRecaptchaReady();
  a.options().callback('valid-server-verified-token');
  assert.equal(a.nodes.get('#send-message').disabled, false);
  assert.equal(a.fields.get('g-recaptcha-response').value, 'valid-server-verified-token');
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.match(a.nodes.get('#form-status').textContent, /Sending/);
});

test('expired challenges and restored pages invalidate old tokens', () => {
  const a = app(live);
  a.window.onRecaptchaReady();
  a.options().callback('old-token');
  a.options()['expired-callback']();
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.fields.get('g-recaptcha-response').value, '');
  a.options().callback('another-token');
  assert.equal(a.nodes.get('#send-message').disabled, false);
  const before = a.nodes.get('#request-id').value;
  a.windowEvents.pageshow({ persisted: true });
  assert.notEqual(a.nodes.get('#request-id').value, before);
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.resets.length, 2);
  a.options().callback('restored-token');
  assert.equal(a.nodes.get('#send-message').disabled, false);
});

test('provider loading failures leave submission disabled', () => {
  const a = app(live);
  a.scripts[0].onerror();
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.match(a.nodes.get('#form-status').textContent, /email link/);
});

test('changing themes replaces the checkbox widget and requires a fresh challenge', () => {
  const a = app(live);
  a.windowEvents.themechange(); // The provider may not have loaded yet.
  a.root.dataset.theme = 'dark';
  a.window.onRecaptchaReady();
  assert.equal(a.options().theme, 'dark');
  a.options().callback('previous-token');
  const oldOptions = a.options();
  const oldHost = a.renderings[0].selector;
  a.root.dataset.theme = 'light';
  a.windowEvents.themechange();
  assert.equal(a.options().theme, 'light');
  assert.equal(a.renderings.length, 2);
  assert.notEqual(a.renderings[1].selector, oldHost);
  oldOptions.callback('stale-token');
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.equal(a.fields.get('g-recaptcha-response').value, '');
  a.options().callback('fresh-token');
  assert.equal(a.fields.get('g-recaptcha-response').value, 'fresh-token');
  assert.equal(a.nodes.get('#send-message').disabled, false);
  let prevented = false;
  a.events.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
});


test('a missing provider API leaves an actionable fallback', () => {
  const a = app(live);
  a.window.grecaptcha = undefined;
  a.window.onRecaptchaReady();
  assert.equal(a.nodes.get('#send-message').disabled, true);
  assert.match(a.nodes.get('#form-status').textContent, /email link/);
});
