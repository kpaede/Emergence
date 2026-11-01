import {describe,expect,it} from 'vitest';
import {fieldIdeasSchema,parseFieldIdeas} from '../src/llm/assignment-schema';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import {defaults} from '../src/config';
import {graph,profile,result,suggestion,writerFixture} from './fixtures';
import {parseFrontmatter} from '../src/review/frontmatter';
import type {LLMProvider} from '../src/llm/provider';

async function quickFixture() {
 const f = await writerFixture();
 f.review.set(await result({perField:4,fields:['Überbau'],suggestions:[
  await suggestion({contract:'breadcrumbs-v2',evidenceSource:'title',evidence:'Quelle',targetSelected:true}),
  await suggestion({id:'s2',target:'Neu.md',targetKind:'unresolved',value:'[[Neu]]',contract:'breadcrumbs-v2',evidenceSource:'title',evidence:'Quelle'}),
 ]}));
 return f;
}
describe('four concise ideas per actual field',()=>{
 it('accepts up to four strings in each field and rejects narratives, extra fields and duplicates',()=>{
  const schema=fieldIdeasSchema(['Überbau','Reibung'],4);
  expect(parseFieldIdeas(JSON.stringify({Überbau:['A','B','C','D'],Reibung:['E','F','G','H']}),schema).suggestions).toHaveLength(8);
  expect(parseFieldIdeas(JSON.stringify({Überbau:[],Reibung:[]}),schema).suggestions).toEqual([]);
  for(const bad of [{Überbau:['A','B','C','D','E'],Reibung:[]},{Überbau:['A','A'],Reibung:[]},{Überbau:[],Reibung:[],reason:'Essay'},{Überbau:[]}])expect(()=>parseFieldIdeas(JSON.stringify(bad),schema)).toThrow();
 });
 it('keeps four ideas per field in a single request, rather than a global limit of four',async()=>{
  const g=graph();g.rules.Reibung!.description='Eine interessante Gegenposition.';
  let calls=0;
  const provider:LLMProvider={health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{},chat:async()=>{calls++;return JSON.stringify({Überbau:['Oberthema A','Oberthema B','Oberthema C','Oberthema D'],Reibung:['Gegenidee A','Gegenidee B','Gegenidee C','Gegenidee D']});}};
  const a=await new DocumentAnalyzer(provider).analyze('Quelle.md','---\nÜberbau:\nReibung:\n---\nEine Notiz.',g,profile(),defaults(),new AbortController().signal,()=>{},{fields:g.fields,folders:[],allowNew:true,maxSuggestions:8,perField:4,outputId:'relations'});
  expect(a.status,a.errors.join('\n')).toBe('complete');expect(calls).toBe(1);expect(a.suggestions).toHaveLength(8);
  expect(a.suggestions.filter(s=>s.field==='Überbau')).toHaveLength(4);expect(a.suggestions.every(s=>s.reason===''&&s.evidenceSource==='title'&&s.status==='pending')).toBe(true);
 });
 it('does not turn invented opposition pairs into new note targets, while preserving an existing comparison title or alias', async()=>{
  const g=graph();g.rules.Reibung!.description='Eine interessante Gegenposition.';
  const existing={...g.nodes[1]!,id:'Vorhandener Vergleich.md',title:'Ein Vergleich',aliases:['Idealismus vs. Realismus']};g.nodes.push(existing);
  const provider:LLMProvider={health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{},chat:async options=>{
   expect(options.messages[0]!.content).toContain('einzelner Zielbegriff');
   return JSON.stringify({Überbau:[],Reibung:['Realismus vs. Idealismus','Substanzontologie versus Strukturalismus','Nominalismus','Idealismus vs. Realismus']});
  }};
  const a=await new DocumentAnalyzer(provider).analyze('Quelle.md','---\nÜberbau:\nReibung:\n---\nEine Notiz.',g,profile(),defaults(),new AbortController().signal,()=>{},{fields:g.fields,folders:[],allowNew:true,maxSuggestions:8,perField:4,outputId:'relations'});
  expect(a.status).toBe('complete');expect(a.discarded).toBe(2);
  expect(a.suggestions.map(s=>[s.target,s.targetKind])).toEqual([['Nominalismus.md','unresolved'],['Vorhandener Vergleich.md','existing']]);
 });
});
describe('one-click link application and precise undo',()=>{
 it('writes a short title for a nested existing target and journals that exact value for undo',async()=>{
  const f=await quickFixture(),path='Konzepte/Taxonomie.md',before=f.files.get('Quelle.md')!;
  f.snapshot.nodes.push({...f.snapshot.nodes[1]!,id:path,title:'Taxonomie'});f.files.set(path,'Eine Taxonomie.');f.versions.set(path,{mtime:1,size:1});
  const resolve=f.io.resolve.bind(f.io);f.io.resolve=(link,source)=>link==='[[Taxonomie]]'?path:resolve(link,source);
  f.review.edit('s1',{target:path,targetKind:'existing',field:'Überbau',property:'Überbau',value:'[[Konzepte/Taxonomie]]'});
  const entry=await f.writer.applyIdea('s1');
  expect(f.files.get('Quelle.md')).toContain('[[Taxonomie]]');expect(f.files.get('Quelle.md')).not.toContain('[[Konzepte/Taxonomie]]');
  expect(entry.changes[0]!.value).toBe('[[Taxonomie]]');
  await f.writer.undoIdea(entry.id);expect(parseFrontmatter(f.files.get('Quelle.md')!).data).toEqual(parseFrontmatter(before).data);
 });
 it('writes only a short missing-target wikilink and can remove it without creating any file',async()=>{
  const f=await quickFixture();
  f.review.edit('s1',{target:'Konzepte/Neue Taxonomie.md',targetKind:'unresolved',field:'Überbau',property:'Überbau',value:'[[Neue Taxonomie]]'});
  const entry=await f.writer.applyIdea('s1');expect(f.files.get('Quelle.md')).toContain('[[Neue Taxonomie]]');expect(f.files.has('Konzepte/Neue Taxonomie.md')).toBe(false);
  await f.writer.undoIdea(entry.id);expect(f.files.get('Quelle.md')).not.toContain('[[Neue Taxonomie]]');
 });
 it('retains an unambiguous path only when the bare name would link to a different existing file and supports older journals',async()=>{
  const f=await quickFixture();
  f.review.edit('s1',{target:'Ordner/Ziel.md',targetKind:'existing',field:'Überbau',property:'Überbau',value:'[[Ziel]]'});
  const entry=await f.writer.applyIdea('s1');expect(f.files.get('Quelle.md')).toContain('[[Ordner/Ziel]]');
  delete f.writer.journal.find(e=>e.id===entry.id)!.changes[0]!.value;
  await f.writer.undoIdea(entry.id);expect(f.files.get('Quelle.md')).not.toContain('[[Ordner/Ziel]]');
 });
 it('blocks a link value that does not describe the chosen target',async()=>{
  const f=await quickFixture();f.review.edit('s1',{target:'Ziel.md',targetKind:'existing',field:'Überbau',property:'Überbau',value:'[[Anderes Ziel]]'});
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('Wiki-Link');expect(f.stats().writes).toBe(0);
 });
 it('applies one idea while other ideas remain pending, without creating the missing target',async()=>{
  const f=await quickFixture();await f.writer.applyIdea('s1');
  expect(f.files.get('Quelle.md')).toContain('[[Ziel]]');expect(f.review.analysis?.suggestions.map(s=>s.id)).toEqual(['s2']);
  await f.writer.applyIdea('s2');expect(f.files.has('Neu.md')).toBe(false);expect(f.review.analysis?.suggestions).toEqual([]);expect(f.writer.journal).toHaveLength(2);
 });
 it('appends to the current note after user edits, and undo preserves later body and property edits',async()=>{
  const f=await quickFixture();f.files.set('Quelle.md',f.files.get('Quelle.md')!+'\nEigener neuer Absatz.');
  const entry=await f.writer.applyIdea('s1');await f.writer.applyIdea('s2');
  f.files.set('Quelle.md',f.files.get('Quelle.md')!.replace('title: Original','title: Eigener Titel')+'\nNoch ein Absatz.');
  await f.writer.undoIdea(entry.id);
  const now=f.files.get('Quelle.md')!,fm=parseFrontmatter(now).data;
  expect(fm.Überbau).toEqual(['[[Alt]]','[[Neu]]']);expect(fm.title).toBe('Eigener Titel');expect(now).toContain('Eigener neuer Absatz.');expect(now).toContain('Noch ein Absatz.');
  expect(f.review.analysis?.suggestions.some(s=>s.id==='s1')).toBe(true);
 });
 it('blocks a changed source during the atomic write and leaves user edits intact',async()=>{
  const f=await quickFixture(),process=f.io.process.bind(f.io);
  f.io.process=async(path,update)=>{f.files.set(path,f.files.get(path)!+'\nParallel geändert.');return process(path,update);};
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('während der Übernahme');expect(f.stats().writes).toBe(0);expect(f.files.get('Quelle.md')).toContain('Parallel geändert.');expect(f.writer.journal).toHaveLength(0);
 });
 it('does not recreate a field removed from the frontmatter after analysis',async()=>{
  const f=await quickFixture();f.files.set('Quelle.md','---\ntitle: Original\n---\nEin Text.');
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('nicht mehr im Frontmatter');expect(f.stats().writes).toBe(0);
 });
 it('does not apply rejected ideas or incomplete analyses',async()=>{
  const f=await quickFixture();f.review.decide('s1','rejected',f.snapshot,f.files.get('Quelle.md')!,f.profile);
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('Keine übernehmbare');
  const a=f.review.analysis!;a.status='partial';f.review.set(a);await expect(f.writer.applyIdea('s2')).rejects.toThrow('Keine übernehmbare');expect(f.stats().writes).toBe(0);
 });
});
