import type {App} from 'obsidian';
import type {Concept, Edge, GraphSnapshot} from '../types';
import {assert} from '../util';

export interface CitationOccurrence {kind: string; raw: string; position?: {start: {line: number}}}
export type Resolution = {kind: 'missing' | 'ambiguous'} | {kind: 'unique'; item: {indexedKey: string}};
interface CitationInput {
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
 const literature = new Set([...input.notes.values()].flat());
 for (const [source, occurrences] of input.occurrences) {
  if (!input.paths.has(source)) continue;
  for (const occurrence of occurrences) {
   let target: string | undefined;
   if (occurrence.kind === 'citekey') {
    const resolution = input.resolutions.get(occurrence.raw) ?? {kind: 'missing'};
    const notes = resolution.kind === 'unique' ? (input.notes.get(resolution.item.indexedKey) ?? []).filter(path => input.paths.has(path)) : [];
    target = notes.find(path => input.resolvedLinks[source]?.[path]) ?? notes[0];
    if (!target) {
     target = `zotlit:work:${encodeURIComponent(occurrence.raw)}`;
     nodes.set(target, {id: target, title: `@${occurrence.raw}`, aliases: [], tags: [], type: 'cited-work', exists: false, mtime: 0, size: 0,
      citation: {citekey: occurrence.raw, state: resolution.kind === 'unique' ? 'noteless' : resolution.kind,
       ...(resolution.kind === 'unique' ? {indexedKey: resolution.item.indexedKey} : {})}});
    }
   } else if (occurrence.kind === 'wikilink') {
    const path = input.resolveLink(occurrence.raw, source);
    if (path && literature.has(path) && input.paths.has(path)) target = path;
   }
   if (!target || target === source) continue;
   const id = `zotlit:${JSON.stringify([source, target])}`;
   let edge = edges.get(id);
   if (!edge) {edge = {id, source, target, layer: 'zotlit', field: 'zitiert', explicit: true, provenance: 'ZotLit Citation Index', occurrences: []}; edges.set(id, edge);}
   const line = occurrence.position?.start.line;
   if (!edge.occurrences.some(o => o.line === line)) edge.occurrences.push({kind: 'body', ...(line === undefined ? {} : {line})});
  }
 }
 return {nodes: [...nodes.values()], edges: [...edges.values()]};
}

interface LibrarySearchRow {item: {indexedKey: string; fields: {title?: string; citationKey?: string; date?: string}; baseFields?: {title?: string}; creators: {firstName: string | null; lastName: string | null}[]}; library: {name: string | null} | null}
interface LibrarySearch {search(query: string, options: {limit: number; libraries: readonly unknown[]}): Promise<readonly LibrarySearchRow[]>; close?(): void}

