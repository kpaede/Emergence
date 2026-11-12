import {t as tr} from '../i18n';
import type {App} from 'obsidian';
import {bibliographicReference,type BibliographicItem} from './bibliography';
import type {Concept, Edge, GraphSnapshot, LiteratureReference} from '../types';
import {assert} from '../util';

export interface CitationOccurrence {kind: string; raw: string; position?: {start: {line: number}}}
export type Resolution = {kind: 'missing' | 'ambiguous'} | {kind: 'unique'; item: {indexedKey: string}};
interface CitationInput {
 items?: ReadonlyMap<string,BibliographicItem>;
 occurrences: ReadonlyMap<string, readonly CitationOccurrence[]>;
 resolutions: ReadonlyMap<string, Resolution>;
 notes: ReadonlyMap<string, readonly string[]>;
 paths: ReadonlySet<string>;
 resolvedLinks: Record<string, Record<string, number>>;
 resolveLink(link: string, source: string): string | undefined;
}
/** Consume ZotLit's admitted citation facts; never parse or read note bodies here. */
export function citationGraph(input: CitationInput): {nodes: Concept[]; edges: Edge[]} {
 const nodes = new Map<string, Concept>(), edges = new Map<string, Edge>();
 const literature = new Set([...input.notes.values()].flat()), noteItems = new Map<string,string[]>();
 for(const [key,paths]of input.notes)for(const path of paths)noteItems.set(path,[...noteItems.get(path)??[],key]);
 for (const [source, occurrences] of input.occurrences) {
  if (!input.paths.has(source)) continue;
  for (const occurrence of occurrences) {
   let target: string | undefined,reference:LiteratureReference|undefined;
   if (occurrence.kind === 'citekey') {
    const resolution = input.resolutions.get(occurrence.raw) ?? {kind: 'missing'};
    const item=resolution.kind==='unique'?input.items?.get(resolution.item.indexedKey):undefined;
    reference=item?bibliographicReference(item,occurrence.raw):{citekey:occurrence.raw,...(resolution.kind==='unique'?{indexedKey:resolution.item.indexedKey}:{}),state:resolution.kind==='unique'?'noteless':resolution.kind};
    const notes = resolution.kind === 'unique' ? (input.notes.get(resolution.item.indexedKey) ?? []).filter(path => input.paths.has(path)) : [];
    target = notes.find(path => input.resolvedLinks[source]?.[path]) ?? notes[0];
    if (!target) {
     target = `zotlit:work:${encodeURIComponent(occurrence.raw)}`;
     nodes.set(target, {id: target, title: reference.title??`@${occurrence.raw}`, aliases: [], tags: [], type: 'cited-work', exists: false, mtime: 0, size: 0,
      citation: {reference,citekey: occurrence.raw, state: resolution.kind === 'unique' ? 'noteless' : resolution.kind,
       ...(resolution.kind === 'unique' ? {indexedKey: resolution.item.indexedKey} : {})}});
    }
   } else if (occurrence.kind === 'wikilink') {
    const path = input.resolveLink(occurrence.raw, source);
    if (path && literature.has(path) && input.paths.has(path)){target = path;const keys=noteItems.get(path)??[],item=keys.length===1?input.items?.get(keys[0]!):undefined;if(item)reference=bibliographicReference(item);}
   }
   if (!target || target === source) continue;
   const id = `zotlit:${JSON.stringify([source, target])}`;
   let edge = edges.get(id);
   if (!edge) {edge = {id, source, target, layer: 'zotlit', field: 'zitiert', explicit: true, provenance: 'ZotLit Citation Index', occurrences: []}; edges.set(id, edge);}
   if(reference)edge.reference=reference;
   const line = occurrence.position?.start.line;
   if (!edge.occurrences.some(o => o.line === line)) edge.occurrences.push({kind: 'body', ...(line === undefined ? {} : {line})});
  }
 }
 return {nodes: [...nodes.values()], edges: [...edges.values()]};
}

interface LibrarySearchRow {item: BibliographicItem; library: {name: string | null} | null}
interface LibrarySearch {search(query: string, options: {limit: number; libraries: readonly unknown[]}): Promise<readonly LibrarySearchRow[]>; close?(): void}

