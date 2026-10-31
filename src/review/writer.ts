import type {GraphSnapshot, JournalEntry, Profile, Settings} from '../types';
import type {ReviewManager} from './manager';
import {assert, clone, hash} from '../util';
import {planFrontmatter, splitFrontmatter, parseFrontmatter, removeAddedLink, planManualLink} from './frontmatter';
import {validateSuggestion} from './validator';
import {fullWikilink, shortWikilink, preferredWikilink} from './wikilink';
import {needsTargetChoice} from './target-matches';

export interface FileVersion {mtime: number; size: number}
export interface WriterIO {
 read(path: string): Promise<string>;
 version(path: string): FileVersion | undefined;
 process(path: string, update: (text: string) => string): Promise<string>;
 resolve(link: string, source: string): string | undefined;
 refresh(path?: string): Promise<void>;
 saveJournal(entries: JournalEntry[]): Promise<void>;
}
export interface WritePreview {
 token: string; source: string; before: string; after: string; revision: number; signature: string;
 versions: Record<string, FileVersion>; targetHashes: Record<string, string>;
 absentTargets: string[];
 changes: {property: string; before: unknown; after: unknown; target: string}[];
 beforeFrontmatter: string; afterFrontmatter: string;
}
export class FrontmatterWriter {
 private previews = new Map<string, WritePreview>();
 private busy = false;
 constructor(private io: WriterIO, private review: ReviewManager, private graph: () => GraphSnapshot,
  private settings: () => Settings, private profile: () => Profile, readonly journal: JournalEntry[]) {}
 private signature(): string {return JSON.stringify({settings: this.settings(), fields: this.graph().fields, rules: this.graph().rules, inferenceRules: this.graph().inferenceRules, groups: this.graph().groups, edges: this.graph().edges, partial: this.graph().partial});}
 invalidate(): void {this.previews.clear();}
 async applyIdea(id: string): Promise<JournalEntry> {
  assert(!this.busy, 'Schreibvorgang läuft bereits.');
  this.review.refreshTargets(this.graph());
  const analysis = this.review.analysis, idea = analysis?.suggestions.find(s => s.id === id);
  assert(analysis?.status === 'complete' && analysis.perField && idea?.status === 'pending' && idea.contract === 'breadcrumbs-v2', 'Keine übernehmbare Beziehungsidee.');
  assert(!needsTargetChoice(idea), 'Bitte eine vorhandene Zielnotiz auswählen.');
  this.busy = true; this.invalidate();
  try {
   const revision = this.review.revision, signature = this.signature(), before = await this.io.read(idea.source);
   assert(Object.prototype.hasOwnProperty.call(parseFrontmatter(before).data, idea.field), 'Das Breadcrumbs-Feld ist nicht mehr im Frontmatter vorhanden.');
   assert(idea.value === fullWikilink(idea.target) || idea.value === shortWikilink(idea.target), 'Wiki-Link stimmt nicht mit der Zielnotiz überein.');
   const s = {...idea, value: preferredWikilink(idea, link => this.io.resolve(link, idea.source)), status: 'accepted' as const, sourceVersion: await hash(before)};
   const issues = validateSuggestion(s, this.graph(), before, this.profile());
   assert(!issues.some(i => i.level === 'block'), issues.filter(i => i.level === 'block').map(i => i.message).join('\n'));
   const plan = planFrontmatter(before, [s], item => preferredWikilink(item, value => this.io.resolve(value, item.source)), value => this.io.resolve(value, s.source));
   const targetVersion = this.io.version(s.target), beforeHash = s.sourceVersion, afterHash = await hash(plan.after);
   await this.io.process(s.source, current => {
    assert(current === before && revision === this.review.revision && signature === this.signature(), 'Notiz, Idee oder Konfiguration während der Übernahme verändert. Bitte erneut klicken.');
    assert(JSON.stringify(this.io.version(s.target)) === JSON.stringify(targetVersion), 'Die Zielnotiz wurde während der Übernahme verändert.');
    const resolved = this.io.resolve(s.value, s.source);
    assert(s.targetKind === 'existing' ? resolved === s.target : !this.io.version(s.target) && resolved === undefined, 'Die Zielnotiz hat inzwischen einen anderen Auflösungsstatus.');
    return plan.after;
   });
   const entry: JournalEntry = {id: crypto.randomUUID(), path: s.source, time: Date.now(), beforeHash, afterHash,
    beforeFrontmatter: plan.beforeFrontmatter, afterFrontmatter: plan.afterFrontmatter, status: 'applied', changes: [{property: s.property, target: s.target, value: s.value}]};
   this.journal.push(entry); if (this.journal.length > 20) this.journal.shift();
   this.review.consumeIdea(s.id, entry.id, afterHash);
   try {await this.io.saveJournal(this.journal); await this.io.refresh(s.source);}
   catch (error) {entry.status = 'refresh-failed'; throw new Error(`Link wurde ergänzt; Aktualisierung fehlgeschlagen. Rückgängig ist verfügbar. ${String(error)}`);}
   return clone(entry);
  } finally {this.busy = false;}
 }
 async addManualLink(source:string,property:string,target:string,targetKind:'existing'|'unresolved'):Promise<JournalEntry>{
  assert(!this.busy,'Schreibvorgang läuft bereits.');
  assert(this.graph().fields.includes(property),'Das Feld ist nicht mehr in Breadcrumbs konfiguriert.');
  assert(target.endsWith('.md')&&!/[[\]#|\r\n\0]/u.test(target),'Ungültiges Notizziel.');
  this.busy=true;this.invalidate();
  try{
   const before=await this.io.read(source),signature=this.signature(),targetVersion=this.io.version(target);
   assert(targetKind==='existing'?!!targetVersion:!targetVersion,'Die Zielnotiz hat inzwischen einen anderen Status.');
   const value=preferredWikilink({target,targetKind},link=>this.io.resolve(link,source));
   const plan=planManualLink(before,property,value,target,link=>this.io.resolve(link,source)),beforeHash=await hash(before),afterHash=await hash(plan.after);
   await this.io.process(source,current=>{
    assert(current===before&&signature===this.signature(),'Notiz oder Konfiguration inzwischen verändert. Bitte erneut hinzufügen.');
    assert(JSON.stringify(this.io.version(target))===JSON.stringify(targetVersion),'Die Zielnotiz wurde inzwischen verändert.');
    const resolved=this.io.resolve(value,source);assert(targetKind==='existing'?resolved===target:resolved===undefined,'Der Wiki-Link hat inzwischen ein anderes Ziel.');
    return plan.after;
   });
   const entry:JournalEntry={id:crypto.randomUUID(),path:source,time:Date.now(),beforeHash,afterHash,beforeFrontmatter:plan.beforeFrontmatter,afterFrontmatter:plan.afterFrontmatter,status:'applied',changes:[{property,target,value}]};
   this.journal.push(entry);if(this.journal.length>20)this.journal.shift();
   try{await this.io.saveJournal(this.journal);await this.io.refresh(source);}catch(error){entry.status='refresh-failed';throw new Error(`Link wurde ergänzt; Aktualisierung fehlgeschlagen. ${String(error)}`);}
   return clone(entry);
  }finally{this.busy=false;}
 }
 async undoIdea(id: string): Promise<void> {
  assert(!this.busy, 'Schreibvorgang läuft bereits.'); this.busy = true; this.invalidate();
  try {
   const entry = this.journal.find(j => j.id === id);
   assert(entry && entry.status !== 'undone' && entry.changes.length === 1, 'Keine einzeln rücknehmbare Idee.');
   const change = entry.changes[0]!, before = await this.io.read(entry.path);
   const after = removeAddedLink(before, change.property, change.value ?? fullWikilink(change.target), entry.beforeFrontmatter);
   await this.io.process(entry.path, current => {assert(current === before, 'Notiz während der Rücknahme verändert.'); return after;});
   entry.status = 'undone'; this.review.restoreIdea(id, await hash(after));
   await this.io.saveJournal(this.journal); await this.io.refresh(entry.path);
  } finally {this.busy = false;}
 }
 async preview(): Promise<WritePreview> {
  this.invalidate();
  const revision = this.review.revision, signature = this.signature(), suggestions = this.review.accepted();
  const source = suggestions[0]!.source;
  assert(suggestions.every(s => s.source === source), 'V1 verarbeitet pro Freigabe genau eine Quellnotiz.');
  const before = await this.io.read(source);
  assert(await hash(before) === suggestions[0]!.sourceVersion, 'Notiz seit der Analyse verändert. Bitte neu analysieren und prüfen.');
  const graph = clone(this.graph());
  const versions: Record<string, FileVersion> = {}, targetHashes: Record<string, string> = {};
  const absentTargets = suggestions.filter(s => s.targetKind === 'unresolved').map(s => s.target);
  for (const target of absentTargets) assert(!this.io.version(target) && !this.io.resolve(`[[${target.replace(/\.md$/u, '')}]]`, source), 'Neues Ziel ist bereits auflösbar. Zielart erneut prüfen.');
  for (const path of new Set([source, ...suggestions.filter(s => s.targetKind === 'existing').map(s => s.target)])) {
   const version = this.io.version(path); assert(version, `Datei ${path} fehlt.`); versions[path] = {...version};
   const text = await this.io.read(path); targetHashes[path] = await hash(text);
   const node = graph.nodes.find(n => n.id === path);
   assert(node && node.mtime === version.mtime && node.size === version.size, 'Graphindex ist veraltet. Aktualisieren und neu prüfen.');
  }
  for (const s of suggestions) {
   const issues = validateSuggestion(s, graph, before, this.profile());
   assert(!issues.some(i => i.level === 'block'), issues.map(i => i.message).join('\n'));
   // Earlier accepted edges participate in later cycle checks.
   graph.edges.push({id: s.id, source: s.source, target: s.target, field: s.field, layer: 'breadcrumbs', explicit: true, provenance: 'review-preview', occurrences: []});
  }
  const plan = planFrontmatter(before, suggestions, s => `[[${s.target.replace(/\.md$/u, '')}]]`, value => this.io.resolve(value, source));
  assert(revision === this.review.revision && signature === this.signature(), 'Review oder Konfiguration während der Vorschau verändert.');
  const preview = {token: crypto.randomUUID(), source, before, revision, signature, versions, targetHashes, absentTargets, ...plan};
  this.previews.set(preview.token, clone(preview)); return clone(preview);
 }
 async apply(token: string, finalConfirmation: boolean): Promise<void> {
  assert(finalConfirmation === true, 'Endgültige Bestätigung fehlt.');
  assert(!this.busy, 'Schreibvorgang läuft bereits.');
  const preview = this.previews.get(token); assert(preview, 'Freigabe fehlt oder ist veraltet. Diff erneut öffnen.');
  this.busy = true; this.invalidate();
  try {
   assert(preview.revision === this.review.revision && preview.signature === this.signature(), 'Review, Graph oder Konfiguration verändert. Neue Prüfung erforderlich.');
   this.review.accepted();
   for (const [path, expected] of Object.entries(preview.targetHashes)) assert(await hash(await this.io.read(path)) === expected, 'Quell- oder Zielnotiz seit dem Diff verändert. Neue Prüfung erforderlich.');
   const beforeHash = await hash(preview.before), afterHash = await hash(preview.after);
   await this.io.process(preview.source, current => {
    assert(current === preview.before, 'Notiz unmittelbar vor dem Schreiben verändert.');
    assert(preview.revision === this.review.revision && preview.signature === this.signature(), 'Freigabe nicht mehr gültig.');
    for (const [path, expected] of Object.entries(preview.versions)) assert(JSON.stringify(this.io.version(path)) === JSON.stringify(expected), 'Dateiversion unmittelbar vor dem Schreiben verändert.');
    for (const target of preview.absentTargets) assert(!this.io.version(target) && !this.io.resolve(`[[${target.replace(/\.md$/u, '')}]]`, preview.source), 'Ein zuvor fehlendes Ziel ist inzwischen auflösbar. Diff neu prüfen.');
    return preview.after;
   });
   const entry: JournalEntry = {id: crypto.randomUUID(), path: preview.source, time: Date.now(), beforeHash, afterHash,
    beforeFrontmatter: preview.beforeFrontmatter, afterFrontmatter: preview.afterFrontmatter, status: 'applied',
    changes: preview.changes.map(c => ({property: c.property, target: c.target}))};
   this.journal.push(entry); if (this.journal.length > 20) this.journal.shift();
   this.review.clear();
   try {await this.io.saveJournal(this.journal); await this.io.refresh(preview.source);}
   catch (error) {entry.status = 'refresh-failed'; try {await this.io.saveJournal(this.journal);} catch { /* In-memory journal still supports controlled undo. */ }
    throw new Error(`Datei wurde geschrieben; Journal/Graph-Aktualisierung fehlgeschlagen. Rücknahme ist verfügbar. ${String(error)}`);}
  } finally {this.busy = false;}
 }
 async undoPreview(id: string): Promise<{before: string; after: string}> {
  const entry = this.journal.find(j => j.id === id); assert(entry && entry.status !== 'undone', 'Keine rücknehmbare Änderung.');
  const before = await this.io.read(entry.path); assert(await hash(before) === entry.afterHash, 'Datei seit der Übernahme verändert; automatische Rücknahme gesperrt.');
  return {before, after: entry.beforeFrontmatter + splitFrontmatter(before).body};
 }
 async undo(id: string, expectedBefore: string, finalConfirmation: boolean): Promise<void> {
  assert(finalConfirmation && !this.busy, 'Bestätigung fehlt oder Schreibvorgang läuft.');
  this.busy = true;
  try {
   const entry = this.journal.find(j => j.id === id); assert(entry, 'Journal-Eintrag fehlt.');
   const preview = await this.undoPreview(id); assert(preview.before === expectedBefore, 'Rücknahmevorschau veraltet.');
   await this.io.process(entry.path, current => {assert(current === preview.before, 'Dateikonflikt bei Rücknahme.'); return preview.after;});
   entry.status = 'undone'; await this.io.saveJournal(this.journal); await this.io.refresh(entry.path);
  } finally {this.invalidate(); this.busy = false;}
 }
}
