import {describe, expect, it, vi} from 'vitest';
import {citationGraph, openZotlitLibrary, searchZotlitLibrary, type CitationOccurrence, type Resolution} from '../src/graph/zotlit';
import {graphContext} from '../src/graph/context';
import {defaultFilters, visibleEdge, graphElements} from '../src/graph/render';
import {defaults} from '../src/config';
import {graph} from './fixtures';

function fixture() {
 return {occurrences: new Map<string, CitationOccurrence[]>([['Quelle.md', [{kind: 'citekey', raw: 'doe2024', position: {start: {line: 2}}}, {kind: 'citekey', raw: 'doe2024', position: {start: {line: 4}}}]]]),
  resolutions: new Map<string, Resolution>([['doe2024', {kind: 'unique', item: {indexedKey: 'ABCD1234'}}]]),
  notes: new Map<string, string[]>([['ABCD1234', ['Ziel.md', 'Alt.md']]]), paths: new Set(['Quelle.md', 'Ziel.md', 'Alt.md']),
  resolvedLinks: {'Quelle.md': {'Alt.md': 1}}, resolveLink: (_link: string, _source: string): string | undefined => 'Alt.md'};
}
describe('ZotLit citation layer', () => {
 it('uses the already linked literature note and deduplicates repeated citations while preserving locations', () => {
  const output = citationGraph(fixture());
  expect(output.nodes).toEqual([]); expect(output.edges).toHaveLength(1);
  expect(output.edges[0]).toMatchObject({source: 'Quelle.md', target: 'Alt.md', layer: 'zotlit', field: 'zitiert', occurrences: [{kind: 'body', line: 2}, {kind: 'body', line: 4}]});
 });
 it('keeps ambiguous, missing and noteless works as virtual citations and never guesses a literature note', () => {
  for (const resolution of [{kind: 'ambiguous'}, {kind: 'missing'}, {kind: 'unique', item: {indexedKey: 'MISSING'}}] as Resolution[]) {
   const input = fixture(); input.resolutions.set('doe2024', resolution);
   const output = citationGraph(input);
   expect(output.nodes).toHaveLength(1); expect(output.edges).toHaveLength(1);
   expect(output.nodes[0]).toMatchObject({exists: false, type: 'cited-work', title: '@doe2024', citation: {state: resolution.kind === 'unique' ? 'noteless' : resolution.kind}});
   expect(output.edges[0]!.target).toBe(output.nodes[0]!.id);
  }
 });
 it('recognizes only admitted wikilink citations reaching literature notes and excludes self or deleted source files', () => {
  const input = fixture(); input.occurrences.set('Quelle.md', [{kind: 'wikilink', raw: 'Alt'}, {kind: 'annotation', raw: 'ABCD1234'}]);
  expect(citationGraph(input).edges).toHaveLength(1);
  input.notes.clear(); expect(citationGraph(input).edges).toEqual([]);
  input.occurrences.set('deleted.md', [{kind: 'citekey', raw: 'doe2024'}]); expect(citationGraph(input).edges).toEqual([]);
 });
 it('shows a bounded citation context independently of Breadcrumbs field and ordinary-link filters', () => {
  const input = fixture(); input.notes.clear(); const citations = citationGraph(input), g = graph();
  g.nodes.push(...citations.nodes); g.edges = citations.edges;
  const filters = {...defaultFilters(), links: false, hierarchy: false, cross: false, field: 'Überbau'};
  expect(visibleEdge(g.edges[0]!, g, filters)).toBe(true);
  const context = graphContext(g, 'Quelle.md', defaults(), filters);
  expect(context.total).toBe(1); expect(context.elements.filter(e => e.group === 'nodes')).toHaveLength(2);
  const virtual = graphElements(g, 'Quelle.md', defaults()).elements.find(e => e.data.id === citations.nodes[0]!.id)!;
  expect(virtual.classes).toContain('citation-node'); expect(virtual.data.label).not.toContain('noch nicht angelegt');
  filters.citations = false; expect(graphContext(g, 'Quelle.md', defaults(), filters).total).toBe(0);
 });
});

