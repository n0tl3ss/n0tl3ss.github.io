import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';

test('saved Apple acknowledgement retains its source and image integrity', async () => {
  const site = new URL('../site/', import.meta.url);
  const html = await readFile(new URL('index.html', site), 'utf8');
  const evidence = JSON.parse(await readFile(new URL('assets/apple-acknowledgement-provenance.json', site)));
  const image = await readFile(new URL(`assets/${evidence.image}`, site));
  assert.equal(evidence.sourceUrl, 'https://support.apple.com/en-gw/102774');
  assert.equal(evidence.section, 'November 2025');
  assert.equal(evidence.creditedName, 'Nemanja Mikic');
  assert.equal(createHash('sha256').update(image).digest('hex'), evidence.sha256);
  assert.equal(image.readUInt32BE(16), evidence.viewport.width);
  assert.equal(image.readUInt32BE(20), evidence.viewport.height);
  assert.ok(html.includes(evidence.sourceUrl));
  assert.ok(html.includes(evidence.image));
});
