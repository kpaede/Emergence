import {readFile, readdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';

// Always use the existing enclosing development vault. No creation and no writes.
const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = resolve(plugin, '../../..');
const bcDir = join(vault, '.obsidian/plugins/breadcrumbs');
const manifestText = await readFile(join(bcDir, 'manifest.json'), 'utf8');
const configText = await readFile(join(bcDir, 'data.json'), 'utf8');
const configuration = JSON.parse(configText), manifest = JSON.parse(manifestText);
const checksum = text => createHash('sha256').update(text).digest('hex');
let markdown = 0, invalidYAML = 0, complexYAML = 0, fieldsUsed = 0;
const basenames = new Map();
const labels = configuration.edge_fields.map(f => f.label);
async function walk(folder) {
 for (const entry of await readdir(folder, {withFileTypes: true})) {
  if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
  const path = join(folder, entry.name);
  if (entry.isDirectory()) await walk(path);
  else if (entry.name.endsWith('.md')) {
   markdown++; basenames.set(entry.name, (basenames.get(entry.name) ?? 0) + 1);
   const text = await readFile(path, 'utf8');
   const fm = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text)?.[1];
   if (fm !== undefined) {
    const doc = parseDocument(fm, {uniqueKeys: true, strict: true});
    if (doc.errors.length) invalidYAML++;
    else {
     if (/(^|\s)[&*!][^\s]+/mu.test(fm)) complexYAML++;
     const data = doc.toJS({maxAliasCount: 100});
     if (data && typeof data === 'object' && labels.some(label => label in data)) fieldsUsed++;
    }
   }
  }
 }
}
await walk(vault);
if (checksum(await readFile(join(bcDir, 'data.json'), 'utf8')) !== checksum(configText)) throw new Error('Breadcrumbs configuration changed during inspection.');
const pkg = JSON.parse(await readFile(join(plugin, 'package.json'), 'utf8'));
const dependencies = {};
for (const name of ['cytoscape', 'cytoscape-elk', 'cytoscape-fcose', 'elkjs', 'obsidian']) {
 dependencies[name] = JSON.parse(await readFile(join(plugin, 'node_modules', name, 'package.json'), 'utf8')).version;
}
console.log(JSON.stringify({vault: vault.split('/').at(-1), markdown, ambiguousBasenames: [...basenames.values()].filter(n => n > 1).length,
 invalidYAML, complexYAML, notesWithEdgeProperties: fieldsUsed, breadcrumbs: manifest.version,
 fields: labels, groups: configuration.edge_field_groups, configSHA256: checksum(configText),
 dependencies, pluginVersion: pkg.version, notesWritten: 0, vaultCreated: false}, null, 2));
