import {isMap, isScalar, isSeq, parseDocument} from 'yaml';
import type {Suggestion} from '../types';
import {assert, safeProperty} from '../util';

export interface FrontmatterParts {prefix: string; yaml: string; suffix: string; body: string; full: string}
export function splitFrontmatter(text: string): FrontmatterParts {
 const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/u.exec(text);
 if (match) return {prefix: match[1]!, yaml: match[2]!, suffix: match[3]!, body: text.slice(match[0].length), full: match[0]};
 assert(!/^\uFEFF?---(?:\r?\n|$)/u.test(text), 'Frontmatter ist nicht korrekt abgeschlossen.');
 return {prefix: '---\n', yaml: '', suffix: '\n---\n', body: text, full: ''};
}
export function parseFrontmatter(text: string) {
 const parts = splitFrontmatter(text);
 const doc = parseDocument(parts.yaml, {keepSourceTokens: true, uniqueKeys: true, strict: true});
 assert(doc.errors.length === 0 && doc.warnings.length === 0, 'Ungültiges oder nicht sicher unterstütztes YAML. Keine automatische Korrektur.');
 assert(!doc.contents || isMap(doc.contents), 'Frontmatter muss eine YAML-Map sein.');
 // Anchors, aliases and custom tags can make a local edit affect another property.
 assert(!/(^|\s)[&*!][^\s]+/mu.test(parts.yaml), 'YAML-Anker, Aliase und Tags erfordern manuelle Bearbeitung außerhalb von Emergence.');
 const data: unknown = doc.toJS({maxAliasCount: 0});
 assert(data === null || (typeof data === 'object' && !Array.isArray(data)), 'Ungültige Frontmatter-Struktur.');
 return {parts, doc, data: (data ?? {}) as Record<string, unknown>};
}

/** Remove only the link added by one click, preserving later edits to the rest of the note. */
export function removeAddedLink(text: string, property: string, link: string, originalFrontmatter: string): string {
 const {parts, doc, data} = parseFrontmatter(text), original = parseFrontmatter(originalFrontmatter).data[property];
 assert(Object.prototype.hasOwnProperty.call(data, property), 'Das Feld ist nicht mehr vorhanden.');
 const current: unknown = data[property];
 const values: unknown[] = Array.isArray(current) ? current : typeof current === 'string' ? [current] : [];
 assert(values.every(v => typeof v === 'string') && values.filter(v => v === link).length === 1, 'Der ergänzte Link ist nicht mehr eindeutig vorhanden.');
 const remaining = values.filter(v => v !== link), originalValues = Array.isArray(original) ? original : original == null ? [] : [original];
 doc.set(property, JSON.stringify(remaining) === JSON.stringify(originalValues) ? original : remaining);
 const after = parts.prefix + doc.toString({lineWidth: 0}).replace(/\n$/u, '') + parts.suffix + parts.body;
 const check = parseFrontmatter(after);
 assert(check.parts.body === parts.body, 'Notiztext würde verändert.');
 for (const [key, value] of Object.entries(data)) if (key !== property) assert(JSON.stringify(check.data[key]) === JSON.stringify(value), 'Unbeteiligte Property würde verändert.');
 return after;
}
export function planFrontmatter(text: string, suggestions: Suggestion[], linkFor: (s: Suggestion) => string, resolve: (value: string) => string | undefined) {
 const {parts, doc, data} = parseFrontmatter(text);
 const authorized = new Set(suggestions.map(s => s.property));
 const changes: {property: string; before: unknown; after: unknown; target: string}[] = [];
 for (const s of suggestions) {
  assert(s.status === 'accepted' && s.operation === 'add' && safeProperty(s.property), 'Nicht autorisierte Änderung.');
  const link = linkFor(s);
  assert(link === s.value, 'Geplanter Wert stimmt nicht mit dem aus der Ziel-ID erzeugten Wiki-Link überein.');
  assert(s.targetKind === 'existing' ? resolve(link) === s.target : resolve(link) === undefined, 'Wiki-Link hat nicht den ausgewählten Auflösungsstatus.');
  const old: unknown = doc.get(s.property, true);
  const value = old === undefined || isScalar(old) && old.value === null ? [] : isSeq(old) ? old.items.map(n => {
   assert(isScalar(n) && typeof n.value === 'string', 'Zielfeld enthält strukturierte/nicht-textuelle Werte.'); return n.value;
  }) : isScalar(old) && typeof old.value === 'string' ? [old.value] : null;
  assert(value, 'Zielfeld ist keine Textliste.');
  assert(!value.some(v => v === link || resolve(v) === s.target), 'Ziel ist im Frontmatter bereits enthalten.');
  const after = [...value, link]; doc.set(s.property, after);
  changes.push({property: s.property, before: data[s.property] ?? null, after, target: s.target});
 }
 const yaml = doc.toString({lineWidth: 0}).replace(/\n$/u, '');
 const after = parts.prefix + yaml + parts.suffix + parts.body;
 const parsed = parseFrontmatter(after);
 for (const [key, value] of Object.entries(data)) if (!authorized.has(key)) assert(JSON.stringify(parsed.data[key]) === JSON.stringify(value), `Unbeteiligte Property ${key} würde verändert.`);
 assert(parsed.parts.body === parts.body, 'Notiztext würde verändert.');
 return {after, beforeFrontmatter: parts.full, afterFrontmatter: parsed.parts.full, changes};
}

/** Explicit manual addition from the synopsis; preserve body and every unrelated property. */
export function planManualLink(text:string,property:string,link:string,target:string,resolve:(value:string)=>string|undefined){
 assert(safeProperty(property)&&/^\[\[[^[\]\r\n]+\]\]$/u.test(link),'Ungültiges Feld oder Wiki-Link.');
 const {parts,doc,data}=parseFrontmatter(text),old:unknown=data[property];
 const values:unknown[]=old==null?[]:Array.isArray(old)?old:typeof old==='string'?[old]:[];
 assert(old==null||Array.isArray(old)||typeof old==='string','Zielfeld ist keine Textliste.');
 assert(values.every(v=>typeof v==='string'),'Zielfeld enthält nicht-textuelle Werte.');
 assert(!values.some(value=>value===link||typeof value==='string'&&resolve(value)===target),'Der Link ist in diesem Feld bereits vorhanden.');
 doc.set(property,[...values,link]);
 const after=parts.prefix+doc.toString({lineWidth:0}).replace(/\n$/u,'')+parts.suffix+parts.body,check=parseFrontmatter(after);
 assert(check.parts.body===parts.body,'Notiztext würde verändert.');
 for(const [key,value]of Object.entries(data))if(key!==property)assert(JSON.stringify(check.data[key])===JSON.stringify(value),'Unbeteiligte Property würde verändert.');
 return {after,beforeFrontmatter:parts.full,afterFrontmatter:check.parts.full};
}
