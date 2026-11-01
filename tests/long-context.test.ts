import {describe,it,expect,vi} from 'vitest';
import {prepareLongContext} from '../src/llm/long-context';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import {assignmentDocument} from '../src/llm/assignment-document';
import {prepareAssignments} from '../src/llm/assignment-context';
import {contextEstimate,estimateTextTokens} from '../src/llm/context';
import type {ChatOptions,LLMProvider} from '../src/llm/provider';
import {defaults,unknownRule} from '../src/config';
import {hash} from '../src/util';
import {graph,profile} from './fixtures';
function provider(handler:(request:ChatOptions)=>string|Promise<string>):{chat:ReturnType<typeof vi.fn<LLMProvider['chat']>>;health:LLMProvider['health'];cancel:LLMProvider['cancel']}{return {chat:vi.fn(async request=>handler(request)),health:async()=>({models:[],thinking:false,metadata:{},version:''}),cancel:()=>{}};}
const read=(request:ChatOptions)=>JSON.parse(request.messages.at(-1)!.content) as {text?:string;question?:string;context?:string};
const summarizer=(request:ChatOptions):string=>{const text=read(request).text??'';return JSON.stringify({summary:'Begriffsdefinition. '+text.slice(0,45)+' '+text.slice(-90)});};
describe('bounded preparation of long notes',()=>{
 it('keeps a fitting note verbatim and does not call a model for preparation',async()=>{const p=provider(()=>{throw Error('Unexpected call');});const text='# Ontologie\nEin kurzer Text.';expect(await prepareLongContext(p,text,'Frage',defaults(),new AbortController().signal,()=>true)).toMatchObject({text,mode:'full',requests:0});expect(p.chat).not.toHaveBeenCalled();});
 it('processes every character, including final facts and Unicode, within the configured context window',async()=>{
  const s=defaults();s.numCtx=4096;const text=Array.from({length:240},(_,i)=>`Absatz ${i}: αλήθεια, 世界 und 🧠. Definition mit einer wichtigen Einschränkung.\n`).join('')+'ENDE: der entscheidende Oberbegriff ist Philosophie.';
  const p=provider(summarizer),result=await prepareLongContext(p,text,'Frage zur ganzen Notiz',s,new AbortController().signal,value=>estimateTextTokens(value)<900);
  const firstPass=p.chat.mock.calls.slice(0,result.parts).map(([request])=>read(request).text).join('');expect(firstPass).toBe(text);expect(result.text).toContain('Philosophie');expect(result.mode).toBe('overview');
  for(const [request]of p.chat.mock.calls){expect(contextEstimate(request.messages,request.maxTokens,request.format)).toBeLessThanOrEqual(s.numCtx);expect(request.signal.aborted).toBe(false);}
 });
 it('does not publish a summary of only the successful first chunks',async()=>{let count=0;const p=provider(request=>{if(++count===2)throw Error('Second chunk failed');return summarizer(request);});await expect(prepareLongContext(p,'Langer Inhalt. '.repeat(5000),'Frage',defaults(),new AbortController().signal,value=>value.length<1000)).rejects.toThrow('Second chunk failed');expect(p.chat).toHaveBeenCalledTimes(2);});
 it('honors cancellation even if a provider returns a stale response',async()=>{const abort=new AbortController(),p=provider(request=>{abort.abort();return summarizer(request);});await expect(prepareLongContext(p,'Viel Inhalt. '.repeat(5000),'Frage',defaults(),abort.signal,value=>value.length<1000)).rejects.toThrow('abgebrochen');expect(p.chat).toHaveBeenCalledOnce();});
 it('rejects malformed or invented preparation payloads',async()=>{for(const reply of ['not JSON',JSON.stringify({summary:'Text',write:'yes'}),JSON.stringify({summary:5})]){const p=provider(()=>reply);await expect(prepareLongContext(p,'Inhalt. '.repeat(5000),'Frage',defaults(),new AbortController().signal,value=>value.length<500)).rejects.toThrow(/Arbeitszusammenfassung/u);}});
 it('diagnoses instructions that cannot fit even without a note before starting requests',async()=>{const p=provider(summarizer);await expect(prepareLongContext(p,'Notiz','Frage',defaults(),new AbortController().signal,()=>false)).rejects.toThrow(/Frage oder die Feldregeln/u);expect(p.chat).not.toHaveBeenCalled();});
});
describe('whole-note field ideas',()=>{
 it('uses a complete overview for long field analysis while retaining original hashes and pending-only proposals',async()=>{
  const s=defaults(),g=graph(),text='---\nÜberbau:\n---\n'+('Ontologie behandelt das Sein und seine Kategorien.\n\n'.repeat(1200))+'Die abschließende Einordnung lautet Philosophie.';
  const p=provider(request=>request.format&&'summary' in (request.format as {properties:object}).properties?summarizer(request):JSON.stringify({'Überbau':['Philosophie']}));
  const result=await new DocumentAnalyzer(p).analyze('Quelle.md',text,g,profile(),s,new AbortController().signal,()=>{},{fields:['Überbau'],folders:[],allowNew:true,maxSuggestions:4,perField:4,outputId:'relations'});
  expect(result.status).toBe('complete');expect(result.sourceVersion).toBe(await hash(text));expect(result.diagnostics?.sourceMode).toBe('overview');expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0]).toMatchObject({status:'pending',source:'Quelle.md',value:'[[Philosophie]]'});
  const summaryCalls=p.chat.mock.calls.filter(([r])=>'summary' in (r.format as {properties:object}).properties);expect(summaryCalls.slice(0,result.diagnostics!.sourceParts).map(([r])=>read(r).text).join('')).toBe(assignmentDocument(text).evidence.map(e=>e.text).join(''));
  const final=p.chat.mock.calls.at(-1)![0];expect(final.messages[1]!.content).toContain('model-overview');expect(final.messages[1]!.content).toContain('Philosophie');expect(contextEstimate(final.messages,final.maxTokens,final.format)).toBeLessThanOrEqual(s.numCtx);
 });
 it('keeps the full note in every bounded field group and covers every configured role once',()=>{
  const s=defaults(),g=graph(),fields=Array.from({length:11},(_,i)=>'Feld '+i);g.fields=fields;g.rules=Object.fromEntries(fields.map(field=>[field,{...unknownRule(field),description:'Fachliche Rolle '+field}]));
  const text='---\n'+fields.map(field=>field+':').join('\n')+'\n---\nEine zusammenhängende Notiz.';
  const prepared=prepareAssignments('Quelle.md',text,g,profile(),s,{fields,folders:[],allowNew:true,maxSuggestions:44,perField:4,outputId:'relations'});
  expect(prepared.contexts.length).toBeGreaterThan(1);expect(prepared.contexts.flatMap(c=>c.fields)).toEqual(fields);expect(prepared.contexts.every(c=>c.messages[1]!.content.includes('zusammenhängende Notiz'))).toBe(true);
 });
});
