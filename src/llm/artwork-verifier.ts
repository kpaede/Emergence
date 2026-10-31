import Ajv from 'ajv';
import type {LLMProvider} from './provider';
import type {ResearchIdea} from './research-examples';
import type {Settings} from '../types';
import {ensureBudget} from './context';
import {assert} from '../util';
/** An independent, short classification pass cannot invent replacement titles. */
export async function filterArtworks(provider: LLMProvider, ideas: ResearchIdea[], term: string, settings: Settings, signal: AbortSignal): Promise<ResearchIdea[]> {
 if(!ideas.length)return [];
 const proposals=ideas.map((idea,index)=>({id:'A'+index,title:idea.title,creator:idea.creator,genre:idea.artForm})),ids=proposals.map(p=>p.id);
 const format={type:'object',additionalProperties:false,required:ids,properties:Object.fromEntries(ids.map(id=>[id,{type:'boolean'}]))};
 const messages=[{role:'system' as const,content:'Prüfe die Vorschläge unabhängig. true NUR für ein dir tatsächlich bekanntes existierendes Kunstwerk mit zutreffender Urheberschaft, plausibler Kunstgattung und nachvollziehbarem Bezug zum Begriff. Fachbücher, philosophische Abhandlungen, kunsttheoretische Texte, Rezensionen und Sekundärliteratur sind false, auch wenn Kunstwerk im Titel steht. Vornamen der Urheber sind keine Kunstgattungen. Bei unbekannten oder wahrscheinlich erfundenen Werken false. Die vorgegebene Gattung kann falsch sein: prüfe sie, übernimm sie nicht ungeprüft. Keine neuen Titel, keine Erklärungen. Nur die IDs mit true oder false.'},
  {role:'user' as const,content:JSON.stringify({term,proposals})}];
 ensureBudget(messages,settings,160,format);
 const text=await provider.chat({messages,format,maxTokens:160,temperature:0,signal});assert(!signal.aborted,'Recherche abgebrochen.');
 const data:unknown=JSON.parse(text),validate=new Ajv({strict:true}).compile<Record<string,boolean>>(format);assert(validate(data),'Kunstwerkprüfung unvollständig.');
 return ideas.filter((_,index)=>data['A'+index]).slice(0,4);
}
