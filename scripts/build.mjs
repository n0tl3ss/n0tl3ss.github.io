import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await cp(`${root}site`, `${root}dist`, { recursive: true, dereference: false });
await writeFile(`${root}dist/.nojekyll`, '');
console.log('Static site built in dist/');
