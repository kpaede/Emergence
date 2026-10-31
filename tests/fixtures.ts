import {defaultProfile, defaults, unknownRule} from '../src/config';
import type {AnalysisResult, Edge, GraphSnapshot, Suggestion} from '../src/types';
import {hash} from '../src/util';
import {ReviewManager} from '../src/review/manager';
import {FrontmatterWriter, type WriterIO} from '../src/review/writer';

export const content = '---\ntitle: Original\nnested:\n  list: [a, b]\nÜberbau:\n  - "[[Alt]]"\n---\nPhotosynthese ist ein Prozess der Pflanzenphysiologie.\n';
export const profile = () => defaultProfile();
export const edge = (source: string, target: string, options: Partial<Edge> = {}): Edge => ({
 id: `${source}:${target}`, source, target, layer: 'breadcrumbs', field: 'Überbau', explicit: true, provenance: 'typed_link', occurrences: [], ...options,
});
export function graph(): GraphSnapshot {
 return {version: 1, builtAt: 1, nodes: ['Quelle.md', 'Ziel.md', 'Alt.md', 'Ordner/Ziel.md', 'Isoliert.md'].map(id => ({id, title: id.split('/').at(-1)!.replace('.md', ''), aliases: id === 'Ziel.md' ? ['Target'] : [], tags: [], type: 'md', exists: true, mtime: 1, size: 1})),
  edges: [], fields: ['Überbau', 'Reibung'], groups: [{label: 'Oberbegriffe', fields: ['Überbau']}],
  rules: {'Überbau': {...unknownRule('Überbau'), class: 'taxonomic', writable: true, description: 'Oberbegriff', targetProperty: 'Überbau', provenance: 'user', hierarchical: true, transitive: true, acyclic: true}, Reibung: unknownRule('Reibung')},
  partial: false, diagnostics: [], unresolved: [], breadcrumbsVersion: '4.22.1'};
}
export async function suggestion(patch: Partial<Suggestion> = {}): Promise<Suggestion> {
 return {id: 's1', analysisId: 'a1', source: 'Quelle.md', sourceVersion: await hash(content), operation: 'add', target: 'Ziel.md', targetKind: 'existing',
  field: 'Überbau', property: 'Überbau', value: '[[Ziel]]', reason: 'Begründung', evidence: 'Photosynthese', confidence: 'high', status: 'pending', outputId: 'relations', ...patch};
}
export async function result(patch: Partial<AnalysisResult> = {}): Promise<AnalysisResult> {
 return {id: 'a1', source: 'Quelle.md', sourceVersion: await hash(content), suggestions: [await suggestion()], candidates: [], artifacts: [], completed: 1, total: 1, status: 'complete', errors: [], ...patch};
}
export async function writerFixture() {
 const snapshot = graph(), settings = defaults(), p = profile(), review = new ReviewManager();
 const files = new Map(snapshot.nodes.map(n => [n.id, n.id === 'Quelle.md' ? content : 'Inhalt']));
 const versions = new Map(snapshot.nodes.map(n => [n.id, {mtime: 1, size: 1}]));
 let writes = 0, refreshes = 0, saved = 0;
 const io: WriterIO = {
  read: async path => {const text = files.get(path); if (text === undefined) throw new Error('missing'); return text;},
  version: path => versions.get(path),
  process: async (path, fn) => {const text = fn(files.get(path)!); files.set(path, text); writes++; return text;},
  resolve: link => {const path = /^\[\[([^|]+)\]\]$/u.exec(link)?.[1] + '.md'; return files.has(path) ? path : undefined;},
  refresh: async () => {refreshes++;}, saveJournal: async () => {saved++;},
 };
 const writer = new FrontmatterWriter(io, review, () => snapshot, () => settings, () => p, []);
 review.set(await result());
 const accept = () => review.decide('s1', 'accepted', snapshot, content, p);
 return {snapshot, settings, profile: p, review, files, versions, io, writer, accept, stats: () => ({writes, refreshes, saved})};
}
