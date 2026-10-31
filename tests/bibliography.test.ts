import {describe, expect, it} from 'vitest';
import {bibliographicReference, type BibliographicItem} from '../src/graph/bibliography';
import {citationGraph} from '../src/graph/zotlit';
import {SynopsisGraph} from '../src/graph/synopsis';
import {defaults} from '../src/config';
import {graph} from './fixtures';
const item:BibliographicItem={indexedKey:'1:ABCD',fields:{title:'A real title',citationKey:'doe2024',date:'2024-05-01',publicationTitle:'Journal'},creators:[{firstName:'Jane',lastName:'Doe'}]};
const input=()=>({items:new Map([[item.indexedKey,item]]),occurrences:new Map([['Quelle.md',[{kind:'citekey',raw:'doe2024'}]]]),resolutions:new Map([['doe2024',{kind:'unique' as const,item:{indexedKey:item.indexedKey}}]]),notes:new Map<string,string[]>(),paths:new Set(['Quelle.md','Ziel.md','Alt.md']),resolvedLinks:{},resolveLink:()=> 'Ziel.md'});
describe('bibliographic display from ZotLit metadata',()=>{
 it('keeps factual titles as labels without inventing citation formatting',()=>{expect(bibliographicReference(item)).toEqual({title:'A real title',citekey:'doe2024',indexedKey:'1:ABCD'});});
 it('does not fabricate a title or year from the citekey',()=>{expect(bibliographicReference({...item,fields:{citationKey:'ImaginaryBook2020'},creators:[]})).toEqual({indexedKey:'1:ABCD',citekey:'ImaginaryBook2020'});});
 it('enriches noteless citations without inventing Markdown notes',()=>{
  const output=citationGraph(input());expect(output.nodes[0]).toMatchObject({title:'A real title',exists:false,citation:{reference:{title:'A real title',citekey:'doe2024'}}});
  const snapshot=graph();snapshot.nodes.push(...output.nodes);snapshot.edges=output.edges;
  const model=new SynopsisGraph(snapshot,defaults());expect(model.citationReferences('Quelle.md')[0]?.title).toBe('A real title');expect(model.neighbors('Quelle.md','links')).toEqual([]);expect(model.notes.has(output.nodes[0]!.id)).toBe(false);
 });
 it('preserves literature-note identity and metadata through deeper relation steps',()=>{
  const first=input();first.notes.set(item.indexedKey,['Ziel.md']);first.occurrences.set('Ziel.md',[{kind:'citekey',raw:'other'}]);
  const other={...item,indexedKey:'2:EFGH',fields:{title:'Second title',citationKey:'other'}};first.items.set(other.indexedKey,other);first.resolutions.set('other',{kind:'unique',item:{indexedKey:other.indexedKey}});first.notes.set(other.indexedKey,['Alt.md']);
  const output=citationGraph(first),snapshot=graph();snapshot.edges=output.edges;const model=new SynopsisGraph(snapshot,defaults());
  expect(model.entries('Quelle.md','literature',2)[0]?.children[0]?.note.id).toBe('Alt.md');expect(model.reference('Ziel.md')?.title).toBe('A real title');expect(model.reference('Alt.md')?.title).toBe('Second title');
 });
 it('does not choose metadata arbitrarily for a wikilink note assigned to several items',()=>{
  const first=input();first.occurrences.set('Quelle.md',[{kind:'wikilink',raw:'Ziel'}]);first.notes.set(item.indexedKey,['Ziel.md']);first.notes.set('2:OTHER',['Ziel.md']);
  expect(citationGraph(first).edges[0]?.reference).toBeUndefined();
 });
});
