// Spike 1a (throwaway): write N unique small files into out/<dir>/f/.
// Usage: node generate.mjs <count> <dir>
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [count, dir] = [Number(process.argv[2]), process.argv[3]];
const root = join(import.meta.dirname, 'out', dir);
rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, 'f'), { recursive: true });
for (let i = 0; i < count; i++) {
  writeFileSync(join(root, 'f', `${String(i).padStart(5, '0')}.txt`), `spike file ${i}\n`);
}
console.log(`wrote ${count} files to ${root}`);
