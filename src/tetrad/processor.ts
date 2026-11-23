import {Component,MarkdownRenderChild,Notice,type MarkdownPostProcessorContext,type Plugin,type TFile} from 'obsidian';
import {t} from '../i18n';
import {errorMessage} from '../util';
import {DiagramControls,trackDiagramControls} from '../mermaid/note-controls';
import {noteText} from './note';
import {liveTetradTarget} from './live-target';
import {tetradBlocks,type TetradBlock} from './source';
import {tetradFingerprint,resolveNoteTarget,type TetradFingerprint} from './note-target';
import {renderTetrad} from './render/source';
import type {TetradLayout} from './render/layout';
import type {TetradStore} from './patterns';
interface Entry{layout?:TetradLayout;rendered?:Component;controls?:DiagramControls;generation:number;work:Promise<void>;alive:boolean;fingerprint:TetradFingerprint;source?:string;error?:HTMLElement;render:()=>void}

export class TetradProcessor {
 private entries=new Map<HTMLElement,Entry>();
 constructor(private store:TetradStore,private enabled:()=>boolean){}
 process(element:HTMLElement,context:MarkdownPostProcessorContext,open:(file:TFile,index:number)=>Promise<void>,plugin:Plugin):void{
  if(element.closest('.em-tetrad-source-probe,.em-tetrad-preview,.em-tetrad-render-content'))return;
  const candidates=Array.from(element.querySelectorAll<HTMLElement>('.callout[data-callout]'));if(element.matches('.callout[data-callout]'))candidates.unshift(element);
  for(const callout of candidates){
   if(callout.parentElement?.closest('.callout[data-callout]')||this.entries.has(callout)||callout.closest('.em-tetrad-source-probe,.em-tetrad-preview,.em-tetrad-render-content')||!this.store.pattern(callout.dataset.callout??''))continue;
   const entry:Entry={generation:0,work:Promise.resolve(),alive:true,fingerprint:tetradFingerprint(callout),render:()=>{}};this.entries.set(callout,entry);
   const initialSection=context.getSectionInfo(callout)??context.getSectionInfo(element);
   const resolve=async():Promise<{file:TFile;block:TetradBlock}>=>{
    const live=liveTetradTarget(plugin.app,callout,context.sourcePath,this.store.list());if(live)return live;
    const file=plugin.app.vault.getFileByPath(context.sourcePath);if(!file)throw new Error(t('tetrad.useCursor'));
    const section=context.getSectionInfo(callout)??context.getSectionInfo(element)??initialSection,note=await noteText(plugin.app,file),blocks=tetradBlocks(note,this.store.list()).filter(block=>!section||(block.line>=section.lineStart&&block.line<=section.lineEnd));
    if(entry.source){const exact=blocks.filter(block=>block.source===entry.source);if(exact.length===1)return {file,block:exact[0]!};}
    return {file,block:await resolveNoteTarget(plugin.app,file.path,blocks,callout.dataset.callout??'',entry.fingerprint,!!section)};
   };
   entry.render=()=>{const generation=++entry.generation;entry.work=entry.work.then(async()=>{
    if(!entry.alive||generation!==entry.generation)return;entry.layout?.destroy();entry.layout=undefined;entry.rendered?.unload();entry.rendered=undefined;entry.error?.remove();entry.error=undefined;
    if(!this.enabled()){entry.controls?.refresh();return;}
    try{const {file,block}=await resolve();if(!entry.alive||generation!==entry.generation)return;const pattern=this.store.pattern(block.type);if(!pattern)return;const rendered=new Component();rendered.load();entry.rendered=rendered;entry.source=block.source;entry.layout=await renderTetrad(plugin.app,callout,block.source,pattern,this.store.settings(pattern),file.path,rendered,()=>entry.alive&&generation===entry.generation);
     if(!entry.alive){entry.layout.destroy();rendered.unload();return;}entry.controls?.refresh();
    }catch(error){entry.rendered?.unload();entry.rendered=undefined;if(entry.alive&&generation===entry.generation)entry.error=callout.createDiv({cls:'tetrader-hint em-error',text:errorMessage(error)});}
   }).catch((error:unknown)=>{if(entry.alive)entry.error=callout.createDiv({cls:'tetrader-hint em-error',text:errorMessage(error)});});};
   const enabled=this.enabled,remove=()=>this.entries.delete(callout);
   class Child extends MarkdownRenderChild {
    onload():void{entry.controls=this.addChild(trackDiagramControls(plugin,new DiagramControls(callout,async()=>{const {file,block}=await resolve();await open(file,block.index);},error=>new Notice(errorMessage(error)),'.tetrader-tetrad',()=>t('tetrad.edit'),enabled)));entry.render();}
    onunload():void{entry.alive=false;entry.generation++;entry.layout?.destroy();entry.rendered?.unload();entry.error?.remove();remove();}
   }
   context.addChild(new Child(callout));
  }
 }
 update():void{for(const entry of this.entries.values())entry.render();}
 destroy():void{for(const entry of this.entries.values()){entry.alive=false;entry.generation++;entry.layout?.destroy();entry.rendered?.unload();entry.controls?.unload();entry.error?.remove();}this.entries.clear();}
}
