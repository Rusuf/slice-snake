import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const files = ['server.mjs'];
for (const directory of ['src', 'scripts', 'tests']) {
  for (const file of await readdir(directory)) {
    if (/\.m?js$/.test(file)) files.push(`${directory}/${file}`);
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Syntax checked ${files.length} JavaScript modules.`);
