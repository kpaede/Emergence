import {t as tr} from './i18n';
import {MarkdownView, Notice, requestUrl, type App} from 'obsidian';
import type {AnalysisResult, JournalEntry, Profile, Settings, WikipediaContext, WikipediaRequest} from './types';
import {GraphService} from './graph/service';
import {OllamaProvider} from './llm/provider';
import {DocumentAnalyzer} from './llm/analyzer';
import {ReviewManager} from './review/manager';
import {FrontmatterWriter} from './review/writer';
import {assert, errorMessage} from './util';
import {sourceFields} from './llm/assignment-scope';
import type {AssignmentOptions} from './llm/assignment-context';
import {assignmentReadiness, type AssignmentBlocker} from './llm/assignment-readiness';
import {shortWikilink, targetTitle} from './review/wikilink';
import {existingTargetMatches} from './review/target-matches';
import {profilePrompts, withProfilePrompts, type ProfilePrompts} from './llm/profile-prompts';
import {validateSettings} from './config';
import {WikipediaProvider, type WikipediaLookup} from './llm/wikipedia';
import {synopsisAssignments} from './graph/synopsis-assignments';
import {fieldAllowedForSource, frontmatterTags} from './graph/field-scope';

import {WebSearchProvider, searchQuery, type WebSearchLookup, type WebSearchRequest, type WebSearchContext} from './llm/web-search';


