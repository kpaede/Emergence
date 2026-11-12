import {t as tr} from '../i18n';
import {Keymap,MarkdownView,Menu,type App,type PaneType} from 'obsidian';
import type {LiteratureReference} from '../types';
import {assert} from '../util';
interface Position {line:number;col?:number;ch?:number}
interface Occurrence {raw?:string;position?:{start:Position;end?:Position}}
interface Attachment {key:string;groupID:number|null;label:string}
interface Source {itemKey:string;groupID:number|null;attachments:readonly Attachment[]}
interface DocumentSources {sources:ReadonlyMap<string,Source>;citations?:readonly {indexedKey:string|null;occurrences:readonly Occurrence[]}[];occurrences?:readonly Occurrence[]}
interface Services {
 bridge:{runPromise<T>(effect:unknown):Promise<T>};
 citationIndex?:{getDocumentCitationSet(file:unknown):unknown};
 citationLookup?:{read(request:{citekeys:string[]}):unknown};
 citekeyEditor?:{openIndexedKey(key:string,pane:PaneType|boolean):unknown};
 zoteroReads?:{reads:{ItemsByIndexedKeys(request:{indexedKeys:string[]}):unknown;Libraries(request:Record<string,never>):unknown;AttachmentsOf(request:{itemIDs:number[]}):unknown}};
}
export interface LiteratureActions {note?:(event:MouseEvent)=>Promise<void>;zotero?:()=>void;attachment?:(event:MouseEvent)=>void;occurrence?:()=>Promise<void>}
function services(app:App):Services|undefined{return (app as App&{plugins?:{plugins?:{zotlit?:{services?:Services}}}}).plugins?.plugins?.zotlit?.services;}
const documents=new WeakMap<App,Map<string,Promise<DocumentSources|undefined>>>();
function documentSources(app:App,s:Services,path:string):Promise<DocumentSources|undefined>{
 const file=app.vault.getFileByPath(path);if(!file||!s.citationIndex)return Promise.resolve(undefined);
 let pending=documents.get(app);if(!pending){pending=new Map();documents.set(app,pending);}const existing=pending.get(path);if(existing)return existing;
 const request=s.bridge.runPromise<DocumentSources>(s.citationIndex.getDocumentCitationSet(file));pending.set(path,request);
 const release=()=>{if(pending.get(path)===request)pending.delete(path);};void request.then(release,release);return request;
}
/** ZotLit/Zotero's documented deep links, built only from canonical item/attachment identities. */
export function zoteroItemUri(kind:'select'|'open',key:string,groupID:number|null):string{
 assert(/^[a-z0-9]+$/iu.test(key),tr("graph.invalid_zotero_identity"));assert(groupID===null||Number.isInteger(groupID)&&groupID>0,tr("graph.invalid_zotero_library"));
 return `zotero://${kind}/${groupID===null?'library':'groups/'+groupID}/items/${encodeURIComponent(key)}`;
}
/** Same file-bearing modes as ZotLit's attachment parser; URL-only and malformed paths stay unavailable. */
function attachmentLabel(path:string|null,mode:number):string|undefined{
 if(!path)return undefined;
 if([0,1,4].includes(mode)){const filename=path.startsWith('storage:')?path.slice(8):'';return filename&&!/[\\/]/u.test(filename)&&!['.','..'].includes(filename)?filename:undefined;}
 if(mode===2&&!/^https?:/iu.test(path)){const relative=path.replace(/^attachments:/u,'');return relative.split(/[/\\]/u).at(-1)||undefined;}
 return undefined;
}
/** Read-only readiness. Only an explicit button click opens a note, Zotero or an attachment. */
export async function literatureActions(app:App,reference:LiteratureReference,sourcePath:string):Promise<LiteratureActions>{
 const s=services(app);if(!s)return {};
 let key=reference.indexedKey;
 if(!key&&reference.citekey&&s.citationLookup){const answer=await s.bridge.runPromise<{resolve(key:string):{kind:string;item?:{indexedKey:string}}}>(s.citationLookup.read({citekeys:[reference.citekey]}));const resolved=answer.resolve(reference.citekey);if(resolved.kind==='unique')key=resolved.item?.indexedKey;}
 if(!key)return {};
 const indexedKey=key,actions:LiteratureActions={};
 if(s.citekeyEditor?.openIndexedKey)actions.note=async event=>{await s.bridge.runPromise(s.citekeyEditor!.openIndexedKey(indexedKey,event.button===1?'tab':Keymap.isModEvent(event)));};
 let doc:DocumentSources|undefined;try{doc=await documentSources(app,s,sourcePath);}catch{ /* Database metadata may still answer for a search hit. */ }
 let source=doc?.sources.get(indexedKey);
 try{if(!source&&s.zoteroReads){
  const reads=s.zoteroReads.reads,items=await s.bridge.runPromise<ReadonlyMap<string,{key:string;itemID:number;libraryID:number}>>(reads.ItemsByIndexedKeys({indexedKeys:[indexedKey]})),item=items.get(indexedKey);
  if(item){const libraries=await s.bridge.runPromise<readonly {libraryID:number;groupID:number|null}[]>(reads.Libraries({})),library=libraries.find(l=>l.libraryID===item.libraryID);
   if(library){const attachments:Attachment[]=[];try{const rows=await s.bridge.runPromise<readonly {key:string;groupID:number|null;path:string;linkMode:number}[]>(reads.AttachmentsOf({itemIDs:[item.itemID]}));for(const row of rows){const label=attachmentLabel(row.path,row.linkMode);if(label&&/^[A-Z0-9]{8}$/u.test(row.key))attachments.push({key:row.key,groupID:row.groupID,label});}}catch{ /* Attachment readiness must not disable the other actions. */ }
    source={itemKey:item.key,groupID:library.groupID,attachments};
   }
  }
 }
 }catch{ /* Optional database readiness must not disable note or occurrence navigation. */ }
 if(source){const identity=source;actions.zotero=()=>{window.open(zoteroItemUri('select',identity.itemKey,identity.groupID));};
  if(identity.attachments.length)actions.attachment=event=>{const open=(attachment:Attachment)=>{window.open(zoteroItemUri('open',attachment.key,attachment.groupID));};
   if(identity.attachments.length===1){open(identity.attachments[0]!);return;}
   const menu=new Menu();for(const attachment of identity.attachments)menu.addItem(item=>item.setTitle(attachment.label).setIcon('paperclip').onClick(()=>open(attachment)));menu.showAtMouseEvent(event);
  };
 }
 const occurrences=doc?.citations?.find(entry=>entry.indexedKey===indexedKey)?.occurrences??doc?.occurrences?.filter(entry=>reference.citekey&&entry.raw===reference.citekey)??[];
 const positioned=occurrences.filter((entry):entry is Occurrence&{position:{start:Position;end?:Position}}=>!!entry.position&&Number.isInteger(entry.position.start.line)&&entry.position.start.line>=0);let cursor=0;
 if(positioned.length)actions.occurrence=async()=>{const occurrence=positioned[cursor++%positioned.length]!,file=app.vault.getFileByPath(sourcePath);assert(file,tr("graph.the_citing_note_is_no_longer_available"));const leaf=app.workspace.getMostRecentLeaf(app.workspace.rootSplit)??app.workspace.getLeaf(false);await leaf.openFile(file,{active:true,eState:{line:occurrence.position.start.line}});
  if(leaf.view instanceof MarkdownView){const from={line:occurrence.position.start.line,ch:occurrence.position.start.ch??occurrence.position.start.col??0},end=occurrence.position.end,to=end?{line:end.line,ch:end.ch??end.col??0}:from;leaf.view.editor.setSelection(from,to);leaf.view.editor.scrollIntoView({from,to},true);}
 };
 return actions;
}