/** ZotLit 2.2 exposes an escape-hatch services getter, not a stable public plugin API. */
interface Services {
 bridge: {runSync<T>(effect: unknown): T; runPromise<T>(effect: unknown, options?: {signal: AbortSignal}): Promise<T>; subscribe(stream: unknown, changed: () => void): () => void; closed(): boolean};
 citationIndex: {current: unknown; events: unknown; citationsByPath(syntaxes: string[]): unknown};
 citationLookup: {changes: unknown; read(request: {citekeys: string[]}): unknown};
 noteIndex: {changes: unknown; getIndexedItemKeys: unknown; getNotesByItemKey(key: string): unknown};
 citekeyEditor?: {openCitekey(key: string, pane: string): unknown};
 showInLibrary?: {show(indexedKey: string): unknown};
 libraryScope?: {state: unknown};
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
 assert(s?.showInLibrary && typeof s.showInLibrary.show === 'function', 'Die ZotLit Library ist nicht verfügbar. ZotLit aktivieren oder aktualisieren.');
 let key: string | undefined = target.indexedKey;
 if (!key && target.citekey) {
  const resolutions = await s.bridge.runPromise<{resolve(key: string): Resolution}>(s.citationLookup.read({citekeys: [target.citekey]}));
  const resolution = resolutions.resolve(target.citekey);
  assert(resolution?.kind === 'unique', resolution?.kind === 'ambiguous' ? 'Der Citekey ist in ZotLit mehrdeutig. Bitte dort auflösen.' : 'Der Citekey ist in ZotLit noch nicht aufgelöst.');
  key = resolution.item.indexedKey;
 } else if (!key && target.path) {
  const keys = s.bridge.runSync<Iterable<string>>(s.noteIndex.getIndexedItemKeys);
  const matches: string[] = [];
  for (const candidate of keys) {
   const notes = s.bridge.runSync<readonly {path: string}[]>(s.noteIndex.getNotesByItemKey(candidate));
   if (notes.some(note => note.path === target.path)) matches.push(candidate);
  }
  assert(matches.length <= 1, 'Diese Literaturnotiz ist mehreren ZotLit-Einträgen zugeordnet. Bitte in ZotLit klären.');
  key = matches[0];
 }
 assert(key, 'Für diese Literaturangabe ist kein ZotLit-Eintrag verknüpft.');
 await s.bridge.runPromise(s.showInLibrary.show(key));
}
export interface ZotlitSearchHit {indexedKey: string; title: string; citekey: string; detail: string; notes: string[]}
/** Override the lookup's scope per request, without changing ZotLit's saved settings. */
export async function searchZotlitLibrary(app: App, query: string, limit: number, signal: AbortSignal): Promise<ZotlitSearchHit[]> {
 const s = services(app);
 assert(s?.itemLookup && s.libraryScope, 'ZotLit-Suche nicht verfügbar.');
 const scope = s.bridge.runSync<{all: {available: readonly unknown[]} | null}>(s.libraryScope.state);
 assert(scope.all?.available.length, 'Zotero-Datenbank in ZotLit noch nicht verfügbar.');
 if (signal.aborted) return [];
 const session = s.itemLookup.openSession?.() ?? s.itemLookup; let closed = false;
 const close = () => {if (!closed) {closed = true; session.close?.();}};
 signal.addEventListener('abort', close, {once: true});
 let hits: readonly LibrarySearchRow[];
 try {hits = await session.search(query, {limit, libraries: scope.all.available});}
 finally {signal.removeEventListener('abort', close); close();}
 if (signal.aborted) return [];
 return hits.map(({item, library}) => ({indexedKey: item.indexedKey, title: item.fields.title ?? item.baseFields?.title ?? item.indexedKey, citekey: item.fields.citationKey ?? '',
  detail: [item.creators.slice(0, 2).map(c => [c.firstName, c.lastName].filter(Boolean).join(' ')).join(', '), item.fields.date?.match(/\b\d{4}\b/u)?.[0] ?? item.fields.date, library?.name].filter(Boolean).join(' · '),
  notes: s.bridge.runSync<readonly {path: string}[]>(s.noteIndex.getNotesByItemKey(item.indexedKey)).map(note => note.path),
 }));
}
export class ZotlitGraphAdapter {
 data = {nodes: [] as Concept[], edges: [] as Edge[]};
 state: NonNullable<GraphSnapshot['zotlit']> = {status: 'unavailable', message: 'ZotLit-Zitatindex nicht verfügbar.', edges: 0};
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
   if (!s) {this.data = {nodes: [], edges: []}; this.state = {status: 'unavailable', message: 'ZotLit-Zitatindex nicht verfügbar.', edges: 0}; return;}
   this.state = {status: 'loading', message: 'ZotLit-Zitatindex wird verbunden …', edges: 0};
   try {for (const stream of [s.citationIndex.events, s.citationLookup.changes, s.noteIndex.changes]) this.stops.push(s.bridge.subscribe(stream, () => this.schedule()));}
   catch {this.unbind(); this.bound = undefined; this.state = {status: 'error', message: 'ZotLit-Schnittstelle nicht kompatibel.', edges: 0}; return;}
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
   const coverage = s.bridge.runSync<{coverage: string}>(s.citationIndex.current);
   this.data = citationGraph({occurrences, resolutions: new Map(keys.map(key => [key, answer!.resolve(key)])), notes,
    paths: new Set(this.app.vault.getFiles().map(file => file.path)), resolvedLinks: this.app.metadataCache.resolvedLinks,
    resolveLink: (link, source) => this.app.metadataCache.getFirstLinkpathDest(link, source)?.path});
   this.state = {status: coverage.coverage === 'complete' ? 'ready' : 'loading', message: coverage.coverage === 'complete' ? 'ZotLit-Zitatindex verbunden.' : 'ZotLit-Zitatindex wird noch aufgebaut.', edges: this.data.edges.length};
  } catch {
   if (s !== this.bound || this.disposed) return;
   this.data = {nodes: [], edges: []}; this.state = {status: 'error', message: 'ZotLit-Zitatindex konnte nicht gelesen werden.', edges: 0};
  } finally {window.clearTimeout(timeout); if (this.abort === abort) this.abort = undefined;}
  if (!this.disposed && s === this.bound) this.changed();
 }
 private unbind(): void {this.abort?.abort(); this.abort = undefined; for (const stop of this.stops) stop(); this.stops = []; if (this.timer) window.clearTimeout(this.timer); this.timer = undefined;}
 dispose(): void {this.disposed = true; this.unbind(); this.bound = undefined;}
}