export class EmergenceController {
 webSearch: WebSearchLookup = new WebSearchProvider(async (url,body) => {const response=await requestUrl({url,method:body?'POST':'GET',...(body?{body,contentType:'application/x-www-form-urlencoded'}:{}),throw:false});return {status:response.status,text:response.text};});
 readonly graph: GraphService;
 readonly provider: OllamaProvider;
 readonly analyzer: DocumentAnalyzer;
 wikipedia:WikipediaLookup=new WikipediaProvider();
 readonly review = new ReviewManager();
 readonly writer: FrontmatterWriter;
 activePath = ''; selection = ''; status = tr("common.ready"); ollamaStatus = tr("common.not_checked");
 abort?: AbortController;
 applyingIdea = false;
 lastIdeaEntry = '';
 profilePromptSave?: Promise<void>;
 private listeners = new Set<() => void>();
 private generation = 0;
 private fieldSelectionSave: Promise<void> = Promise.resolve();
 constructor(readonly app: App, readonly settings: () => Settings, saveJournal: (entries: JournalEntry[]) => Promise<void>, journal: JournalEntry[], readonly persist: () => Promise<void> = async () => {}) {
  this.graph = new GraphService(app, settings, () => this.notify());
  this.provider = new OllamaProvider(settings); this.analyzer = new DocumentAnalyzer(this.provider);
  this.writer = new FrontmatterWriter({
   read: async path => {const f = app.vault.getFileByPath(path); assert(f, tr("messages.fileMissing",{path})); return app.vault.read(f);},
   version: path => {const f = app.vault.getFileByPath(path); return f ? {mtime: f.stat.mtime, size: f.stat.size} : undefined;},
   process: async (path, update) => {const f = app.vault.getFileByPath(path); assert(f, tr("labels.file_is_missing")); return app.vault.process(f, current => {
    for (const leaf of app.workspace.getLeavesOfType('markdown')) {
     const view = leaf.view;
     if (view instanceof MarkdownView && view.file?.path === path && view.getMode() === 'source') assert(view.editor.getValue() === current, tr("common.the_editor_has_unsaved_changes_please_apply_again"));
    }
    return update(current);
   });},
   resolve: (link, source) => {
    const match = /^\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]$/u.exec(link);
    return match ? app.metadataCache.getFirstLinkpathDest(match[1]!, source)?.path : undefined;
   }, refresh: async path => {await this.graph.refreshBreadcrumbs(path); this.notify();}, saveJournal,
  }, this.review, () => this.graph.snapshot, settings, () => this.profile, journal);
 }
 get profile(): Profile {return this.settings().profiles.find(p => p.id === this.settings().activeProfile) ?? this.settings().profiles[0]!;}
 async saveProfilePrompts(id: string, base: ProfilePrompts, text: ProfilePrompts, version: number): Promise<void> {
  assert(!this.abort && !this.applyingIdea && !this.profilePromptSave, tr("common.an_action_is_already_running"));
  const s=this.settings(),index=s.profiles.findIndex(p=>p.id===id),previous=s.profiles[index];
  assert(previous && previous.version===version && JSON.stringify(profilePrompts(previous))===JSON.stringify(base),tr("common.the_profile_has_changed_discard_the_draft_and_edit_it_again"));
  const next=withProfilePrompts(previous,text);next.version=previous.version+1;
  validateSettings({...s,profiles:s.profiles.map((p,i)=>i===index?next:p)});
  s.profiles[index]=next;
  const work=(async()=>{try{await this.persist();this.invalidateAssignments();}
   catch(error){if(s.profiles[index]===next)s.profiles[index]=previous;throw error;}})();
  this.profilePromptSave=work;
  try{await work;}finally{if(this.profilePromptSave===work)this.profilePromptSave=undefined;}
 }
 get analysisFields(): string[] {return this.analysisFieldsFor(this.activePath);}
 analysisFieldsFor(source: string): string[] {
  const file = this.app.vault.getFileByPath(source), frontmatter = file ? this.app.metadataCache.getFileCache(file)?.frontmatter ?? {} : {};
  return this.graph.snapshot.fields.filter(field => Object.prototype.hasOwnProperty.call(frontmatter, field)
   && fieldAllowedForSource(field, frontmatterTags(frontmatter.tags), this.graph.snapshot));
 }
 async selectAnalysisFields(fields: string[], source = this.activePath): Promise<void> {
  assert(source.endsWith('.md'), tr("common.open_a_markdown_note_first"));
  const selections = this.settings().assignment.fieldsByNote, previous = selections[source];
  const next = [...new Set(fields)].filter(field => this.graph.snapshot.fields.includes(field)); selections[source] = next;
  this.invalidateAssignments();
  const save = this.fieldSelectionSave.catch(() => {}).then(() => this.persist()); this.fieldSelectionSave = save;
  try {await save;} catch (error) {
   if (selections[source] === next) {if (previous) selections[source] = previous; else delete selections[source]; this.notify();}
   throw error;
  }
 }
 invalidateAssignments(): void {
  this.generation++; this.abort?.abort(); this.review.clear(); this.writer.invalidate(); this.status = tr("common.assignment_settings_changed"); this.notify();
 }
 private async saveIdeaSource(path: string): Promise<void> {
  for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
   const view = leaf.view;
   if (view instanceof MarkdownView && view.file?.path === path && view.getMode() === 'source') await view.save();
  }
  await this.graph.refreshBreadcrumbs(path);
 }
 async addSynopsisLink(source:string,property:string,target:string,targetKind:'existing'|'unresolved'):Promise<void>{
  assert(!this.applyingIdea&&!this.abort&&!this.profilePromptSave,tr("common.an_action_is_already_running"));
  this.applyingIdea=true;this.notify();
  try{await this.saveIdeaSource(source);await this.writer.addManualLink(source,property,target,targetKind);this.status=tr("common.link_added", {value1: property});}
  finally{this.applyingIdea=false;this.notify();}
 }
 async moveSynopsisLink(focus: string, source: string, target: string, fields: string[], property: string): Promise<void> {
  assert(!this.applyingIdea && !this.abort && !this.profilePromptSave, tr("common.an_action_is_already_running"));
  this.applyingIdea = true; this.notify();
  try {
   const origins = synopsisAssignments(this.graph.snapshot, this.settings(), source, target, fields);
   assert(origins.length, tr("common.the_original_assignment_no_longer_exists"));
   for (const path of new Set([focus, ...origins.map(origin => origin.source)])) await this.saveIdeaSource(path);
   const current = synopsisAssignments(this.graph.snapshot, this.settings(), source, target, fields);
   assert(JSON.stringify(current) === JSON.stringify(origins), tr("common.the_assignment_has_changed_please_move_it_again"));
   await this.writer.moveLinks(current, focus, property, target); this.status = tr("messages.conceptMoved",{field:property});
  } finally {this.applyingIdea = false; this.notify();}
 }
 async applyIdea(id: string, field?: string): Promise<void> {
  assert(!this.applyingIdea && !this.abort && !this.profilePromptSave, tr("common.an_action_is_already_running"));
  const s = this.review.analysis?.suggestions.find(s => s.id === id); assert(s && s.source === this.activePath, tr("common.open_the_corresponding_note_first"));
  this.applyingIdea = true; this.status = tr("common.adding_link"); this.notify();
  try {await this.saveIdeaSource(s.source); const entry = await this.writer.applyIdea(id, field); this.lastIdeaEntry = entry.id; this.status = tr("common.link_applied", {value1: field ?? s.field});}
  finally {this.applyingIdea = false; this.notify();}
 }
 editIdea(id: string, input: string): void {
  assert(!this.applyingIdea && !this.abort, tr("common.an_action_is_already_running"));
  const a = this.review.analysis, s = a?.suggestions.find(s => s.id === id);
  assert((a?.perField || a?.associative) && s?.status === 'pending', tr("common.this_idea_is_no_longer_available"));
  const raw = input.trim(), title = (/^\[\[([^[\]#|\r\n]+)\]\]$/u.exec(raw)?.[1] ?? raw).replace(/\.md$/u, '').trim();
  assert(title && title.length <= 512 && !/[[\]#|:\r\n\0/\\]/u.test(title) && title !== '.' && title !== '..', tr("common.enter_a_single_term_without_a_path"));
  const selected = title === targetTitle(s.target) ? this.app.vault.getFileByPath(s.target) : null;
  const resolved = selected?.extension === 'md' ? selected : this.app.metadataCache.getFirstLinkpathDest(title, s.source);
  const matches = existingTargetMatches(title, this.graph.snapshot, s.source);
  const existing = resolved?.extension === 'md' ? resolved.path : matches[0]?.id;
  const folder = s.target.slice(0, Math.max(0, s.target.lastIndexOf('/')));
  const target = existing ?? `${folder ? folder + '/' : ''}${title}.md`;
  assert(target !== s.source, tr("common.the_source_note_cannot_be_its_own_target"));
  assert(matches.length > 1 || !a.suggestions.some(other => other.id !== id && other.status === 'pending' && other.field === s.field && other.target === target), tr("common.this_idea_already_exists_in_this_field"));
  this.review.edit(id, {target, targetKind: existing ? 'existing' : 'unresolved', field: s.field, property: s.property, value: shortWikilink(target),
   targetLabel: matches.length > 1 ? title : undefined, targetCandidates: matches.length > 1 ? matches.map(n => n.id) : undefined,
   targetSelected: matches.length > 1 ? !!s.targetSelected && title === targetTitle(s.target) && target === s.target : undefined});
 }
 chooseIdeaTarget(id: string, path: string): void {
  assert(!this.applyingIdea && !this.abort, tr("common.an_action_is_already_running"));
  this.review.refreshTargets(this.graph.snapshot);
  const s = this.review.analysis?.suggestions.find(s => s.id === id);
  assert(s?.status === 'pending' && s.targetCandidates?.includes(path) && this.graph.snapshot.nodes.some(n => n.id === path && n.exists), tr("common.this_existing_note_is_no_longer_available"));
  this.review.edit(id, {target: path, targetKind: 'existing', field: s.field, property: s.property, value: shortWikilink(path), targetSelected: true});
 }
 rejectIdea(id: string): void {
  assert(!this.applyingIdea, tr("common.applying_changes")); this.review.decide(id, 'rejected', this.graph.snapshot, '', this.profile); this.notify();
 }
 async undoIdea(id: string): Promise<void> {
  assert(!this.applyingIdea && !this.abort, tr("common.an_action_is_already_running"));
  const entry = this.writer.journal.find(j => j.id === id); assert(entry?.path === this.activePath, tr("common.open_the_corresponding_note_first"));
  this.applyingIdea = true; this.status = tr("common.undoing_link"); this.notify();
  try {await this.saveIdeaSource(entry.path); await this.writer.undoIdea(id); this.status = tr("common.link_undone"); this.lastIdeaEntry = '';}
  finally {this.applyingIdea = false; this.notify();}
 }
 assignmentBlockers(): AssignmentBlocker[] {return assignmentReadiness(this.activePath, this.analysisFields, this.graph.snapshot, this.settings(), this.profile);}
 assignmentOptions(content?: string): AssignmentOptions {
  const s = this.settings(), output = this.profile.outputs.find(o => o.kind === 'relations' && o.enabled);
  assert(output && output.maxSuggestions > 0, tr("common.no_relation_module_with_suggestions_is_enabled_in_this_profile"));
  const fields = (content === undefined ? this.analysisFields : sourceFields(content, this.graph.snapshot))
   .filter(field => this.graph.snapshot.fields.includes(field) && (!output.allowedEdgeTypes.length || output.allowedEdgeTypes.includes(field)));
  assert(fields.length, tr("common.select_the_breadcrumbs_fields_for_this_note"));
  assert(s.assignment.propertyFilter !== 'custom' || s.assignment.properties.length, tr("common.enter_at_least_one_frontmatter_key_as_a_target_filter"));
  const missing = fields.filter(field => !this.graph.snapshot.rules[field]?.description.trim());
  assert(!missing.length, tr("messages.fieldDescriptionMissing",{fields:missing.join(', ')}));
  return {fields: [...fields], folders: s.assignment.allFolders || !s.conceptFolders.length ? [] : [...s.conceptFolders], allowNew: s.assignment.allowNewTargets,
   maxSuggestions: fields.length * 4, associative: true, outputId: output.id,
   excludeExistingTargets: s.assignment.excludeExistingTargets,
   targetProperties: s.assignment.propertyFilter === 'breadcrumbs' ? this.graph.snapshot.fields : s.assignment.propertyFilter === 'custom' ? [...s.assignment.properties] : []};
 }
 subscribe(listener: () => void): () => void {this.listeners.add(listener); return () => this.listeners.delete(listener);}
 notify(): void {for (const listener of this.listeners) listener();}
 captureActive(): void {
  const view = this.app.workspace.getActiveViewOfType(MarkdownView);
  const recent = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit)?.view;
  const rootNote = recent instanceof MarkdownView ? recent : undefined;
  const active = view ?? this.app.workspace.activeEditor ?? rootNote;
  if (active?.file) {this.activePath = active.file.path; this.selection = active.editor?.getSelection() ?? '';}
 }
 rebuild(): void {this.graph.rebuild(); this.notify();}
 cancel(): void {this.abort?.abort(); this.provider.cancel(); this.status = tr("labels.cancellation_requested"); this.notify();}
 dispose(): void {this.cancel();this.wikipedia.clear?.();this.webSearch.clear?.();this.graph.dispose(); this.writer.invalidate(); this.listeners.clear();}
 clearSession(): void {this.generation++; this.cancel();this.wikipedia.clear?.();this.webSearch.clear?.();this.review.clear(); this.writer.invalidate(); this.notify();}
 private async lookupWikipedia(request:WikipediaRequest,source:string,signal:AbortSignal):Promise<WikipediaContext|undefined>{
  if(!request.enabled)return;
  const term=request.term?.trim()||targetTitle(source);this.status=`Wikipedia: ${term}`;this.notify();
  return this.wikipedia.lookup(term,signal);
 }
 private async lookupWeb(request:WebSearchRequest,source:string,signal:AbortSignal):Promise<WebSearchContext|undefined>{
  if(!request.enabled)return;const query=searchQuery(request.term?.trim()||targetTitle(source),request.goal);this.status=tr("labels.web_search")+query;this.notify();return this.webSearch.lookup(query,signal);
 }
 async analyze(online:WikipediaRequest={},search:WebSearchRequest={}): Promise<void> {
  assert(!this.abort && !this.applyingIdea && !this.profilePromptSave, tr("common.a_request_or_profile_save_is_already_running"));
  this.captureActive();
  const file = this.app.vault.getFileByPath(this.activePath); assert(file?.extension === 'md', tr("common.open_a_markdown_note_first"));
  this.assignmentOptions(); this.review.clear(); const abort=this.abort = new AbortController(); this.status = tr("common.preparing_associations"); this.notify();
  const generation = this.generation,started=performance.now();
  try {
   const editor = this.app.workspace.activeEditor;
   const content = editor?.file?.path === file.path && editor.editor ? editor.editor.getValue() : await this.app.vault.read(file);
   const [wikipedia,webSearch]=await Promise.all([this.lookupWikipedia(online,file.path,abort.signal),this.lookupWeb(search,file.path,abort.signal)]);
   const result: AnalysisResult = await this.analyzer.analyze(file.path, content, this.graph.snapshot, this.profile, this.settings(), abort.signal,
    progress => {if(!abort.signal.aborted){this.status = progress; this.notify();}}, {...this.assignmentOptions(content),...(wikipedia?{wikipedia}:{}),...(webSearch?{webSearch}:{})});
   result.elapsedMs=Math.round(performance.now()-started);
   if (generation === this.generation) {this.review.set(result); this.status = tr(result.status==='complete'?'messages.associationsComplete':'messages.associationsIncomplete',{count:result.suggestions.length}); this.ollamaStatus = tr('messages.reachable');}
  } catch (error) {this.status = errorMessage(error); throw error;}
  finally {if(this.abort===abort)this.abort = undefined; this.notify();}
 }
 async checkConnection(): Promise<string[]> {
  try {const info = await this.provider.health(); this.ollamaStatus = tr("messages.connectedThinking",{version:info.version,status:info.thinking?tr("common.available"):tr("common.not_reported")}); this.notify(); return info.models;}
  catch (error) {this.ollamaStatus = errorMessage(error); this.notify(); throw error;}
 }
 async run(action: () => unknown): Promise<void> {try {await action();} catch (error) {new Notice(errorMessage(error), 9000);}}
}
