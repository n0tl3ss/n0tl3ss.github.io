import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/theme.js', import.meta.url), 'utf8');
function page(saved, blocked = false) {
  const storage = new Map([['cv-theme', saved]]);
  const events = {};
  const windowEvents = {};
  const changes = [];
  const root = { dataset: {} };
  const meta = { setAttribute: (key, value) => { meta[key] = value; } };
  const label = {};
  const button = { hidden: true, setAttribute: (key, value) => { button[key] = value; }, addEventListener: (type, callback) => { events[type] = callback; } };
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('Storage denied'); return storage.get(key); },
    setItem(key, value) { if (blocked) throw new Error('Storage denied'); storage.set(key, value); }
  };
  vm.runInNewContext(source, {
    document: { documentElement: root, querySelector: selector => ({ 'meta[name="theme-color"]': meta, '#theme-toggle': button, '#theme-label': label })[selector], addEventListener: (type, callback) => { events[type] = callback; } },
    window: { dispatchEvent: event => changes.push(event.type), addEventListener: (type, callback) => { windowEvents[type] = callback; } },
    localStorage,
    Event: class { constructor(type) { this.type = type; } }
  });
  return { root, meta, label, button, storage, events, windowEvents, changes };
}

test('light is the default; the accessible switch changes and saves both themes', () => {
  const a = page();
  assert.equal(a.root.dataset.theme, 'light');
  a.events.DOMContentLoaded();
  assert.equal(a.button.hidden, false);
  assert.equal(a.button['aria-label'], 'Switch to dark theme');
  a.events.click();
  assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(a.meta.content, '#111c19');
  assert.equal(a.storage.get('cv-theme'), 'dark');
  assert.equal(a.label.textContent, 'Light');
  assert.equal(a.button['aria-label'], 'Switch to light theme');
  a.events.click();
  assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.storage.get('cv-theme'), 'light');
  assert.deepEqual(a.changes, ['themechange', 'themechange']);
});

test('saved dark preference applies before page content and survives page restoration', () => {
  const a = page('dark');
  assert.equal(a.root.dataset.theme, 'dark');
  assert.equal(a.meta.content, '#111c19');
  a.events.DOMContentLoaded();
  a.storage.set('cv-theme', 'light');
  a.windowEvents.pageshow({ persisted: true });
  assert.equal(a.root.dataset.theme, 'light');
  assert.equal(a.label.textContent, 'Dark');
  assert.deepEqual(a.changes, ['themechange']);
});

test('invalid preferences and blocked storage leave a usable theme switch', () => {
  for (const a of [page('unexpected'), page('dark', true)]) {
    assert.equal(a.root.dataset.theme, 'light');
    a.events.DOMContentLoaded();
    a.events.click();
    assert.equal(a.root.dataset.theme, 'dark');
    a.windowEvents.pageshow({ persisted: true });
  }
});
