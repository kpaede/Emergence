import type {App,TFile} from 'obsidian';
import {t} from '../i18n';
import {noteEditor,noteText} from './note';
import {relocateTetrad,tetradBlocks,type TetradBlock} from './source';
import type {TetradPattern} from './patterns';
/** Serial writes, with a fresh source comparison inside the actual vault transaction. */
export class TetradBinding {
 private queue:Promise<void>=Promise.resolve();
 private failure?:Error;
 constructor(readonly app:App,readonly file:TFile,private note:string,private block:TetradBlock,private patterns:()=>TetradPattern[]){}
 get index():number{return this.block.index;}
 get source():string{return this.block.source;}
 async refresh():Promise<void>{if(this.failure)throw this.failure;const next=await noteText(this.app,this.file);this.block=relocateTetrad(this.note,next,this.block,this.patterns());this.note=next;}
 save(source:string):Promise<void>{
  const job=this.queue.then(async()=>{
   if(this.failure)throw this.failure;
   const current=await noteText(this.app,this.file),block=relocateTetrad(this.note,current,this.block,this.patterns());
   if(current.slice(block.to)&&!source.endsWith('\n'))source+=current.includes('\r\n')?'\r\n':'\n';
   const next=current.slice(0,block.from)+source+current.slice(block.to);
   const found=tetradBlocks(source,this.patterns());if(found.length!==1||found[0]!.source!==source)throw new Error(t('tetrad.invalidSource'));
   const editor=noteEditor(this.app,this.file.path);
   if(editor){if(editor.getValue()!==current)throw new Error(t('tetrad.conflict'));editor.replaceRange(source,editor.offsetToPos(block.from),editor.offsetToPos(block.to),'emergence-tetrad');}
   else await this.app.vault.process(this.file,latest=>{if(latest!==current)throw new Error(t('tetrad.conflict'));return next;});
   this.note=next;this.block={...block,to:block.from+source.length,source};
  });this.queue=job.catch((error:unknown)=>{this.failure=error instanceof Error?error:new Error(String(error));});return job;
 }
 async flush():Promise<void>{await this.queue;if(this.failure)throw this.failure;}
}
