import {describe,it,expect,vi} from 'vitest';
import type {App} from 'obsidian';
import {readZotlitBibliography} from '../src/graph/zotlit-bibliography';
function fixture(){
 const csl={id:'native-id',title:'Example'},entry={id:'native-id',content:[{t:'Str',c:'Original ZotLit output.'},{t:'Emph',c:[{t:'Str',c:'Book title'}]}]};
 const render={readBibliography:vi.fn(async()=>({entries:[entry]}))},http={get:vi.fn(async()=>({status:200,json:Promise.resolve([{key:'AAAA',csljson:JSON.stringify([csl])}])}))};
 const services={bridge:{runSync:(value:unknown)=>value,runPromise:async(value:unknown)=>value},runtime:{cachedContext:{mapUnsafe:new Map<string,unknown>([['zotlit/pandoc/BibliographyRender',render],['zotlit/zotero-http/ZoteroHttp',http]])}},citationIndex:{getDocumentCitationSet:vi.fn(async()=>({sources:new Map([['indexed',{csl}]])}))},zoteroPref:{current:{httpPort:23119},get:()=>true},zoteroReads:{reads:{ItemsByIndexedKeys:vi.fn(async()=>new Map([['indexed',{key:'AAAA',libraryID:1}]])),Libraries:vi.fn(async()=>[{libraryID:1,groupID:null}])}}};
 const file={path:'Source.md',extension:'md'},fm:Record<string,unknown>={};
 const app={plugins:{plugins:{zotlit:{services}}},vault:{getFileByPath:()=>file},metadataCache:{getFileCache:()=>({frontmatter:fm})}} as unknown as App;
 return {app,file,fm,services,render,entry,csl,http};
}
describe('original ZotLit CSL bibliography',()=>{
 it('returns the engine output unchanged and formats the whole document for disambiguation',async()=>{const f=fixture(),signal=new AbortController().signal;expect(await readZotlitBibliography(f.app,'Source.md',[{indexedKey:'indexed'}],signal)).toEqual(new Map([['indexed',f.entry]]));expect(f.render.readBibliography).toHaveBeenCalledWith([f.csl],{presentation:{}});expect(f.http.get).not.toHaveBeenCalled();});
 it('passes the existing ZotLit note style and language to its formatter',async()=>{const f=fixture();f.fm['zotlit-csl']='native-style';f.fm.lang='de-DE';await readZotlitBibliography(f.app,'Source.md',[{indexedKey:'indexed'}],new AbortController().signal);expect(f.render.readBibliography).toHaveBeenCalledWith([f.csl],{presentation:{styleId:'native-style',locale:'de-DE'}});});
 it('refuses a malformed explicit style rather than silently inventing a fallback',async()=>{const f=fixture();f.fm['zotlit-csl']=[];await expect(readZotlitBibliography(f.app,'Source.md',[{indexedKey:'indexed'}],new AbortController().signal)).rejects.toThrow('Ungültiger ZotLit');expect(f.render.readBibliography).not.toHaveBeenCalled();});
 it('uses Zotero canonical CSL JSON for uncited search hits, preserving exact item identity',async()=>{const f=fixture();f.services.citationIndex.getDocumentCitationSet.mockResolvedValue({sources:new Map()});expect((await readZotlitBibliography(f.app,'Source.md',[{indexedKey:'indexed'}],new AbortController().signal)).get('indexed')).toEqual(f.entry);expect(f.http.get).toHaveBeenCalledWith('http://127.0.0.1:23119/api/users/0/items?itemKey=AAAA&include=csljson&limit=100&v=3');});
 it('does not compose a custom citation when the native engine is unavailable',async()=>{const f=fixture();f.render.readBibliography.mockResolvedValue(null as never);await expect(readZotlitBibliography(f.app,'Source.md',[{indexedKey:'indexed'}],new AbortController().signal)).rejects.toThrow('ZotLit kann');});
});
