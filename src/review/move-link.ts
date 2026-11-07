import type {GraphSnapshot, JournalEntry} from '../types';
import type {StoredRelation} from '../graph/synopsis-assignments';
import type {WriterIO} from './writer';
import {parseFrontmatter, planManualLink} from './frontmatter';
import {preferredWikilink} from './wikilink';
import {assert, hash, safeProperty} from '../util';
import {fieldAllowedForSource, frontmatterTags} from '../graph/field-scope';

/** Remove the actual stored spelling, retaining aliases on the moved link. */
function removeRelation(text: string, relation: StoredRelation, resolve: (value: string) => string | undefined): {after: string; link: string} {
 const {parts, doc, data} = parseFrontmatter(text), old = data[relation.field];
 assert(safeProperty(relation.field), 'Ungültiges Ausgangsfeld.');
 const values: unknown[] = Array.isArray(old) ? old : typeof old === 'string' ? [old] : [];
 assert(values.length && values.every(value => typeof value === 'string'), 'Ausgangsfeld ist keine Textliste.');
 const matches = values.filter((value): value is string => {
  if (typeof value !== 'string' || !/^\[\[[^[\]\r\n]+\]\]$/u.test(value)) return false;
  const resolved = resolve(value);
  const path = /^\[\[([^|#\]]+)/u.exec(value)?.[1]?.replace(/\.md$/u, '');
  return resolved === relation.target || resolved === undefined && (path === relation.target.replace(/\.md$/u, '') || !path?.includes('/') && path === relation.target.split('/').at(-1)?.replace(/\.md$/u, ''));
 });
 assert(matches.length === 1, 'Der ursprüngliche Link ist nicht mehr eindeutig vorhanden. Bitte den Graphen aktualisieren.');
 doc.set(relation.field, values.filter(value => value !== matches[0]));
 const after = parts.prefix + doc.toString({lineWidth: 0}).replace(/\n$/u, '') + parts.suffix + parts.body;
 return {after, link: matches[0]!};
}

/** Prepare all affected notes before writing; roll back earlier writes on a later conflict. */
export async function moveManualLinks(io: WriterIO, graph: GraphSnapshot, signature: () => string, origins: StoredRelation[], source: string, property: string, target: string): Promise<JournalEntry[]> {
 assert(origins.length && graph.fields.includes(property), 'Keine verschiebbare Breadcrumbs-Zuordnung.');
 assert(origins.every(origin => graph.fields.includes(origin.field)), 'Ein Ausgangsfeld ist nicht mehr konfiguriert.');
 assert(!origins.some(origin => origin.source === source && origin.target === target && origin.field === property), 'Der Begriff ist diesem Feld bereits zugeordnet.');
 const initialSignature = signature(), versions = new Map([...new Set([source, target, ...origins.flatMap(origin => [origin.source, origin.target])])].map(path => [path, io.version(path)]));
 const plans = new Map<string, {before: string; after: string; changes: JournalEntry['changes']}>();
 for (const path of new Set([source, ...origins.map(origin => origin.source)])) {
  assert(io.version(path), 'Eine beteiligte Notiz fehlt.');
  const before = await io.read(path); plans.set(path, {before, after: before, changes: []});
 }
 assert(fieldAllowedForSource(property, frontmatterTags(parseFrontmatter(plans.get(source)!.before).data.tags), graph), 'Dieses Feld ist nur für Notizen mit einem Frontmatter-Tag unter Werk verfügbar.');
 let alias: string | undefined;
 for (const origin of origins) {
  const plan = plans.get(origin.source)!;
  const removed = removeRelation(plan.after, origin, value => io.resolve(value, origin.source));
  if (origin.source === source && origin.target === target) alias = /\|([^\]]+)\]\]$/u.exec(removed.link)?.[1];
  plan.after = removed.after; plan.changes.push({property: origin.field, target: origin.target, value: removed.link});
 }
 const targetKind = io.version(target) ? 'existing' : 'unresolved';
 const base = preferredWikilink({target, targetKind}, value => io.resolve(value, source));
 const link = alias ? base.replace(/\]\]$/u, `|${alias}]]`) : base;
 assert(targetKind === 'existing' ? io.resolve(link, source) === target : io.resolve(link, source) === undefined, 'Der Ziel-Link ist nicht eindeutig.');
 const destination = plans.get(source)!;
 destination.after = planManualLink(destination.after, property, link, target, value => io.resolve(value, source)).after;
 destination.changes.push({property, target, value: link});
 const entries: JournalEntry[] = [];
 for (const [path, plan] of plans) {
  const before = parseFrontmatter(plan.before), after = parseFrontmatter(plan.after), authorized = new Set(plan.changes.map(change => change.property));
  assert(before.parts.body === after.parts.body, 'Notiztext würde verändert.');
  for (const [key, value] of Object.entries(before.data)) if (!authorized.has(key)) assert(JSON.stringify(value) === JSON.stringify(after.data[key]), 'Unbeteiligte Property würde verändert.');
  entries.push({id: crypto.randomUUID(), kind: 'move', path, time: Date.now(), beforeHash: await hash(plan.before), afterHash: await hash(plan.after), beforeFrontmatter: before.parts.full, afterFrontmatter: after.parts.full, status: 'applied', changes: plan.changes});
 }
 // Write removals first; no refresh occurs until the entire move has completed.
 const written: string[] = [];
 try {
  for (const [path, plan] of [...plans].sort(([a], [b]) => Number(a === source) - Number(b === source))) {
   await io.process(path, current => {
    assert(current === plan.before && signature() === initialSignature, 'Notiz oder Zuordnung inzwischen verändert. Bitte erneut verschieben.');
    for (const [other, version] of versions) if (!written.includes(other)) assert(JSON.stringify(io.version(other)) === JSON.stringify(version), 'Eine beteiligte Notiz wurde inzwischen verändert.');
    return plan.after;
   }); written.push(path);
  }
 } catch (error) {
  for (const path of written.reverse()) {
   const plan = plans.get(path)!;
   try {await io.process(path, current => {assert(current === plan.after, 'Dateikonflikt bei Rücknahme.'); return plan.before;});}
   catch {throw new Error(`Verschieben unvollständig. Bitte die Frontmatter-Zuordnungen in ${[...plans.keys()].join(', ')} prüfen. ${String(error)}`);}
  }
  throw error;
 }
 return entries;
}
