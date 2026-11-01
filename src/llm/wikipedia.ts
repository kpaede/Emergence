import type {WikipediaContext, WikipediaSource} from '../types';
import {assert, clone} from '../util';
import {nativeRequest, requestResponse, type UrlTransport} from './request';

export interface WikipediaLookup {lookup(query: string, signal: AbortSignal): Promise<WikipediaContext>;clear?():void}
/** Only fixed Wikipedia API hosts; the caller supplies a visible term, never note bodies. */
export class WikipediaProvider implements WikipediaLookup {
 private cache=new Map<string,{until:number;value:WikipediaContext}>();
 constructor(private transport: UrlTransport=nativeRequest) {}
 clear():void{this.cache.clear();}
 async lookup(input: string, signal: AbortSignal): Promise<WikipediaContext> {
  const query=input.trim().replace(/\s+/gu,' ');
  assert(query.length>0&&query.length<=180,'Bitte einen Wikipedia-Suchbegriff mit höchstens 180 Zeichen eingeben.');
  assert(!signal.aborted,'Recherche abgebrochen.');
  const key=query,cached=this.cache.get(key);
  if(cached&&cached.until>Date.now())return {...clone(cached.value),cached:true};
  const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  const timeout=window.setTimeout(()=>controller.abort(),12000);
  const base={query,sources:[] as WikipediaSource[],fetchedAt:new Date().toISOString()};
  try{
   for(const search of [false,true])for(const language of ['de','en'] as const){
    const pages=await this.pages(query,language,search,controller.signal);
    assert(!signal.aborted,'Recherche abgebrochen.');
    if(pages.length){const value:WikipediaContext={...base,status:'ready',sources:pages};this.remember(key,value,600000);return clone(value);}
   }
   const value:WikipediaContext={...base,status:'empty',message:'Kein geeigneter Wikipedia-Artikel gefunden. Kein Wikipedia-Kontext verfügbar.'};
   this.remember(key,value,60000);return value;
  }catch{
   assert(!signal.aborted,'Recherche abgebrochen.');
   return {...base,status:'error',message:'Wikipedia konnte nicht geladen werden. Kein Wikipedia-Kontext verfügbar.'};
  }finally{
   window.clearTimeout(timeout);signal.removeEventListener('abort',abort);
  }
 }
 private remember(key:string,value:WikipediaContext,ttl:number):void{
  this.cache.set(key,{until:Date.now()+ttl,value});if(this.cache.size>32)this.cache.delete(this.cache.keys().next().value!);
 }
 private async pages(query:string,language:'de'|'en',search:boolean,signal:AbortSignal):Promise<WikipediaSource[]>{
  const url=new URL(`https://${language}.wikipedia.org/w/api.php`);
  const params={action:'query',format:'json',formatversion:'2',origin:'*',redirects:'1',prop:'extracts|info|links|pageprops',exintro:'1',explaintext:'1',exchars:'1800',inprop:'url',plnamespace:'0',pllimit:'30',
   ...(search?{generator:'search',gsrsearch:query,gsrlimit:'2',gsrnamespace:'0'}:{titles:query})};
  for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
  const response=await requestResponse(this.transport,{url:url.href,method:'GET',headers:{Accept:'application/json','Api-User-Agent':'Emergence (Obsidian desktop plugin; Wikipedia context)'},throw:false},signal);
  assert(response.status>=200&&response.status<300,'Wikipedia ist nicht erreichbar.');
  assert(response.arrayBuffer.byteLength<=1000000,'Wikipedia-Antwort zu groß.');
  const body:unknown=JSON.parse(response.text);
  if(!body||typeof body!=='object'||'error'in body)throw new Error('Ungültige Wikipedia-Antwort.');
  const rows=(body as {query?:{pages?:unknown[]}}).query?.pages;if(!Array.isArray(rows))return [];
  const sources:WikipediaSource[]=[];
  for(const row of rows){
   if(!row||typeof row!=='object')continue;
   const page=row as {pageid?:number;ns?:number;title?:string;extract?:string;missing?:boolean;pageprops?:Record<string,unknown>;links?:{title?:string}[];index?:number};
   if(page.ns!==0||!Number.isInteger(page.pageid)||page.pageid!<=0||page.missing||typeof page.title!=='string'||typeof page.extract!=='string'||!page.extract.trim()||page.pageprops&&'disambiguation'in page.pageprops)continue;
   const title=page.title.slice(0,300),excerpt=page.extract.replace(/\s+/gu,' ').trim().slice(0,1800);
   sources.push({id:`WP-${language}-${page.pageid}`,title,excerpt,language,url:`https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /gu,'_'))}`,
    related:Array.isArray(page.links)?[...new Set(page.links.flatMap(link=>typeof link.title==='string'?[link.title.slice(0,180)]:[]))].slice(0,30):[]});
  }
  return sources.sort((a,b)=>Number(b.title.toLocaleLowerCase()===query.toLocaleLowerCase())-Number(a.title.toLocaleLowerCase()===query.toLocaleLowerCase())).slice(0,2);
 }
}
