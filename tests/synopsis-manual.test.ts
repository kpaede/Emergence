import {describe,it,expect} from 'vitest';
import {writerFixture,content,edge,graph} from './fixtures';
import {parseFrontmatter,planManualLink} from '../src/review/frontmatter';
import {SynopsisGraph} from '../src/graph/synopsis';
import {defaults} from '../src/config';
describe('explicit manual synopsis additions',()=>{
 it('appends a short link, preserves text and other properties, and journals the change',async()=>{
  const f=await writerFixture(),review=JSON.stringify(f.review.analysis),entry=await f.writer.addManualLink('Quelle.md','Überbau','Ziel.md','existing');
  expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Überbau).toEqual(['[[Alt]]','[[Ziel]]']);
  expect(parseFrontmatter(f.files.get('Quelle.md')!).parts.body).toBe(parseFrontmatter(content).parts.body);
  expect(entry.changes).toEqual([{property:'Überbau',target:'Ziel.md',value:'[[Ziel]]'}]);expect(JSON.stringify(f.review.analysis)).toBe(review);expect(f.stats()).toMatchObject({writes:1,saved:1,refreshes:1});
 });
 it('creates an empty configured Breadcrumbs property when adding its first link',async()=>{
  const f=await writerFixture();await f.writer.addManualLink('Quelle.md','Reibung','Ziel.md','existing');expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Reibung).toEqual(['[[Ziel]]']);
 });
 it('adds a missing target only as a Wiki-Link, without creating its file',async()=>{
  const f=await writerFixture(),count=f.files.size;await f.writer.addManualLink('Quelle.md','Überbau','Fehlt.md','unresolved');expect(f.files.size).toBe(count);expect(f.files.has('Fehlt.md')).toBe(false);expect(f.files.get('Quelle.md')).toContain('[[Fehlt]]');
 });
 it('rejects duplicate and unconfigured field additions without writing',async()=>{
  const f=await writerFixture();await expect(f.writer.addManualLink('Quelle.md','Überbau','Alt.md','existing')).rejects.toThrow('bereits');await expect(f.writer.addManualLink('Quelle.md','Literatur','Ziel.md','existing')).rejects.toThrow('Breadcrumbs');expect(f.stats().writes).toBe(0);
 });
 it('does not overwrite structured or mixed existing values',()=>{
  for(const value of ['{nested: value}','["[[Alt]]", 1]'])expect(()=>planManualLink(`---\nÜberbau: ${value}\n---\nText`,'Überbau','[[Ziel]]','Ziel.md',()=>undefined)).toThrow();
 });
 it('retains unrelated data while creating new frontmatter',()=>{
  const planned=planManualLink('Notiz ohne Frontmatter','Überbau','[[Ziel]]','Ziel.md',()=>undefined);expect(parseFrontmatter(planned.after).parts.body).toBe('Notiz ohne Frontmatter');
 });
});
describe('citation ownership',()=>{
 it('shows a ZotLit-resolved reference in literature rather than again as an automatic free link',()=>{
  const g=graph();g.edges=[edge('Quelle.md','Ziel.md',{layer:'zotlit'}),edge('Quelle.md','Ziel.md',{layer:'obsidian',field:''}),edge('Quelle.md','Alt.md',{layer:'obsidian',field:''})];
  const model=new SynopsisGraph(g,defaults());expect(model.neighbors('Quelle.md','literature')).toEqual(['Ziel.md']);expect(model.neighbors('Quelle.md','links')).toEqual(['Alt.md']);
 });
 it('retains the actual citekey of a citation without pretending it has a Markdown note',()=>{
  const g=graph();g.nodes.push({...g.nodes[0]!,id:'zotlit:work:x',title:'@x',exists:false,type:'cited-work',citation:{citekey:'x',state:'noteless'}});g.edges=[edge('Quelle.md','zotlit:work:x',{layer:'zotlit'})];
  const model=new SynopsisGraph(g,defaults());expect(model.citationReferences('Quelle.md')).toEqual([{citekey:'x',state:'noteless'}]);expect(model.neighbors('Quelle.md','links')).toEqual([]);expect(model.notes.has('zotlit:work:x')).toBe(false);
 });
});
