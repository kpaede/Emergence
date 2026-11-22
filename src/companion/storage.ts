import {parseDocument} from 'yaml';
import type {App} from 'obsidian';
import {t} from '../i18n';
import {parseCompanion,serializeCompanion,emptyCompanion} from './codec';
import {defaultStorage,type StorageOptions,type CompanionDocument} from './model';
import {readNote,validPath} from './repository';
import {validSubfolder} from './preferences';
import {MissingSectionFileError} from './problems';
export interface FileWrite {path:string;before:string|null;after:string;kind?:'adopt-chapter'}
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function validFolder(folder:string):boolean{return !folder||validPath(folder+'/test.md');}
export function storageOptions(value:unknown):StorageOptions{
 const item=record(value);return {mode:item.mode==='sections'?'sections':'document',location:item.location==='folder'?'folder':item.location==='subfolder'?'subfolder':'beside',folder:typeof item.folder==='string'&&validFolder(item.folder)?item.folder:'',...(item.location==='subfolder'||typeof item.subfolder==='string'?{subfolder:validSubfolder(item.subfolder)?item.subfolder:'Companions'}:{}),...(item.origin==='defaults'||item.origin==='custom'?{origin:item.origin}:{})};
}
export function readStorage(doc:CompanionDocument):void{
 const yaml=parseDocument(doc.header),data=record(yaml.toJSON()),stored=record(data['emergence-storage']),role=data['emergence-companion-role'],files=record(data['emergence-section-files']);
 const invalidMode=stored.mode!==undefined&&stored.mode!=='document'&&stored.mode!=='sections',invalidRole=role!==undefined&&role!=='document'&&role!=='index'&&role!=='section';
 const conflictingRole=role==='document'&&stored.mode!=='document'||role==='index'&&stored.mode!=='sections',conflictingFiles=stored.mode!=='sections'&&Object.keys(files).length>0;
 if(invalidMode||invalidRole||conflictingRole||conflictingFiles)throw new Error(t('companion.layoutMismatch'));
 if(stored.folder!==undefined&&(typeof stored.folder!=='string'||!validFolder(stored.folder)))throw new Error(t('companion.invalidFolder'));doc.storage=storageOptions(stored);doc.files={};for(const [id,path]of Object.entries(files))if(typeof path==='string'&&validPath(path))doc.files[id]=path;
}
export function storageHeader(doc:CompanionDocument):void{const yaml=parseDocument(doc.header||'');yaml.set('emergence-storage',doc.storage??defaultStorage());yaml.set('emergence-companion-role',doc.storage?.mode==='sections'?'index':'document');if(doc.storage?.mode==='sections')yaml.set('emergence-section-files',doc.files??{});doc.header=yaml.toString({lineWidth:0});}
export function resolveSource(app:App,source:string,context:string):string{const direct=app.vault.getFileByPath(source);if(direct)return direct.path;return typeof app.metadataCache.getFirstLinkpathDest==='function'?app.metadataCache.getFirstLinkpathDest(source.replace(/\.md$/u,''),context)?.path??source:source;}
export async function readStored(app:App,path:string):Promise<CompanionDocument>{return readStoredDocument(app,path,false);}
/** Available chapters remain readable; unavailable files are explicit and never become empty drafts. */
export async function readStoredForView(app:App,path:string):Promise<CompanionDocument>{return readStoredDocument(app,path,true);}
async function readStoredDocument(app:App,path:string,partial:boolean):Promise<CompanionDocument>{
 if(!app.vault.getFileByPath(path))throw new Error(t('companion.fileMissing'));
 const doc=parseCompanion(await readNote(app,path));readStorage(doc);doc.source=resolveSource(app,doc.source,path);doc.fileOriginals={};
 if(doc.storage?.mode==='sections')for(const section of doc.sections){
  const member=doc.files?.[section.id];
  try{
   if(!member||!app.vault.getFileByPath(member))throw new MissingSectionFileError(member??section.title);
   const text=await readNote(app,member,true),part=parseCompanion(text),metadata=record(parseDocument(part.header).toJSON());part.source=resolveSource(app,part.source,member);
   if(metadata['emergence-companion-role']!=='section'||metadata['emergence-parent-companion-id']!==doc.id||part.sections.length!==1||part.sections[0]?.id!==section.id)throw new Error(t('companion.invalid'));
   doc.fileOriginals[member]=text;if(part.sections[0].title!==section.title||part.sections[0].level!==section.level||part.sections[0].state!==section.state||part.source!==doc.source||part.sections[0].format!==section.format)doc.storageDrift=true;section.raw=part.sections[0].raw;section.format=part.sections[0].format;
  }catch(error){
   if(!partial)throw error;doc.unavailableFiles??={};doc.unavailableFiles[section.id]={path:member??'',reason:error instanceof MissingSectionFileError?'missing':'invalid',reference:section.raw,message:error instanceof Error?error.message:String(error)};section.raw='';
  }
 }
 return doc;
}
export function targetFolder(source:string,options:StorageOptions):string{const parent=source.split('/').slice(0,-1).join('/');return options.location==='folder'?options.folder:options.location==='subfolder'?[parent,options.subfolder??'Companions'].filter(Boolean).join('/'):parent;}
function safeName(text:string):string{return text.replace(/[\\/:*?"<>|#[\]\r\n\0]/gu,' ').replace(/\s+/gu,' ').replace(/^\.+|[. ]+$/gu,'').trim().slice(0,90)||t('companion.untitled');}
export async function ensureFolder(app:App,folder:string):Promise<void>{if(!validFolder(folder))throw new Error(t('companion.invalidFolder'));let current='';for(const segment of folder.split('/').filter(Boolean)){current=current?current+'/'+segment:segment;if(!app.vault.getAbstractFileByPath(current))await app.vault.createFolder(current);}}
export function freePath(app:App,folder:string,name:string,reserved=new Set<string>()):string{const base=(folder?folder+'/':'')+safeName(name);let path=base+'.md';for(let n=2;app.vault.getAbstractFileByPath(path)||reserved.has(path);n++)path=base+' '+n+'.md';reserved.add(path);return path;}
/** Index metadata is separate from thought content. Reordering headings does not rewrite every section file. */
export function planStorage(app:App,path:string,document:CompanionDocument):FileWrite[]{
 if(document.storage?.mode!=='sections'&&Object.keys(document.unavailableFiles??{}).length)throw new Error(t('companion.sectionFileMissing'));
 if(document.storage?.mode!=='sections'){storageHeader(document);return [{path,before:document.original,after:serializeCompanion(document)}];}
 const doc=structuredClone(document),plan:FileWrite[]=[],reserved=new Set(Object.values(doc.files??{}));doc.files??={};const folder=targetFolder(doc.source,doc.storage!);
 for(const section of doc.sections){
  // Unknown contents must never be interpreted as an empty chapter or recreated.
  if(doc.unavailableFiles?.[section.id])continue;
  const member=doc.files[section.id]??freePath(app,folder,doc.source.split('/').at(-1)!.replace(/\.md$/u,'')+' – '+section.title,reserved);doc.files[section.id]=member;
  const before=doc.fileOriginals?.[member]??null,part=before?parseCompanion(before):emptyCompanion(doc.source);part.source=doc.source;
  if(before){const old=part.sections[0]!;if(old.title===section.title&&old.level===section.level&&old.state===section.state&&old.raw===section.raw&&part.source===parseCompanion(before).source)continue;}
  part.sections=[structuredClone(section)];const yaml=parseDocument(part.header||'');yaml.set('emergence-companion-role','section');yaml.set('emergence-parent-companion-id',doc.id);part.header=yaml.toString({lineWidth:0});plan.push({path:member,before,after:serializeCompanion(part)});
 }
 // Write the manifest last. Removed empty section files are retained, never silently deleted.
 const index=structuredClone(doc);for(const section of index.sections)section.raw=index.unavailableFiles?.[section.id]?.reference??`[[${index.files![section.id]!.replace(/\.md$/u,'')}]]${index.newline}${index.newline}`;
 storageHeader(index);plan.push({path,before:document.original||null,after:serializeCompanion(index)});return plan.filter(item=>item.before!==item.after);
}
