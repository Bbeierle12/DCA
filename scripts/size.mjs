// Prints the gzip size of the built JS and fails if it exceeds the budget (KB).
// Usage: node scripts/size.mjs [budgetKB]
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const budgetKB = Number(process.argv[2] ?? 350);
const dir = 'dist/assets';
let raw = 0;
let gz = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const buf = readFileSync(join(dir, f));
  raw += buf.length;
  gz += gzipSync(buf).length;
}
const kb = n => (n / 1024).toFixed(1);
console.log(`JS bundle: ${kb(raw)} KB raw, ${kb(gz)} KB gzip (budget ${budgetKB} KB gzip)`);
if (gz / 1024 > budgetKB) {
  console.error('Bundle over budget.');
  process.exit(1);
}
