import type {App,CachedMetadata} from 'obsidian';
import {backlinkSources} from './backlinks';

const structuralKey=(key:string)=>key==='emergence-main-document'||key.startsWith('emergence-sections.')||key.startsWith('emergence-section-files.');
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function resolved(app:App,link:unknown,source:string):string|undefined{
 if(typeof link!=='string')return;
 const path=link.replace(/^\[\[/u,'').replace(/\]\]$/u,'').split('|')[0]!.split('#')[0]!;
 return app.metadataCache.getFirstLinkpathDest(path,source)?.path??app.vault.getFileByPath(path.endsWith('.md')?path:path+'.md')?.path;
}
/** Count generated references only; an additional author-written reference keeps the backlink. */
function automaticReferences(app:App,source:string,target:string,cache:CachedMetadata):number{
 const fm=cache.frontmatter;if(typeof fm?.['emergence-companion-id']!=='string'||typeof fm['emergence-main-document']!=='string')return 0;
 let count=0;
 for(const link of cache.frontmatterLinks??[])if(structuralKey(link.key)&&resolved(app,link.link,source)===target)count++;
 const storage=record(fm['emergence-storage']);
 if(fm['emergence-companion-role']==='index'||storage.mode==='sections')for(const member of Object.values(record(fm['emergence-section-files'])))if(resolved(app,member,source)===target)count++;
 return count;
}
/** Display filter over Obsidian's existing index. No note reads or index modifications. */
export function graphBacklinkSources(app:App,target:string,hideAutomatic=true):string[]{
 const index=app.metadataCache.resolvedLinks,sources=backlinkSources(index,target);if(!hideAutomatic)return sources;
 return sources.filter(source=>{const file=app.vault.getFileByPath(source),cache=file?app.metadataCache.getFileCache(file):null;if(!cache)return true;return (index[source]?.[target]??0)>automaticReferences(app,source,target,cache);});
}
