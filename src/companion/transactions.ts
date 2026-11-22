import type {App} from 'obsidian';
import {t} from '../i18n';
import {readNote,writeCompanion,writeChapterAdoption} from './repository';
import {renamedPath} from '../graph/rename';
import {parseCompanion} from './codec';
import type {FileWrite} from './storage';
export interface PendingWrite {path:string;writes:FileWrite[]}
/** A local recovery journal makes multi-file moves recoverable; it is not a distributed filesystem lock. */
export class CompanionTransactions{
 readonly pending=new Map<string,PendingWrite>();
 constructor(private app:App,private persist:()=>Promise<void>,saved:unknown,private protectedSource:(path:string)=>boolean=()=>false){
  for(const value of Array.isArray(saved)?saved:[]){if(!value||typeof value!=='object')continue;const item=value as PendingWrite;if(typeof item.path==='string'&&Array.isArray(item.writes)&&item.writes.every(w=>typeof w.path==='string'&&(w.before===null||typeof w.before==='string')&&typeof w.after==='string'&&(w.kind===undefined||w.kind==='adopt-chapter'&&w.before!==null)))this.pending.set(item.path,item);}
 }
 async apply(path:string,writes:FileWrite[]):Promise<void>{
  if(!writes.length)return;if(this.pending.has(path))throw new Error(t('companion.pendingRecovery'));
  if(writes.length===1&&writes[0]!.before!==null&&writes[0]!.kind!=='adopt-chapter'){const w=writes[0]!;await writeCompanion(this.app,w.path,w.before!,w.after);return;}
  // Preflight every existing destination before touching the first file.
  for(const w of writes){if(w.before===null){if(this.app.vault.getAbstractFileByPath(w.path))throw new Error(t('companion.conflict'));}else if(await readNote(this.app,w.path)!==w.before)throw new Error(t('companion.conflict'));}
  this.pending.set(path,{path,writes});await this.persist();
  try{
   for(const w of writes){if(w.before===null){parseCompanion(w.after);await this.app.vault.create(w.path,w.after);}else if(w.kind==='adopt-chapter')await writeChapterAdoption(this.app,path,w.path,w.before,w.after,false,this.protectedSource);else await writeCompanion(this.app,w.path,w.before,w.after);}
   this.pending.delete(path);await this.persist();
  }catch(error){try{await this.recover(path);}catch{/* Preserve the journal when another writer has changed a completed step. */}throw error;}
 }
 rename(oldPath:string,newPath:string):void{for(const [key,item]of [...this.pending]){const path=renamedPath(item.path,oldPath,newPath);item.path=path;for(const w of item.writes)w.path=renamedPath(w.path,oldPath,newPath);if(path!==key){this.pending.delete(key);this.pending.set(path,item);}}}
 async accept(path:string,validate:()=>Promise<void>):Promise<void>{if(!this.pending.has(path))return;await validate();this.pending.delete(path);await this.persist();}
 async recover(path:string):Promise<void>{
  const pending=this.pending.get(path);if(!pending)return;
  for(const w of [...pending.writes].reverse()){
   const file=this.app.vault.getFileByPath(w.path);if(!file){if(w.before===null)continue;throw new Error(t('companion.pendingRecovery'));}
   const current=await readNote(this.app,w.path);if(current===w.before)continue;if(current!==w.after)throw new Error(t('companion.pendingRecovery'));
   if(w.before===null)await this.app.fileManager.trashFile(file);else if(w.kind==='adopt-chapter')await writeChapterAdoption(this.app,path,w.path,w.before,w.after,true,this.protectedSource);else await writeCompanion(this.app,w.path,current,w.before);
  }
  this.pending.delete(path);await this.persist();
 }
}
