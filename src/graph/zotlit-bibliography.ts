import {t as tr} from '../i18n';
import type {App, TFile} from 'obsidian';
import type {LiteratureReference} from '../types';
import {assert} from '../util';
export interface CslInline {t:string;c?:unknown}
export interface FormattedReference {id:string;marker?:readonly CslInline[];content:readonly CslInline[]}
type CslItem={id:string;[key:string]:unknown};
interface Bridge {runSync<T>(effect:unknown):T;runPromise<T>(effect:unknown,options?:{signal:AbortSignal}):Promise<T>}
interface Render {events?:unknown;readBibliography(items:readonly CslItem[],options?:{presentation:{styleId?:string|null;locale?:string|null}}):unknown}
interface Service {
 bridge:Bridge;runtime?:{cachedContext?:{mapUnsafe?:ReadonlyMap<string,unknown>}};
 citationIndex:{getDocumentCitationSet(file:TFile):unknown};
 profile?:{loaded:unknown;profileOf(file:TFile):unknown};zoteroPref?:{current:unknown;get(name:string):unknown};
 zoteroReads?:{reads:{ItemsByIndexedKeys(input:{indexedKeys:string[]}):unknown;Libraries(input:Record<string,never>):unknown}};
}
export function bibliographyRenderService(app:App):Render|undefined{
 return service(app)?.runtime?.cachedContext?.mapUnsafe?.get('zotlit/pandoc/BibliographyRender') as Render|undefined;
}
function service(app:App):Service|undefined{return (app as App&{plugins?:{plugins?:{zotlit?:{services?:Service}}}}).plugins?.plugins?.zotlit?.services;}
function presentation(app:App,s:Service,file:TFile|undefined):{styleId?:string|null;locale?:string|null}{
 if(!file)return {};const fm=app.metadataCache.getFileCache(file)?.frontmatter??{},result:{styleId?:string|null;locale?:string|null}={};
 if(fm['zotero-note-key']!==undefined&&s.profile){assert(s.bridge.runSync<boolean>(s.profile.loaded),tr("graph.the_zotlit_profile_is_loading"));const profile=s.bridge.runSync<{ok:boolean;profile:{bindings:Record<string,string|null>}}>(s.profile.profileOf(file));assert(profile.ok,tr("graph.the_zotlit_profile_is_unavailable"));result.styleId=profile.profile.bindings['citation.references-style'];}
 else if(fm['zotlit-csl']!==undefined){assert(typeof fm['zotlit-csl']==='string'&&fm['zotlit-csl'].trim(),tr("graph.the_note_s_zotlit_citation_style_is_invalid"));result.styleId=fm['zotlit-csl'].trim();}
 if(fm.lang!==undefined){assert(typeof fm.lang==='string'&&fm.lang.trim(),tr("graph.invalid_zotlit_document_language"));result.locale=fm.lang.trim();}
 return result;
}
/** Uses ZotLit's own bibliography renderer and selected CSL style. No citation punctuation is composed here. */
export async function readZotlitBibliography(app:App,source:string,references:readonly LiteratureReference[],signal:AbortSignal):Promise<Map<string,FormattedReference>>{
 const s=service(app),render=bibliographyRenderService(app);assert(s&&typeof render?.readBibliography==='function',tr("graph.zotlit_bibliography_formatting_is_unavailable"));
 const file=app.vault.getFileByPath(source)??undefined,items=new Map<string,CslItem>();
 // Reuse ZotLit's actual document sources, including its offline CSL conversion and all disambiguating works.
 if(file?.extension==='md'){const doc=await s.bridge.runPromise<{sources:ReadonlyMap<string,{csl:CslItem}>}>(s.citationIndex.getDocumentCitationSet(file),{signal});for(const [key,entry]of doc.sources)items.set(key,entry.csl);}
 const wanted=[...new Set(references.flatMap(r=>r.indexedKey?[r.indexedKey]:[]))],missing=wanted.filter(key=>!items.has(key));
 if(missing.length&&s.zoteroReads&&s.zoteroPref){
  // For uncited Library results, Zotero supplies canonical CSL JSON through the same local API its export uses.
  const pref=s.bridge.runSync<{httpPort:number|null}>(s.zoteroPref.current);
  const http=s.runtime?.cachedContext?.mapUnsafe?.get('zotlit/zotero-http/ZoteroHttp') as {get(url:string):unknown}|undefined;
  if(s.bridge.runSync(s.zoteroPref.get('httpServer.localAPI.enabled'))===true&&pref.httpPort&&http){
   const metadata=await s.bridge.runPromise<ReadonlyMap<string,{key:string;libraryID:number}>>(s.zoteroReads.reads.ItemsByIndexedKeys({indexedKeys:missing}),{signal});
   const libraries=await s.bridge.runPromise<readonly {libraryID:number;groupID:number|null}[]>(s.zoteroReads.reads.Libraries({}),{signal});
   const groups=new Map<string,Map<string,string>>();
   for(const [key,item]of metadata){const library=libraries.find(l=>l.libraryID===item.libraryID);if(!library)continue;const route=library.groupID==null?'users/0':'groups/'+library.groupID;const group=groups.get(route)??new Map<string,string>();group.set(item.key,key);groups.set(route,group);}
   for(const [route,group]of groups)for(let offset=0;offset<group.size;offset+=100){
    const query=new URLSearchParams({itemKey:[...group.keys()].slice(offset,offset+100).join(','),include:'csljson',limit:'100',v:'3'});
    const response=await s.bridge.runPromise<{status:number;json:unknown}>(http.get(`http://127.0.0.1:${pref.httpPort}/api/${route}/items?${query}`),{signal});
    assert(response.status===200,tr("graph.zotero_cannot_provide_the_csl_bibliography_data"));
    const rows=await s.bridge.runPromise<readonly {key:string;csljson:string|readonly CslItem[]}[]>(response.json,{signal});
    for(const row of rows){const key=group.get(row.key),data:unknown=typeof row.csljson==='string'?JSON.parse(row.csljson) as unknown:row.csljson,csl=Array.isArray(data)?data[0] as CslItem|undefined:undefined;if(key&&csl&&typeof csl.id==='string')items.set(key,csl);}
   }
  }
 }
 assert(!signal.aborted,tr("labels.bibliography_formatting_cancelled"));
 const formatted=await s.bridge.runPromise<{entries:readonly FormattedReference[]}|null>(render.readBibliography([...items.values()],{presentation:presentation(app,s,file)}),{signal});
 assert(formatted,tr("graph.zotlit_cannot_format_the_bibliography_check_its_citation_style_and_pandoc"));
 const entries=new Map(formatted.entries.map(entry=>[entry.id,entry])),result=new Map<string,FormattedReference>();
 for(const key of wanted){const id=items.get(key)?.id,entry=id?entries.get(id):undefined;if(entry)result.set(key,entry);}
 return result;
}
interface Pending {reference:LiteratureReference;resolve:(value:FormattedReference)=>void;reject:(reason:unknown)=>void}
const pending=new WeakMap<App,Map<string,Pending[]>>();
/** One batch for all reference rows created in the same render. */
export function formatZotlitReference(app:App,source:string,reference:LiteratureReference):Promise<FormattedReference>{
 return new Promise((resolve,reject)=>{
  let sources=pending.get(app);if(!sources){sources=new Map();pending.set(app,sources);}const rows=sources.get(source);
  const item={reference,resolve,reject};if(rows){rows.push(item);return;}const batch=[item];sources.set(source,batch);
  void Promise.resolve().then(async()=>{sources.delete(source);const abort=new AbortController(),timer=window.setTimeout(()=>abort.abort(),10000);
   try{const entries=await readZotlitBibliography(app,source,batch.map(r=>r.reference),abort.signal);for(const row of batch){const entry=entries.get(row.reference.indexedKey??'');if(entry)row.resolve(entry);else row.reject(new Error(tr("graph.the_zotlit_reference_is_unavailable_for_previously_uncited_works_open_zotero")));}}
   catch(error){for(const row of batch)row.reject(error);}finally{window.clearTimeout(timer);}
  });
 });
}
