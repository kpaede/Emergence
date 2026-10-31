import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {researchExamples, exampleTitle, artForms} from '../src/llm/research-examples';
import type {LLMProvider} from '../src/llm/provider';
import {defaults,migrateSettings} from '../src/config';
import {formatCitekey} from '../src/graph/citekey';
const fixture={query:'Ontologie Kunstwerke',status:'ready' as const,pages:1,sources:[{id:'WEB-1',title:'One and Three Chairs',url:'https://example.org/chairs',snippet:'An artwork by Joseph Kosuth.'}]};
function provider(text:string){const chat=vi.fn<LLMProvider['chat']>(async()=>text);return {chat,health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{}};}
describe('Compact research examples',()=>{
 it('returns reviewable individual titles with admitted source IDs, no prose',async()=>{
  const p=provider(JSON.stringify({ideas:[{title:'One and Three Chairs',sources:['WEB-1'],creator:'Joseph Kosuth',artForm:'Installation'},{title:'One and Three Chairs',sources:[],creator:'Joseph Kosuth',artForm:'Installation'}]})),s=defaults();
  p.chat.mockResolvedValueOnce(JSON.stringify({ideas:[{title:'One and Three Chairs',sources:['WEB-1'],creator:'Joseph Kosuth',artForm:'Installation'}]})).mockResolvedValueOnce(JSON.stringify({A0:true}));
  const result=await researchExamples(p,{prompt:'Concrete artworks',title:'Ontologie',context:'Local context',kind:'artworks',webSearch:fixture},s.profiles[0]!,s,new AbortController().signal);
  expect(result.ideas).toHaveLength(1);expect(result.ideas[0]).toMatchObject({title:'One and Three Chairs',sourceIds:['WEB-1'],status:'pending'});
  const options=p.chat.mock.calls[0]![0];expect(options.format).toBeTruthy();expect(options.allowPartial).not.toBe(true);expect(options.messages[0]!.content).toContain(artForms);
 });
 it('rejects long essays, extra properties, invented source IDs and non-note markup',async()=>{
  for(const text of ['An essay.',JSON.stringify({ideas:[],essay:'Text'}),JSON.stringify({ideas:[{title:'Title',sources:['WEB-999']}]}),JSON.stringify({ideas:[{title:'Bad|alias',sources:[]}]})]){
   const s=defaults();await expect(researchExamples(provider(text),{prompt:'Examples',title:'Concept',context:'',kind:'examples',webSearch:fixture},s.profiles[0]!,s,new AbortController().signal)).rejects.toThrow();
  }
 });
 it('distinguishes broad concrete examples from art-only results and never promotes model ideas to sourced claims',async()=>{
  const p=provider(JSON.stringify({ideas:[{title:'Tisch',sources:[]}]})),s=defaults();const result=await researchExamples(p,{prompt:'Examples',title:'Ontologie',context:'',kind:'examples'},s.profiles[0]!,s,new AbortController().signal);
  expect(result.ideas[0]!.sourceIds).toEqual([]);expect(p.chat.mock.calls[0]![0].messages[0]!.content).toContain('Situationen, Gegenstände, Ereignisse');expect(exampleTitle(' [[Tisch]] ')).toBe('Tisch');
 });
 it('independently removes a misclassified theory book without admitting replacement titles',async()=>{
  const p=provider(''),s=defaults();p.chat.mockResolvedValueOnce(JSON.stringify({ideas:[{title:'Das literarische Kunstwerk',creator:'Roman Ingarden',artForm:'Roman/Erzählung',sources:[]},{title:'Fountain',creator:'Marcel Duchamp',artForm:'Skulptur',sources:[]}]})).mockResolvedValueOnce(JSON.stringify({A0:false,A1:true}));
  const result=await researchExamples(p,{prompt:'Artworks',title:'Ontologie',context:'',kind:'artworks'},s.profiles[0]!,s,new AbortController().signal);
  expect(result.ideas.map(i=>i.title)).toEqual(['Fountain']);expect(p.chat.mock.calls).toHaveLength(2);expect(p.chat.mock.calls[1]![0].maxTokens).toBe(160);
  expect(p.chat.mock.calls[1]![0].messages[1]!.content).not.toContain('webSearch');
 });
 it('includes only opt-in history and does not label an unrelated excerpt as a source',async()=>{
  const p=provider(JSON.stringify({ideas:[{title:'Tisch',sources:['WEB-1']}]})),s=defaults(),history=[{role:'assistant' as const,content:'Explicit previous turn'}];
  const result=await researchExamples(p,{prompt:'Examples',title:'Ontologie',context:'',kind:'examples',webSearch:fixture,history,field:{name:'Beispiel',meaning:'Konkrete Instanz'}},s.profiles[0]!,s,new AbortController().signal);
  expect(result.ideas[0]!.sourceIds).toEqual([]);expect(p.chat.mock.calls[0]![0].messages[1]).toEqual(history[0]);expect(p.chat.mock.calls[0]![0].messages.at(-1)!.content).toContain('Konkrete Instanz');
 });
 it('keeps user templates and adds only the missing Examples preset',()=>{
  const s=defaults();s.inquiryTemplates=[{name:'Meine Frage',prompt:'Unverändert.'}];const result=migrateSettings(s);expect(result.inquiryTemplates[0]).toEqual(s.inquiryTemplates[0]);expect(result.inquiryTemplates.some(t=>t.name==='Beispiele')).toBe(true);
 });
});
describe('Manifest and citation format',()=>{
 it('has a permitted lowercase ID',()=>{const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8')) as {id:string};expect(manifest.id).toBe('emergence');expect(manifest.id).toMatch(/^[a-z][a-z-]*$/u);expect(manifest.id).not.toMatch(/obsidian|plugin$/u);});
 it('defaults to Pandoc bracket form and supports both alternatives',()=>{expect(formatCitekey('doe2024')).toBe('[@doe2024]');expect(formatCitekey('doe2024','at')).toBe('@doe2024');expect(formatCitekey('doe2024','plain')).toBe('doe2024');expect(migrateSettings({}).citekeyFormat).toBe('brackets');});
});