function libraryFixture(resolution:Resolution = {kind:'unique',item:{indexedKey:'ABCD1234'}}) {
 const show = vi.fn((key:string)=>Promise.resolve(key)), read = vi.fn(()=>Promise.resolve({resolve:()=>resolution}));
 const s = {bridge:{closed:()=>false,runSync:(effect:unknown)=>effect,runPromise:async(effect:unknown)=>effect,subscribe:()=>()=>{}},
  citationIndex:{citationsByPath:()=>new Map()},citationLookup:{read},
  noteIndex:{getIndexedItemKeys:['ABCD1234'],getNotesByItemKey:()=>[{path:'Literatur.md'}]},showInLibrary:{show}};
 return {s,show,read,app:{plugins:{plugins:{zotlit:{services:s}}}} as unknown as import('obsidian').App};
}
describe('ZotLit Library navigation',()=>{
 it('selects the citation item via ZotLits own action without opening or creating a note',async()=>{
  const f=libraryFixture();await openZotlitLibrary(f.app,{citekey:'doe2024'});
  expect(f.read).toHaveBeenCalledWith({citekeys:['doe2024']});expect(f.show).toHaveBeenCalledWith('ABCD1234');
 });
 it('uses the existing note index for literature-note clicks',async()=>{
  const f=libraryFixture();await openZotlitLibrary(f.app,{path:'Literatur.md'});expect(f.show).toHaveBeenCalledWith('ABCD1234');expect(f.read).not.toHaveBeenCalled();
 });
 it('reports unresolved, ambiguous and unavailable items without selecting an arbitrary entry',async()=>{
  for(const resolution of [{kind:'missing'},{kind:'ambiguous'}] as Resolution[]){const f=libraryFixture(resolution);await expect(openZotlitLibrary(f.app,{citekey:'x'})).rejects.toThrow();expect(f.show).not.toHaveBeenCalled();}
  const f=libraryFixture();await expect(openZotlitLibrary(f.app,{path:'Fehlt.md'})).rejects.toThrow('kein ZotLit-Eintrag');expect(f.show).not.toHaveBeenCalled();
  await expect(openZotlitLibrary({} as import('obsidian').App,{citekey:'x'})).rejects.toThrow('nicht verfügbar');
 });
 it('does not choose between multiple items attached to the same note',async()=>{
  const f=libraryFixture();f.s.noteIndex.getIndexedItemKeys.push('EFGH5678');
  await expect(openZotlitLibrary(f.app,{path:'Literatur.md'})).rejects.toThrow('mehreren ZotLit-Einträgen');expect(f.show).not.toHaveBeenCalled();
 });
});

describe('Unrestricted Zotero search',()=>{
 it('passes every available library instead of the saved selection and closes the owned session',async()=>{
  const f=libraryFixture(),all=[{libraryID:1},{libraryID:2}],scope={all:{available:all},current:{available:all.slice(0,1)}};
  const close=vi.fn(),search=vi.fn(async()=>[{item:{indexedKey:'ABCD1234',fields:{title:'Ontology',citationKey:'doe2024',date:'2024'},creators:[{firstName:'Jane',lastName:'Doe'}]},library:{name:'Research'}}]);
  Object.assign(f.s,{libraryScope:{state:scope},itemLookup:{search,openSession:()=>({search,close})}});
  const hits=await searchZotlitLibrary(f.app,'ontology',30,new AbortController().signal);
  expect(search).toHaveBeenCalledWith('ontology',{limit:30,libraries:all});expect(close).toHaveBeenCalledOnce();
  expect(hits).toEqual([{indexedKey:'ABCD1234',title:'Ontology',citekey:'doe2024',detail:'Jane Doe · 2024 · Research',notes:['Literatur.md']}]);
  expect(scope.current.available).toHaveLength(1);
 });
 it('closes an obsolete search on abort and does not publish its stale results',async()=>{
  const f=libraryFixture(),abort=new AbortController(),close=vi.fn();let finish!:(v:never[])=>void;
  const search=vi.fn(()=>new Promise<never[]>(resolve=>{finish=resolve;}));
  Object.assign(f.s,{libraryScope:{state:{all:{available:[{libraryID:1}]}}},itemLookup:{search,openSession:()=>({search,close})}});
  const pending=searchZotlitLibrary(f.app,'first',30,abort.signal);abort.abort();expect(close).toHaveBeenCalledOnce();finish([]);expect(await pending).toEqual([]);expect(close).toHaveBeenCalledOnce();
 });
 it('uses the explicit indexed key when opening a result outside citation lookup scope',async()=>{
  const f=libraryFixture({kind:'missing'});await openZotlitLibrary(f.app,{indexedKey:'ABCD1234'});expect(f.show).toHaveBeenCalledWith('ABCD1234');expect(f.read).not.toHaveBeenCalled();
 });
});
