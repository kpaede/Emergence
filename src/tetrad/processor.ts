import {MarkdownRenderChild,Notice,type MarkdownPostProcessorContext,type Plugin,type TFile} from 'obsidian';
import {t} from '../i18n';
import {noteText} from './note';
import {tetradBlocks} from './source';
import {tetradFingerprint,resolveNoteTarget} from './note-target';
import {mountTetrad,type TetradLayout} from './render/layout';
import type {TetradStore} from './patterns';

export class TetradProcessor {
 private entries=new Map<HTMLElement,{layout?:TetradLayout;button?:HTMLButtonElement}>();
 constructor(private store:TetradStore,private enabled:()=>boolean){}
 process(element:HTMLElement,context:MarkdownPostProcessorContext,open:(file:TFile,index:number)=>Promise<void>,plugin:Plugin):void{
  const candidates=Array.from(element.querySelectorAll<HTMLElement>('.callout[data-callout]'));
  if(element.matches('.callout[data-callout]'))candidates.unshift(element);
  for(const callout of candidates){
   if(this.entries.has(callout)||!this.store.pattern(callout.dataset.callout??''))continue;
   const initialSection=context.getSectionInfo(callout)??context.getSectionInfo(element);
   const entry={layout:undefined as TetradLayout|undefined,button:undefined as HTMLButtonElement|undefined};this.entries.set(callout,entry);this.mount(callout,entry);
   const button=entry.button=callout.createEl('button',{cls:'em-tetrad-open',text:t('tetrad.edit'),attr:{type:'button'}});button.hidden=!this.enabled();
   button.onclick=event=>{event.stopPropagation();event.preventDefault();void (async()=>{
    const file=plugin.app.vault.getFileByPath(context.sourcePath),section=context.getSectionInfo(callout)??context.getSectionInfo(element)??initialSection;
    if(!file)throw new Error(t('tetrad.useCursor'));
    const blocks=tetradBlocks(await noteText(plugin.app,file),this.store.list()).filter(block=>!section||(block.line>=section.lineStart&&block.line<=section.lineEnd));
    const block=await resolveNoteTarget(plugin.app,file.path,blocks,callout.dataset.callout??'',tetradFingerprint(callout),!!section);await open(file,block.index);
   })().catch((error:unknown)=>{new Notice(String(error));});};
   class Child extends MarkdownRenderChild {onunload():void{entry.layout?.destroy();button.remove();}}
   const child=new Child(callout);child.register(()=>this.entries.delete(callout));context.addChild(child);
  }
 }
 private mount(callout:HTMLElement,entry:{layout?:TetradLayout}):void{
  entry.layout?.destroy();entry.layout=undefined;if(!this.enabled())return;
  const pattern=this.store.pattern(callout.dataset.callout??'');if(pattern)entry.layout=mountTetrad(callout,this.store.settings(pattern),pattern);
 }
 update():void{for(const [callout,entry]of this.entries){this.mount(callout,entry);if(entry.button){entry.button.hidden=!this.enabled();entry.button.setText(t('tetrad.edit'));}}}
 destroy():void{for(const entry of this.entries.values()){entry.layout?.destroy();entry.button?.remove();}this.entries.clear();}
}
