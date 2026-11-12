import {t as tr} from '../i18n';
import {isMap, isScalar, isSeq, parseDocument} from 'yaml';
import type {Suggestion} from '../types';
import {assert, safeProperty} from '../util';

export interface FrontmatterParts {prefix: string; yaml: string; suffix: string; body: string; full: string}
export function splitFrontmatter(text: string): FrontmatterParts {
 const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(text);
 if (match) return {prefix: match[1]!, yaml: match[2]!, suffix: match[3]!, body: text.slice(match[0].length), full: match[0]};
 assert(!/^\uFEFF?---(?:\r?\n|$)/u.test(text), tr("common.frontmatter_is_not_properly_closed"));
 return {prefix: '---\n', yaml: '', suffix: '\n---\n', body: text, full: ''};
}
export function parseFrontmatter(text: string) {
 const parts = splitFrontmatter(text);
 const doc = parseDocument(parts.yaml, {keepSourceTokens: true, uniqueKeys: true, strict: true});
 assert(doc.errors.length === 0 && doc.warnings.length === 0, tr("common.invalid_or_unsupported_yaml_no_automatic_correction"));
 assert(!doc.contents || isMap(doc.contents), tr("common.frontmatter_must_be_a_yaml_map"));
 // Anchors, aliases and custom tags can make a local edit affect another property.
 assert(!/(^|\s)[&*!][^\s]+/mu.test(parts.yaml), tr("common.yaml_anchors_aliases_and_tags_require_manual_editing_outside_emergence"));
 const data: unknown = doc.toJS({maxAliasCount: 0});
 assert(data === null || (typeof data === 'object' && !Array.isArray(data)), tr("common.invalid_frontmatter_structure"));
 return {parts, doc, data: (data ?? {}) as Record<string, unknown>};
}

/** Remove only the link added by one click, preserving later edits to the rest of the note. */
export function removeAddedLink(text: string, property: string, link: string, originalFrontmatter: string): string {
 const {parts, doc, data} = parseFrontmatter(text), original = parseFrontmatter(originalFrontmatter).data[property];
 assert(Object.prototype.hasOwnProperty.call(data, property), tr("common.the_field_no_longer_exists"));
 const current: unknown = data[property];
 const values: unknown[] = Array.isArray(current) ? current : typeof current === 'string' ? [current] : [];
 assert(values.every(v => typeof v === 'string') && values.filter(v => v === link).length === 1, tr("common.the_added_link_can_no_longer_be_uniquely_identified"));
 const remaining = values.filter(v => v !== link), originalValues = Array.isArray(original) ? original : original == null ? [] : [original];
 doc.set(property, JSON.stringify(remaining) === JSON.stringify(originalValues) ? original : remaining);
 const after = parts.prefix + doc.toString({lineWidth: 0}).replace(/\n$/u, '') + parts.suffix + parts.body;
 const check = parseFrontmatter(after);
 assert(check.parts.body === parts.body, tr("common.note_text_would_change"));
 for (const [key, value] of Object.entries(data)) if (key !== property) assert(JSON.stringify(check.data[key]) === JSON.stringify(value), tr("common.an_unrelated_property_would_change"));
 return after;
}
export function planFrontmatter(text: string, suggestions: Suggestion[], linkFor: (s: Suggestion) => string, resolve: (value: string) => string | undefined) {
 const {parts, doc, data} = parseFrontmatter(text);
 const authorized = new Set(suggestions.map(s => s.property));
 const changes: {property: string; before: unknown; after: unknown; target: string}[] = [];
 for (const s of suggestions) {
  assert(s.status === 'accepted' && s.operation === 'add' && safeProperty(s.property), tr("common.unauthorized_change"));
  const link = linkFor(s);
  assert(link === s.value, tr("common.the_planned_value_does_not_match_the_wiki_link_generated_from"));
  assert(s.targetKind === 'existing' ? resolve(link) === s.target : resolve(link) === undefined, tr("common.the_wiki_link_does_not_have_the_selected_resolution_status"));
  const old: unknown = doc.get(s.property, true);
  const value = old === undefined || isScalar(old) && old.value === null ? [] : isSeq(old) ? old.items.map(n => {
   assert(isScalar(n) && typeof n.value === 'string', tr("common.the_target_field_contains_structured_or_non_text_values")); return n.value;
  }) : isScalar(old) && typeof old.value === 'string' ? [old.value] : null;
  assert(value, tr("common.the_target_field_is_not_a_text_list"));
  assert(!value.some(v => v === link || resolve(v) === s.target), tr("common.the_target_is_already_included_in_the_frontmatter"));
  const after = [...value, link]; doc.set(s.property, after);
  changes.push({property: s.property, before: data[s.property] ?? null, after, target: s.target});
 }
 const yaml = doc.toString({lineWidth: 0}).replace(/\n$/u, '');
 const after = parts.prefix + yaml + parts.suffix + parts.body;
 const parsed = parseFrontmatter(after);
 for (const [key, value] of Object.entries(data)) if (!authorized.has(key)) assert(JSON.stringify(parsed.data[key]) === JSON.stringify(value), tr("common.unrelated_property_would_change", {value1: key}));
 assert(parsed.parts.body === parts.body, tr("common.note_text_would_change"));
 return {after, beforeFrontmatter: parts.full, afterFrontmatter: parsed.parts.full, changes};
}

/** Explicit manual addition from the synopsis; preserve body and every unrelated property. */
export function planManualLink(text:string,property:string,link:string,target:string,resolve:(value:string)=>string|undefined){
 assert(safeProperty(property)&&/^\[\[[^[\]\r\n]+\]\]$/u.test(link),tr("common.invalid_field_or_wiki_link"));
 const {parts,doc,data}=parseFrontmatter(text),old:unknown=data[property];
 const values:unknown[]=old==null?[]:Array.isArray(old)?old:typeof old==='string'?[old]:[];
 assert(old==null||Array.isArray(old)||typeof old==='string',tr("common.the_target_field_is_not_a_text_list"));
 assert(values.every(v=>typeof v==='string'),tr("common.the_target_field_contains_non_text_values"));
 assert(!values.some(value=>value===link||typeof value==='string'&&resolve(value)===target),tr("common.the_link_already_exists_in_this_field"));
 doc.set(property,[...values,link]);
 const after=parts.prefix+doc.toString({lineWidth:0}).replace(/\n$/u,'')+parts.suffix+parts.body,check=parseFrontmatter(after);
 assert(check.parts.body===parts.body,tr("common.note_text_would_change"));
 for(const [key,value]of Object.entries(data))if(key!==property)assert(JSON.stringify(check.data[key])===JSON.stringify(value),tr("common.an_unrelated_property_would_change"));
 return {after,beforeFrontmatter:parts.full,afterFrontmatter:check.parts.full};
}
