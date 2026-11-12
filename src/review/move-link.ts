import {t as tr} from '../i18n';
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
 assert(safeProperty(relation.field), tr("common.invalid_source_field"));
 const values: unknown[] = Array.isArray(old) ? old : typeof old === 'string' ? [old] : [];
 assert(values.length && values.every(value => typeof value === 'string'), tr("common.the_source_field_is_not_a_text_list"));
 const matches = values.filter((value): value is string => {
  if (typeof value !== 'string' || !/^\[\[[^[\]\r\n]+\]\]$/u.test(value)) return false;
  const resolved = resolve(value);
  const path = /^\[\[([^|#\]]+)/u.exec(value)?.[1]?.replace(/\.md$/u, '');
  return resolved === relation.target || resolved === undefined && (path === relation.target.replace(/\.md$/u, '') || !path?.includes('/') && path === relation.target.split('/').at(-1)?.replace(/\.md$/u, ''));
 });
 assert(matches.length === 1, tr("common.the_original_link_can_no_longer_be_uniquely_identified_refresh_the"));
 doc.set(relation.field, values.filter(value => value !== matches[0]));
 const after = parts.prefix + doc.toString({lineWidth: 0}).replace(/\n$/u, '') + parts.suffix + parts.body;
 return {after, link: matches[0]!};
}

/** Prepare all affected notes before writing; roll back earlier writes on a later conflict. */
export async function moveManualLinks(io: WriterIO, graph: GraphSnapshot, signature: () => string, origins: StoredRelation[], source: string, property: string, target: string): Promise<JournalEntry[]> {
 assert(origins.length && graph.fields.includes(property), tr("common.no_movable_breadcrumbs_assignment"));
 assert(origins.every(origin => graph.fields.includes(origin.field)), tr("common.a_source_field_is_no_longer_configured"));
 assert(!origins.some(origin => origin.source === source && origin.target === target && origin.field === property), tr("common.this_concept_is_already_assigned_to_the_field"));
 const initialSignature = signature(), versions = new Map([...new Set([source, target, ...origins.flatMap(origin => [origin.source, origin.target])])].map(path => [path, io.version(path)]));
 const plans = new Map<string, {before: string; after: string; changes: JournalEntry['changes']}>();
 for (const path of new Set([source, ...origins.map(origin => origin.source)])) {
  assert(io.version(path), tr("common.an_involved_note_is_missing"));
  const before = await io.read(path); plans.set(path, {before, after: before, changes: []});
 }
 assert(fieldAllowedForSource(property, frontmatterTags(parseFrontmatter(plans.get(source)!.before).data.tags), graph), tr("common.this_field_is_only_available_for_notes_with_a_frontmatter_tag"));
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
 assert(targetKind === 'existing' ? io.resolve(link, source) === target : io.resolve(link, source) === undefined, tr("common.the_target_link_is_ambiguous"));
 const destination = plans.get(source)!;
 destination.after = planManualLink(destination.after, property, link, target, value => io.resolve(value, source)).after;
 destination.changes.push({property, target, value: link});
 const entries: JournalEntry[] = [];
 for (const [path, plan] of plans) {
  const before = parseFrontmatter(plan.before), after = parseFrontmatter(plan.after), authorized = new Set(plan.changes.map(change => change.property));
  assert(before.parts.body === after.parts.body, tr("common.note_text_would_change"));
  for (const [key, value] of Object.entries(before.data)) if (!authorized.has(key)) assert(JSON.stringify(value) === JSON.stringify(after.data[key]), tr("common.an_unrelated_property_would_change"));
  entries.push({id: crypto.randomUUID(), kind: 'move', path, time: Date.now(), beforeHash: await hash(plan.before), afterHash: await hash(plan.after), beforeFrontmatter: before.parts.full, afterFrontmatter: after.parts.full, status: 'applied', changes: plan.changes});
 }
 // Write removals first; no refresh occurs until the entire move has completed.
 const written: string[] = [];
 try {
  for (const [path, plan] of [...plans].sort(([a], [b]) => Number(a === source) - Number(b === source))) {
   await io.process(path, current => {
    assert(current === plan.before && signature() === initialSignature, tr("common.the_note_or_assignment_has_changed_move_it_again"));
    for (const [other, version] of versions) if (!written.includes(other)) assert(JSON.stringify(io.version(other)) === JSON.stringify(version), tr("common.an_involved_note_has_changed"));
    return plan.after;
   }); written.push(path);
  }
 } catch (error) {
  for (const path of written.reverse()) {
   const plan = plans.get(path)!;
   try {await io.process(path, current => {assert(current === plan.after, tr("common.file_conflict_during_undo")); return plan.before;});}
   catch {throw new Error(tr("common.move_incomplete_check_the_frontmatter_assignments_in", {value1: [...plans.keys()].join(', '), value2: String(error)}));}
  }
  throw error;
 }
 return entries;
}