/** ZotLit 2.2 exposes an escape-hatch services getter, not a stable public plugin API. */
interface Services {
 bridge: {runSync<T>(effect: unknown): T; runPromise<T>(effect: unknown, options?: {signal: AbortSignal}): Promise<T>; subscribe(stream: unknown, changed: () => void): () => void; closed(): boolean};
 citationIndex: {current: unknown; events: unknown; citationsByPath(syntaxes: string[]): unknown};
 citationLookup: {changes: unknown; read(request: {citekeys: string[]}): unknown};
 settings?:{changes:unknown};profile?:{changes:unknown};
 noteIndex: {changes: unknown; getIndexedItemKeys: unknown; getNotesByItemKey(key: string): unknown};
 citekeyEditor?: {openCitekey(key: string, pane: string): unknown};
 showInLibrary?: {show(indexedKey: string): unknown};
 libraryScope?: {state: unknown};
 zoteroReads?:{reads:{ItemsByIndexedKeys(input:{indexedKeys:string[]}):unknown}};
 itemLookup?: LibrarySearch & {openSession?(): LibrarySearch};
}
function services(app: App): Services | undefined {
 try {
  const plugins = (app as App & {plugins?: {plugins?: Record<string, {services?: Services}>}}).plugins?.plugins;
  const s = plugins?.zotlit?.services;
  return s && typeof s.bridge?.runSync === 'function' && typeof s.bridge?.subscribe === 'function'
   && typeof s.citationIndex?.citationsByPath === 'function' && typeof s.citationLookup?.read === 'function'
   && typeof s.noteIndex?.getNotesByItemKey === 'function' && !s.bridge.closed() ? s : undefined;
 } catch {return undefined;}
}
/** Guarded adapter for ZotLit 2.2's own Library selection action. */
export async function openZotlitLibrary(app: App, target: {path?: string; citekey?: string; indexedKey?: string}): Promise<void> {
 const s = services(app);
 assert(s?.showInLibrary && typeof s.showInLibrary.show === 'function', tr("graph.the_zotlit_library_is_unavailable_enable_or_update_zotlit"));
 let key: string | undefined = target.indexedKey;
 if (!key && target.citekey) {
  const resolutions = await s.bridge.runPromise<{resolve(key: string): Resolution}>(s.citationLookup.read({citekeys: [target.citekey]}));
  const resolution = resolutions.resolve(target.citekey);
  assert(resolution?.kind === 'unique', resolution?.kind === 'ambiguous' ? tr("graph.the_citekey_is_ambiguous_in_zotlit_resolve_it_there") : tr("graph.the_citekey_has_not_been_resolved_in_zotlit_yet"));
  key = resolution.item.indexedKey;
 } else if (!key && target.path) {
  const keys = s.bridge.runSync<Iterable<string>>(s.noteIndex.getIndexedItemKeys);
  const matches: string[] = [];
  for (const candidate of keys) {
   const notes = s.bridge.runSync<readonly {path: string}[]>(s.noteIndex.getNotesByItemKey(candidate));
   if (notes.some(note => note.path === target.path)) matches.push(candidate);
  }
  assert(matches.length <= 1, tr("graph.this_literature_note_is_assigned_to_multiple_zotlit_entries_resolve_this"));
  key = matches[0];
 }
 assert(key, tr("graph.no_zotlit_entry_is_linked_to_this_reference"));
 await s.bridge.runPromise(s.showInLibrary.show(key));
}
export interface ZotlitSearchHit {indexedKey: string; title: string; citekey: string; detail: string; notes: string[]}
/** Override the lookup's scope per request, without changing ZotLit's saved settings. */
export async function searchZotlitLibrary(app: App, query: string, limit: number, signal: AbortSignal): Promise<ZotlitSearchHit[]> {
 const s = services(app);
 assert(s?.itemLookup && s.libraryScope, tr("graph.zotlit_search_is_unavailable"));
 const scope = s.bridge.runSync<{all: {available: readonly unknown[]} | null}>(s.libraryScope.state);
 assert(scope.all?.available.length, tr("graph.the_zotero_database_is_not_available_in_zotlit_yet"));
 if (signal.aborted) return [];
 const session = s.itemLookup.openSession?.() ?? s.itemLookup; let closed = false;
 const close = () => {if (!closed) {closed = true; session.close?.();}};
 signal.addEventListener('abort', close, {once: true});
 let hits: readonly LibrarySearchRow[];
 try {hits = await session.search(query, {limit, libraries: scope.all.available});}
 finally {signal.removeEventListener('abort', close); close();}
 if (signal.aborted) return [];
 return hits.map(({item,library})=>{const reference=bibliographicReference(item);return {indexedKey:item.indexedKey,title:reference.title??item.indexedKey,citekey:reference.citekey??'',detail:library?.name??'',notes:s.bridge.runSync<readonly {path:string}[]>(s.noteIndex.getNotesByItemKey(item.indexedKey)).map(note=>note.path)};});
}
export class ZotlitGraphAdapter {
 data = {nodes: [] as Concept[], edges: [] as Edge[]};
 state: NonNullable<GraphSnapshot['zotlit']> = {status: 'unavailable', message: tr("graph.the_zotlit_citation_index_is_unavailable"), edges: 0};
 private bound?: Services;
 private stops: (() => void)[] = [];
 private timer?: number;
 private abort?: AbortController;
 private lastRefresh = 0;
 private disposed = false;
 constructor(private app: App, private changed: () => void) {}
 ensure(): void {
  if (this.disposed) return;
  const s = services(this.app);
  if (s !== this.bound) {
   this.unbind(); this.bound = s; this.lastRefresh = 0;
   if (!s) {this.data = {nodes: [], edges: []}; this.state = {status: 'unavailable', message: tr("graph.the_zotlit_citation_index_is_unavailable"), edges: 0}; return;}
   this.state = {status: 'loading', message: tr("labels.connecting_zotlit_citation_index"), edges: 0};
   try {for (const stream of [s.citationIndex.events, s.citationLookup.changes, s.noteIndex.changes,...(s.settings?[s.settings.changes]:[]),...(s.profile?[s.profile.changes]:[])]) this.stops.push(s.bridge.subscribe(stream, () => this.schedule()));}
   catch {this.unbind(); this.bound = undefined; this.state = {status: 'error', message: tr("graph.the_zotlit_interface_is_incompatible"), edges: 0}; return;}
  }
  if (s && Date.now() - this.lastRefresh > 30000 && !this.abort) void this.refresh(s);
 }
 private schedule(): void {
  if (this.timer) window.clearTimeout(this.timer);
  this.timer = window.setTimeout(() => {this.timer = undefined; if (this.bound && !this.disposed) void this.refresh(this.bound);}, 250);
 }
 private async refresh(s: Services): Promise<void> {
  if (this.abort) {this.schedule(); return;}
  const abort = new AbortController(); this.abort = abort; this.lastRefresh = Date.now();
  const timeout = window.setTimeout(() => abort.abort(), 15000);
  try {
   const occurrences = s.bridge.runSync<ReadonlyMap<string, readonly CitationOccurrence[]>>(s.citationIndex.citationsByPath(['citekey', 'wikilink']));
   const keys = [...new Set([...occurrences.values()].flatMap(rows => rows.filter(row => row.kind === 'citekey').map(row => row.raw)))];
   const answer = keys.length ? await s.bridge.runPromise<{resolve(key: string): Resolution}>(s.citationLookup.read({citekeys: keys}), {signal: abort.signal}) : undefined;
   if (abort.signal.aborted || s !== this.bound || this.disposed) return;
   const notes = new Map<string, string[]>();
   for (const key of s.bridge.runSync<string[]>(s.noteIndex.getIndexedItemKeys)) notes.set(key, s.bridge.runSync<{path: string}[]>(s.noteIndex.getNotesByItemKey(key)).map(file => file.path));
   const resolutions=new Map(keys.map(key=>[key,answer!.resolve(key)])),wanted=new Set<string>();
   for(const resolution of resolutions.values())if(resolution.kind==='unique')wanted.add(resolution.item.indexedKey);
   const noteItems=new Map([...notes].flatMap(([key,paths])=>paths.map(path=>[path,key] as const)));
   for(const [source,rows]of occurrences)for(const row of rows)if(row.kind==='wikilink'){const path=this.app.metadataCache.getFirstLinkpathDest(row.raw,source)?.path,key=path?noteItems.get(path):undefined;if(key)wanted.add(key);}
   let items:ReadonlyMap<string,BibliographicItem>=new Map();
   if(wanted.size&&s.zoteroReads?.reads.ItemsByIndexedKeys)try{items=await s.bridge.runPromise(s.zoteroReads.reads.ItemsByIndexedKeys({indexedKeys:[...wanted]}),{signal:abort.signal});}catch{ /* Keep citation identities when metadata is temporarily unavailable. */ }
   if(abort.signal.aborted||s!==this.bound||this.disposed)return;
   const coverage = s.bridge.runSync<{coverage: string}>(s.citationIndex.current);
   this.data = citationGraph({occurrences, resolutions, items, notes,
    paths: new Set(this.app.vault.getFiles().map(file => file.path)), resolvedLinks: this.app.metadataCache.resolvedLinks,
    resolveLink: (link, source) => this.app.metadataCache.getFirstLinkpathDest(link, source)?.path});
   this.state = {status: coverage.coverage === 'complete' ? 'ready' : 'loading', message: coverage.coverage === 'complete' ? tr("labels.zotlit_citation_index_connected") : tr("labels.the_zotlit_citation_index_is_still_being_built"), edges: this.data.edges.length};
  } catch {
   if (s !== this.bound || this.disposed) return;
   this.data = {nodes: [], edges: []}; this.state = {status: 'error', message: tr("graph.the_zotlit_citation_index_could_not_be_read"), edges: 0};
  } finally {window.clearTimeout(timeout); if (this.abort === abort) this.abort = undefined;}
  if (!this.disposed && s === this.bound) this.changed();
 }
 private unbind(): void {this.abort?.abort(); this.abort = undefined; for (const stop of this.stops) stop(); this.stops = []; if (this.timer) window.clearTimeout(this.timer); this.timer = undefined;}
 dispose(): void {this.disposed = true; this.unbind(); this.bound = undefined;}
}
