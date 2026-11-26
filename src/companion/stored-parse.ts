import type {App} from 'obsidian';
import {parseCompanionSnapshot,type CompanionSnapshot} from './codec';
import {ExactTextCache} from './text-cache';
const caches=new WeakMap<App,ExactTextCache<CompanionSnapshot>>();
/** Mutable callers receive their own document; validation metadata stays read-only. */
export function parsedStored(app:App,path:string,text:string):CompanionSnapshot{
 let cache=caches.get(app);if(!cache){cache=new ExactTextCache();caches.set(app,cache);}let parsed=cache.get(path,text);if(!parsed){parsed=parseCompanionSnapshot(text);cache.set(path,text,parsed);}return {document:structuredClone(parsed.document),metadata:parsed.metadata};
}
export function clearStoredParse(app:App):void{caches.get(app)?.clear();caches.delete(app);}
