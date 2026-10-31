import {describe, expect, it} from 'vitest';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import type {LLMProvider} from '../src/llm/provider';
import {defaults} from '../src/config';
import {needsTargetChoice, refreshTargetMatch} from '../src/review/target-matches';
import {graph, profile, suggestion, result, writerFixture} from './fixtures';

describe('existing notes are matches, not new duplicate concepts', () => {
 it('recognizes an existing title or alias outside the model shortlist without inventing another note', async () => {
  for (const title of ['Taxonomie','Taxonomik']) {
   const g=graph();g.nodes.push({...g.nodes[1]!,id:'Vorhanden/Taxonomie.md',title:'Taxonomie',aliases:['Taxonomik']});
   const provider:LLMProvider={health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{},chat:async()=>JSON.stringify({Überbau:[title]})};
   const a=await new DocumentAnalyzer(provider).analyze('Quelle.md','---\nÜberbau:\n---\nEine Notiz.',g,profile(),defaults(),new AbortController().signal,()=>{},'','',{fields:['Überbau'],folders:['Anderer Suchbereich'],allowNew:true,maxSuggestions:4,perField:4,outputId:'relations'});
   expect(a.status).toBe('complete');expect(a.suggestions).toHaveLength(1);
   expect(a.suggestions[0]).toMatchObject({target:'Vorhanden/Taxonomie.md',targetKind:'existing',value:'[[Taxonomie]]'});
   expect(needsTargetChoice(a.suggestions[0]!)).toBe(false);
  }
 });
 it('retains multiple existing files as one idea with an explicit choice, rather than dropping it or creating a third', async () => {
  const g=graph();for(const folder of ['A','B'])g.nodes.push({...g.nodes[1]!,id:folder+'/Taxonomie.md',title:'Taxonomie',aliases:[]});
  const provider:LLMProvider={health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{},chat:async()=>JSON.stringify({Überbau:['Taxonomie']})};
  const a=await new DocumentAnalyzer(provider).analyze('Quelle.md','---\nÜberbau:\n---\nEine Notiz.',g,profile(),defaults(),new AbortController().signal,()=>{},'','',{fields:['Überbau'],folders:['Neue Konzepte'],allowNew:true,maxSuggestions:4,perField:4,outputId:'relations'});
  expect(a.suggestions).toHaveLength(1);expect(a.suggestions[0]!.targetCandidates).toEqual(['A/Taxonomie.md','B/Taxonomie.md']);
  expect(a.suggestions[0]!.targetKind).toBe('existing');expect(needsTargetChoice(a.suggestions[0]!)).toBe(true);
 });
 it('updates a pending new idea when an existing note with its name becomes known', async () => {
  const s=await suggestion({target:'Neu/Taxonomie.md',targetKind:'unresolved',value:'[[Taxonomie]]'}),g=graph();
  expect(refreshTargetMatch(s,g)).toBe(false);
  g.nodes.push({...g.nodes[1]!,id:'Vorhanden/Taxonomie.md',title:'Taxonomie',aliases:[]});
  expect(refreshTargetMatch(s,g)).toBe(true);expect(s).toMatchObject({target:'Vorhanden/Taxonomie.md',targetKind:'existing'});
 });
 it('requires an existing-file choice before writing and then links only the selected file', async () => {
  const f=await writerFixture();
  for(const folder of ['A','B']){const path=folder+'/Taxonomie.md';f.snapshot.nodes.push({...f.snapshot.nodes[1]!,id:path,title:'Taxonomie',aliases:[]});f.files.set(path,'Bestehende Notiz.');f.versions.set(path,{mtime:1,size:1});}
  f.review.set(await result({perField:4,fields:['Überbau'],suggestions:[await suggestion({contract:'breadcrumbs-v2',evidenceSource:'title',evidence:'Quelle',target:'Neue Konzepte/Taxonomie.md',targetKind:'unresolved',value:'[[Taxonomie]]'})]}));
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('auswählen');expect(f.stats().writes).toBe(0);
  const s=f.review.analysis!.suggestions[0]!;expect(s.targetCandidates).toHaveLength(2);expect(s.targetKind).toBe('existing');
  f.review.edit('s1',{target:'B/Taxonomie.md',targetKind:'existing',field:s.field,property:s.property,value:'[[Taxonomie]]',targetSelected:true});
  const resolve=f.io.resolve.bind(f.io);f.io.resolve=(link,source)=>link==='[[Taxonomie]]'?'A/Taxonomie.md':resolve(link,source);
  const entry=await f.writer.applyIdea('s1');expect(f.files.get('Quelle.md')).toContain('[[B/Taxonomie]]');
  expect(f.files.has('Neue Konzepte/Taxonomie.md')).toBe(false);expect(entry.changes[0]!.target).toBe('B/Taxonomie.md');
 });
});
