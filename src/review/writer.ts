import {t as tr} from '../i18n';
import type {GraphSnapshot, JournalEntry, Profile, Settings} from '../types';
import type {ReviewManager} from './manager';
import {assert, clone, hash} from '../util';
import {planFrontmatter, splitFrontmatter, parseFrontmatter, removeAddedLink, planManualLink} from './frontmatter';
import {validateSuggestion} from './validator';
import {fullWikilink, shortWikilink, preferredWikilink} from './wikilink';
import {needsTargetChoice} from './target-matches';
import {moveManualLinks} from './move-link';
import type {StoredRelation} from '../graph/synopsis-assignments';
import {fieldAllowedForSource, frontmatterTags} from '../graph/field-scope';

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
 async moveLinks(origins: StoredRelation[], source: string, property: string, target: string): Promise<void> {
  assert(!this.busy, tr("common.a_write_operation_is_already_running")); this.busy = true; this.invalidate();
  try {
   const entries = await moveManualLinks(this.io, this.graph(), () => this.signature(), origins, source, property, target);
   this.journal.push(...entries); if (this.journal.length > 20) this.journal.splice(0, this.journal.length - 20);
   try {await this.io.saveJournal(this.journal); for (const entry of entries) await this.io.refresh(entry.path);}
   catch (error) {for (const entry of entries) entry.status = 'refresh-failed'; throw new Error(tr("common.the_concept_was_moved_refresh_failed", {value1: String(error)}));}
  } finally {this.busy = false;}
 }
 async applyIdea(id: string, field?: string): Promise<JournalEntry> {
  assert(!this.busy, tr("common.a_write_operation_is_already_running"));
  this.review.refreshTargets(this.graph());
  const analysis = this.review.analysis, pending = analysis?.suggestions.find(s => s.id === id);
  assert(analysis?.status === 'complete' && (analysis.perField || analysis.associative) && pending?.status === 'pending' && pending.contract === 'breadcrumbs-v2', tr("common.no_relation_idea_is_available_to_apply"));
  assert(!analysis.associative || field && analysis.fields?.includes(field), tr("common.select_a_breadcrumbs_field_as_the_target"));
  const idea = field ? {...pending, field, property: field} : pending;
  assert(!needsTargetChoice(idea), tr("common.select_an_existing_target_note"));
  this.busy = true; this.invalidate();
  try {
   const revision = this.review.revision, signature = this.signature(), before = await this.io.read(idea.source);
   assert(fieldAllowedForSource(idea.field, frontmatterTags(parseFrontmatter(before).data.tags), this.graph()), tr("common.this_field_is_only_available_for_notes_with_a_frontmatter_tag"));
   assert(Object.prototype.hasOwnProperty.call(parseFrontmatter(before).data, idea.field), tr("common.the_breadcrumbs_field_is_no_longer_present_in_the_frontmatter"));
   assert(idea.value === fullWikilink(idea.target) || idea.value === shortWikilink(idea.target), tr("common.the_wiki_link_does_not_match_the_target_note"));
   const s = {...idea, value: preferredWikilink(idea, link => this.io.resolve(link, idea.source)), status: 'accepted' as const, sourceVersion: await hash(before)};
   const issues = validateSuggestion(s, this.graph(), before, this.profile());
   assert(!issues.some(i => i.level === 'block'), issues.filter(i => i.level === 'block').map(i => i.message).join('\n'));
   const plan = planFrontmatter(before, [s], item => preferredWikilink(item, value => this.io.resolve(value, item.source)), value => this.io.resolve(value, s.source));
   const targetVersion = this.io.version(s.target), beforeHash = s.sourceVersion, afterHash = await hash(plan.after);
   await this.io.process(s.source, current => {
    assert(current === before && revision === this.review.revision && signature === this.signature(), tr("common.the_note_idea_or_configuration_changed_while_applying_click_again"));
    assert(JSON.stringify(this.io.version(s.target)) === JSON.stringify(targetVersion), tr("common.the_target_note_changed_while_applying"));
    const resolved = this.io.resolve(s.value, s.source);
    assert(s.targetKind === 'existing' ? resolved === s.target : !this.io.version(s.target) && resolved === undefined, tr("common.the_target_note_now_has_a_different_resolution_status"));
    return plan.after;
   });
   const entry: JournalEntry = {id: crypto.randomUUID(), path: s.source, time: Date.now(), beforeHash, afterHash,
    beforeFrontmatter: plan.beforeFrontmatter, afterFrontmatter: plan.afterFrontmatter, status: 'applied', changes: [{property: s.property, target: s.target, value: s.value}]};
   this.journal.push(entry); if (this.journal.length > 20) this.journal.shift();
   this.review.consumeIdea(s.id, entry.id, afterHash);
   try {await this.io.saveJournal(this.journal); await this.io.refresh(s.source);}
   catch (error) {entry.status = 'refresh-failed'; throw new Error(tr("common.the_link_was_added_refresh_failed_undo_is_available", {value1: String(error)}));}
   return clone(entry);
  } finally {this.busy = false;}
 }
 async addManualLink(source:string,property:string,target:string,targetKind:'existing'|'unresolved'):Promise<JournalEntry>{
  assert(!this.busy,tr("common.a_write_operation_is_already_running"));
  assert(this.graph().fields.includes(property),tr("common.the_field_is_no_longer_configured_in_breadcrumbs"));
  assert(target.endsWith('.md')&&!/[[\]#|\r\n\0]/u.test(target),tr("common.invalid_note_target"));
  this.busy=true;this.invalidate();
  try{
   const before=await this.io.read(source),signature=this.signature(),targetVersion=this.io.version(target);
   assert(fieldAllowedForSource(property,frontmatterTags(parseFrontmatter(before).data.tags),this.graph()),tr("common.this_field_is_only_available_for_notes_with_a_frontmatter_tag"));
   assert(targetKind==='existing'?!!targetVersion:!targetVersion,tr("common.the_target_note_now_has_a_different_status"));
   const value=preferredWikilink({target,targetKind},link=>this.io.resolve(link,source));
   const plan=planManualLink(before,property,value,target,link=>this.io.resolve(link,source)),beforeHash=await hash(before),afterHash=await hash(plan.after);
   await this.io.process(source,current=>{
    assert(current===before&&signature===this.signature(),tr("common.the_note_or_configuration_has_changed_add_it_again"));
    assert(JSON.stringify(this.io.version(target))===JSON.stringify(targetVersion),tr("common.the_target_note_has_changed"));
    const resolved=this.io.resolve(value,source);assert(targetKind==='existing'?resolved===target:resolved===undefined,tr("common.the_wiki_link_now_points_to_a_different_target"));
    return plan.after;
   });
   const entry:JournalEntry={id:crypto.randomUUID(),path:source,time:Date.now(),beforeHash,afterHash,beforeFrontmatter:plan.beforeFrontmatter,afterFrontmatter:plan.afterFrontmatter,status:'applied',changes:[{property,target,value}]};
   this.journal.push(entry);if(this.journal.length>20)this.journal.shift();
   try{await this.io.saveJournal(this.journal);await this.io.refresh(source);}catch(error){entry.status='refresh-failed';throw new Error(tr("common.the_link_was_added_refresh_failed", {value1: String(error)}));}
   return clone(entry);
  }finally{this.busy=false;}
 }
 async undoIdea(id: string): Promise<void> {
  assert(!this.busy, tr("common.a_write_operation_is_already_running")); this.busy = true; this.invalidate();
  try {
   const entry = this.journal.find(j => j.id === id);
   assert(entry && entry.kind !== 'move' && entry.status !== 'undone' && entry.changes.length === 1, tr("common.no_idea_can_be_undone_individually"));
   const change = entry.changes[0]!, before = await this.io.read(entry.path);
   const after = removeAddedLink(before, change.property, change.value ?? fullWikilink(change.target), entry.beforeFrontmatter);
   await this.io.process(entry.path, current => {assert(current === before, tr("common.the_note_changed_during_undo")); return after;});
   entry.status = 'undone'; this.review.restoreIdea(id, await hash(after));
   await this.io.saveJournal(this.journal); await this.io.refresh(entry.path);
  } finally {this.busy = false;}
 }
 async preview(): Promise<WritePreview> {
  this.invalidate();
  const revision = this.review.revision, signature = this.signature(), suggestions = this.review.accepted();
  const source = suggestions[0]!.source;
  assert(suggestions.every(s => s.source === source), tr("labels.v1_processes_exactly_one_source_note_per_approval"));
  const before = await this.io.read(source);
  assert(await hash(before) === suggestions[0]!.sourceVersion, tr("common.the_note_changed_after_analysis_analyze_and_review_it_again"));
  const graph = clone(this.graph());
  const versions: Record<string, FileVersion> = {}, targetHashes: Record<string, string> = {};
  const absentTargets = suggestions.filter(s => s.targetKind === 'unresolved').map(s => s.target);
  for (const target of absentTargets) assert(!this.io.version(target) && !this.io.resolve(`[[${target.replace(/\.md$/u, '')}]]`, source), tr("common.the_new_target_can_already_be_resolved_check_the_target_type"));
  for (const path of new Set([source, ...suggestions.filter(s => s.targetKind === 'existing').map(s => s.target)])) {
   const version = this.io.version(path); assert(version, tr("messages.writerFileMissing",{path})); versions[path] = {...version};
   const text = await this.io.read(path); targetHashes[path] = await hash(text);
   const node = graph.nodes.find(n => n.id === path);
   assert(node && node.mtime === version.mtime && node.size === version.size, tr("common.the_graph_index_is_stale_refresh_and_review_again"));
  }
  for (const s of suggestions) {
   const issues = validateSuggestion(s, graph, before, this.profile());
   assert(!issues.some(i => i.level === 'block'), issues.map(i => i.message).join('\n'));
   // Earlier accepted edges participate in later cycle checks.
   graph.edges.push({id: s.id, source: s.source, target: s.target, field: s.field, layer: 'breadcrumbs', explicit: true, provenance: 'review-preview', occurrences: []});
  }
  const plan = planFrontmatter(before, suggestions, s => `[[${s.target.replace(/\.md$/u, '')}]]`, value => this.io.resolve(value, source));
  assert(revision === this.review.revision && signature === this.signature(), tr("common.the_review_or_configuration_changed_during_preview"));
  const preview = {token: crypto.randomUUID(), source, before, revision, signature, versions, targetHashes, absentTargets, ...plan};
  this.previews.set(preview.token, clone(preview)); return clone(preview);
 }
 async apply(token: string, finalConfirmation: boolean): Promise<void> {
  assert(finalConfirmation === true, tr("common.final_confirmation_is_missing"));
  assert(!this.busy, tr("common.a_write_operation_is_already_running"));
  const preview = this.previews.get(token); assert(preview, tr("common.approval_is_missing_or_outdated_open_the_diff_again"));
  this.busy = true; this.invalidate();
  try {
   assert(preview.revision === this.review.revision && preview.signature === this.signature(), tr("common.the_review_graph_or_configuration_has_changed_review_again"));
   this.review.accepted();
   for (const [path, expected] of Object.entries(preview.targetHashes)) assert(await hash(await this.io.read(path)) === expected, tr("common.the_source_or_target_note_changed_after_the_diff_review_again"));
   const beforeHash = await hash(preview.before), afterHash = await hash(preview.after);
   await this.io.process(preview.source, current => {
    assert(current === preview.before, tr("common.the_note_changed_immediately_before_writing"));
    assert(preview.revision === this.review.revision && preview.signature === this.signature(), tr("common.approval_is_no_longer_valid"));
    for (const [path, expected] of Object.entries(preview.versions)) assert(JSON.stringify(this.io.version(path)) === JSON.stringify(expected), tr("common.the_file_version_changed_immediately_before_writing"));
    for (const target of preview.absentTargets) assert(!this.io.version(target) && !this.io.resolve(`[[${target.replace(/\.md$/u, '')}]]`, preview.source), tr("common.a_previously_missing_target_can_now_be_resolved_review_the_diff"));
    return preview.after;
   });
   const entry: JournalEntry = {id: crypto.randomUUID(), path: preview.source, time: Date.now(), beforeHash, afterHash,
    beforeFrontmatter: preview.beforeFrontmatter, afterFrontmatter: preview.afterFrontmatter, status: 'applied',
    changes: preview.changes.map(c => ({property: c.property, target: c.target}))};
   this.journal.push(entry); if (this.journal.length > 20) this.journal.shift();
   this.review.clear();
   try {await this.io.saveJournal(this.journal); await this.io.refresh(preview.source);}
   catch (error) {entry.status = 'refresh-failed'; try {await this.io.saveJournal(this.journal);} catch { /* In-memory journal still supports controlled undo. */ }
    throw new Error(tr("common.the_file_was_written_journal_or_graph_refresh_failed_undo_is", {value1: String(error)}));}
  } finally {this.busy = false;}
 }
 async undoPreview(id: string): Promise<{before: string; after: string}> {
  const entry = this.journal.find(j => j.id === id); assert(entry && entry.status !== 'undone', tr("common.no_change_is_available_to_undo"));
  const before = await this.io.read(entry.path); assert(await hash(before) === entry.afterHash, tr("common.the_file_changed_after_applying_automatic_undo_is_blocked"));
  return {before, after: entry.beforeFrontmatter + splitFrontmatter(before).body};
 }
 async undo(id: string, expectedBefore: string, finalConfirmation: boolean): Promise<void> {
  assert(finalConfirmation && !this.busy, tr("common.confirmation_is_missing_or_a_write_operation_is_running"));
  this.busy = true;
  try {
   const entry = this.journal.find(j => j.id === id); assert(entry, tr("labels.journal_entry_is_missing"));
   const preview = await this.undoPreview(id); assert(preview.before === expectedBefore, tr("common.the_undo_preview_is_outdated"));
   await this.io.process(entry.path, current => {assert(current === preview.before, tr("common.file_conflict_during_undo")); return preview.after;});
   entry.status = 'undone'; await this.io.saveJournal(this.journal); await this.io.refresh(entry.path);
  } finally {this.invalidate(); this.busy = false;}
 }
}
