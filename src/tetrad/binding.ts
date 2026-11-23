import type {App,TFile} from 'obsidian';
import {t} from '../i18n';
import {noteEditor,noteText} from './note';
import {parseSource,relocateTetrad,tetradBlocks,type TetradBlock} from './source';
import type {TetradPattern} from './patterns';
/** Serial writes, with a fresh source comparison inside the actual vault transaction. */
export class TetradBinding {
 private queue:Promise<void>=Promise.resolve();
 private failure?:Error;
 constructor(readonly app:App,readonly file:TFile,private note:string,private block:TetradBlock,private patterns:()=>TetradPattern[]){}
 get index():number{return this.block.index;}
 get source():string{return this.block.source;}
 refresh():Promise<void>{return this.enqueue(async()=>{
  const next=await noteText(this.app,this.file),block=relocateTetrad(this.note,next,this.block,this.patterns());
  this.block=block;this.note=next;
 });}
 save(source:string):Promise<void>{
  return this.enqueue(async()=>{
   const patterns=this.patterns(),found=tetradBlocks(source,patterns),candidate=found[0];
   if(found.length!==1||candidate?.source!==source)throw new Error(t('tetrad.invalidSource'));
   const pattern=patterns.find(value=>value.id===candidate.type);
   if(!pattern)throw new Error(t('tetrad.invalidSource'));
   parseSource(source,pattern);
   const current=await noteText(this.app,this.file),block=relocateTetrad(this.note,current,this.block,patterns);
   if(current.slice(block.to)&&!source.endsWith('\n'))source+=current.includes('\r\n')?'\r\n':'\n';
   const next=current.slice(0,block.from)+source+current.slice(block.to);
   const editor=noteEditor(this.app,this.file.path);
   if(editor){if(editor.getValue()!==current)throw new Error(t('tetrad.conflict'));editor.replaceRange(source,editor.offsetToPos(block.from),editor.offsetToPos(block.to),'emergence-tetrad');}
   else await this.app.vault.process(this.file,latest=>{if(latest!==current)throw new Error(t('tetrad.conflict'));return next;});
   this.note=next;this.block={...block,to:block.from+source.length,type:candidate.type,source};
  });
 }
 private enqueue(action:()=>Promise<void>):Promise<void>{
  const job=this.queue.then(action);
  // A rejected write must remain observable to flush(), without poisoning later
  // attempts. Every attempt still checks the actual file before changing it.
  this.queue=job.then(()=>{this.failure=undefined;},(error:unknown)=>{this.failure=error instanceof Error?error:new Error(String(error));});
  return job;
 }
 async flush():Promise<void>{
  let pending:Promise<void>;
  do{pending=this.queue;await pending;}while(pending!==this.queue);
  if(this.failure)throw this.failure;
 }
}
