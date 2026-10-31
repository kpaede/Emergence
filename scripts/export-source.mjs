import {readFile, readdir, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [];
async function collect(folder) {
 for (const entry of await readdir(resolve(root, folder), {withFileTypes: true})) {
  const path = folder + '/' + entry.name;
  if (entry.isDirectory()) await collect(path);
  else paths.push(path);
 }
}
for (const folder of ['src', 'tests', 'scripts', '.github']) await collect(folder);
paths.push('package.json', 'package-lock.json', 'manifest.json', 'tsconfig.json', 'esbuild.config.mjs', 'eslint.config.mts', 'styles.css', 'versions.json', 'README.md', 'docs/VALIDATION.md');
let text = '# Emergence – vollständige Dateiinhalte\n\nAlle Implementierungsdateien, Konfiguration, Lockdatei und Prüfdokumentation der aktuellen Fassung. Das generierte Bundle liegt separat als main.js im Pluginordner.\n\n';
for (const path of paths.sort()) {
 const content = await readFile(resolve(root, path), 'utf8');
 text += '\n## ' + relative(root, resolve(root, path)) + '\n\n````' + (path.endsWith('.ts') ? 'typescript' : path.endsWith('.json') ? 'json' : path.endsWith('.css') ? 'css' : '') + '\n' + content + '\n````\n';
}
await writeFile(resolve(root, 'docs/source-complete.md'), text);
console.log('docs/source-complete.md · ' + paths.length + ' vollständige Dateien');
