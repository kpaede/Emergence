import {dragHandles} from './drag-handles';
import {tetradDropTargets} from './drop-targets';
import {rebaseTetradDrop,type AcceptedTetradEdit} from './drag-rebase';
import {nextTetradTarget} from './navigation';
import {Component,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {nameByVisibleElement} from '../ui/accessibility';
import {iconButton} from '../ui/panel';
import {parseSource,editSection} from './source';
import {tetradEntries,applyTetradEntry,type TetradEntryChange} from './entries';
import type {TetradPattern} from './patterns';
import {LAWS,type LawId} from './render/laws';
import {TetradInlineEditor} from './inline-editor';
import {TetradEditGeometry} from './edit-geometry';

const DRAG='application/x-emergence-tetrad-entry';
interface DragEntry{token:string;law:LawId;index:number;newEntry?:boolean}
export type TetradEditTarget={kind:'title'}|{kind:'core';law:LawId}|{kind:'row';law:LawId;index:number}|{kind:'insert';law:LawId;slot:number};
interface ActiveEdit{editor:TetradInlineEditor;restore:()=>void;target:TetradEditTarget;anchor?:Omit<AcceptedTetradEdit,'source'>;accepted?:boolean}
/** Graph interaction only. All mutations go through the source entry model and note transaction. */
export class TetradGraphEditor extends Component {
 private selected=new Map<LawId,Set<number>>();private anchor?:{law:LawId;index:number};private activeEdit?:ActiveEdit;private operation?:Promise<void>;private alive=true;private dragged?:DragEntry;private scrollFrame?:number;private scrollSpeed=0;private token=String(Date.now())+'-'+Math.random().toString(36).slice(2);
 private pressed=false;private dropping=false;private acceptedEdit?:AcceptedTetradEdit;private clearDrop:()=>void=()=>{};
 constructor(private app:App,private host:HTMLElement,readonly source:string,private pattern:TetradPattern,private file:TFile|undefined,private current:()=>string,private change:(source:string)=>Promise<void>,private selectionChanged:(count:number)=>void,private follow:(target:TetradEditTarget,point?:{x:number;y:number})=>Promise<void>=async()=>{},private reportError?:(error:unknown)=>void,private interactionEnded:()=>void|Promise<void>=()=>{}){
  super();const document=parseSource(source,pattern);
  const title=host.querySelector<HTMLElement>('.callout-title-inner');if(title){title.tabIndex=0;title.setAttribute('aria-description',t('tetrad.editTitle'));this.registerDomEvent(title,'click',event=>{if((event.target as HTMLElement).closest('a,button,.em-tetrad-inline'))return;event.stopPropagation();this.run(()=>this.activate({kind:'title'},{x:event.clientX,y:event.clientY}));});this.registerDomEvent(title,'keydown',event=>{if(event.key==='Enter'&&event.target===title){event.preventDefault();event.stopPropagation();this.run(()=>this.activate({kind:'title'}));}});}

  for(const definition of LAWS){const law=definition.id,section=document.sections.get(law);const wing=host.querySelector<HTMLElement>('[data-em-law='+law+']');if(!wing)continue;const model=tetradEntries(section?.body??''),core=wing.querySelector<HTMLElement>('[data-em-core]');
   if(core){core.tabIndex=0;const caption=core.querySelector('.tetrader-statement');if(caption)nameByVisibleElement(core,caption);this.registerDomEvent(core,'click',event=>{if((event.target as HTMLElement).closest('a,button,.em-tetrad-inline'))return;event.stopPropagation();this.run(()=>this.activate({kind:'core',law},{x:event.clientX,y:event.clientY}));});this.registerDomEvent(core,'keydown',event=>{if(event.target!==core)return;if(event.key==='Enter'){event.preventDefault();event.stopPropagation();this.run(()=>this.editCore(law));}});}
   let glosses=wing.querySelector<HTMLElement>('.tetrader-glosses');if(!glosses)glosses=wing.createDiv({cls:'tetrader-glosses'});
   const rows=[...glosses.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss[data-em-entry-index]')],upper=law==='enhances'||law==='reverses';
   for(const row of rows){const index=Number(row.dataset.emEntryIndex),entry=model.entries.find(item=>item.index===index);if(!entry)continue;row.tabIndex=0;const caption=row.querySelector('p,li,blockquote,pre')??row;nameByVisibleElement(row,caption);row.setAttribute('aria-selected','false');
    this.registerDomEvent(row,'click',event=>{if((event.target as HTMLElement).closest('a,button,.em-tetrad-inline'))return;event.stopPropagation();if(event.metaKey||event.ctrlKey||event.shiftKey){this.select(law,index,event.metaKey||event.ctrlKey,event.shiftKey);row.focus({preventScroll:true});}else this.run(()=>this.activate({kind:'row',law,index},{x:event.clientX,y:event.clientY}));});
    this.registerDomEvent(row,'keydown',event=>{if((event.target as HTMLElement).closest('.em-tetrad-inline'))return;
     if(event.key==='Enter'&&event.target===row){event.preventDefault();event.stopPropagation();this.run(()=>this.editRow(law,index));}else if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();if(!this.count)this.select(law,index,false,false);this.run(()=>this.removeSelected());}
     else if(event.key===' '&&event.target===row){event.preventDefault();event.stopPropagation();this.select(law,index,event.metaKey||event.ctrlKey,event.shiftKey);}
    });
    this.grips(this,row,law,index);
    this.gap(glosses,law,upper?index+1:index,row,upper&&index===model.entries.length-1);
   }
   const last=rows[rows.length-1],slot=last?(upper?Number(last.dataset.emEntryIndex):Number(last.dataset.emEntryIndex)+1):model.entries.length;this.gap(glosses,law,slot,undefined,!upper||!rows.length);
   const placeholder=glosses.querySelector<HTMLElement>('[data-em-placeholder]'),gap=glosses.querySelector<HTMLElement>('.em-tetrad-gap');if(placeholder&&gap){placeholder.tabIndex=0;this.registerDomEvent(placeholder,'click',event=>{if((event.target as HTMLElement).closest('.em-tetrad-inline'))return;event.stopPropagation();this.run(()=>this.addRow(law,slot,gap,placeholder));});this.registerDomEvent(placeholder,'keydown',event=>{if(event.key==='Enter'&&event.target===placeholder){event.preventDefault();event.stopPropagation();this.run(()=>this.addRow(law,slot,gap,placeholder));}});}
  }
  this.clearDrop=tetradDropTargets(this,host,event=>this.supported(event),(event,law,slot)=>{void this.drop(event,law,slot);});
  this.registerDomEvent(host,'keydown',event=>{
   if(event.defaultPrevented||event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   const target=event.target as HTMLElement;if(target.closest('.em-tetrad-inline,a'))return;const entry=target.closest<HTMLElement>('[data-em-core],.tetrader-gloss');if(!entry)return;
   event.preventDefault();event.stopPropagation();const next=nextTetradTarget(host,entry,event.key as 'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown');if(next){next.focus({preventScroll:true});next.scrollIntoView?.({block:'nearest',inline:'nearest'});}
  });
  this.registerDomEvent(host,'dragover',event=>{if(!this.supported(event))return;const bounds=host.getBoundingClientRect();this.scrollSpeed=event.clientY<bounds.top+35?-9:event.clientY>bounds.bottom-35?9:0;if(this.scrollSpeed&&!this.scrollFrame)this.autoscroll();},{capture:true});
  this.registerDomEvent(host.ownerDocument,'dragend',()=>this.endDrag());this.registerDomEvent(host.ownerDocument,'drop',()=>this.endDrag());
  this.registerDomEvent(host.ownerDocument,'pointerup',()=>this.releasePress());this.registerDomEvent(host.ownerDocument,'pointercancel',()=>this.releasePress());
  this.registerDomEvent(host.ownerDocument.defaultView!,'blur',()=>{if(!this.dragged)this.releasePress();});
  this.register(()=>{this.alive=false;this.cancelEdit();this.endDrag();this.selectionChanged(0);});
 }
 get editing():boolean{return !!this.activeEdit&&!this.activeEdit.accepted;}
 get interacting():boolean{return this.pressed||!!this.dragged||this.dropping;}
 get saving():boolean{return !!this.activeEdit?.editor.pending||!!this.operation;}
 get count():number{return [...this.selected.values()].reduce((count,indices)=>count+indices.size,0);}
 async flush():Promise<void>{if(this.operation)await this.operation;if(this.activeEdit&&!this.activeEdit.accepted)await this.activeEdit.editor.commit();}
 private assertCurrent():void{if(this.current()!==this.source)throw new Error(t('tetrad.conflict'));}
 private body(law:LawId):string{return parseSource(this.source,this.pattern).sections.get(law)?.body??'';}
 private apply(source:string,law:LawId,change:TetradEntryChange):string{const body=parseSource(source,this.pattern).sections.get(law)?.body??'';return editSection(source,this.pattern,law,applyTetradEntry(body,{...change,expectedBody:body,corePlaceholder:this.pattern.headings[law]}));}
 private async mutate(build:()=>string,expected=this.source):Promise<void>{
  if(this.operation)return this.operation;const work=Promise.resolve().then(async()=>{if(this.current()!==expected)throw new Error(t('tetrad.conflict'));const next=build();if(next===expected)return;const anchor=this.activeEdit?.anchor;await this.change(next);if(this.interacting&&this.current()===next)this.acceptedEdit={source:next,...anchor};if(this.alive)this.clearSelection();}).finally(()=>{if(this.operation===work)this.operation=undefined;});this.operation=work;void work.catch(()=>{});return work;
 }
 private run(action:()=>Promise<void>):void{void action().catch((error:unknown)=>{if(this.alive&&!this.activeEdit)this.showError(error);});}
 private showError(error:unknown):void{if(this.reportError){this.reportError(error);return;}let errorElement=this.host.querySelector<HTMLElement>(':scope > .em-tetrad-graph-error');if(!errorElement)errorElement=this.host.createDiv({cls:'em-error em-tetrad-graph-error',attr:{role:'alert'}});errorElement.setText(error instanceof Error?error.message:String(error));}
 private select(law:LawId,index:number,toggle:boolean,range:boolean):void{
  if(!toggle&&!range)this.selected.clear();let indices=this.selected.get(law);if(!indices){indices=new Set();this.selected.set(law,indices);}if(range&&this.anchor?.law===law){const from=Math.min(index,this.anchor.index),to=Math.max(index,this.anchor.index);for(const entry of tetradEntries(this.body(law)).glosses)if(entry.index>=from&&entry.index<=to)indices.add(entry.index);}else if(toggle&&indices.has(index))indices.delete(index);else indices.add(index);
  this.anchor={law,index};for(const row of this.host.querySelectorAll<HTMLElement>('.tetrader-gloss[data-em-entry-index]')){const rowLaw=row.closest<HTMLElement>('[data-em-law]')?.dataset.emLaw as LawId,selected=!!this.selected.get(rowLaw)?.has(Number(row.dataset.emEntryIndex));row.classList.toggle('is-selected',selected);row.setAttribute('aria-selected',String(selected));}this.selectionChanged(this.count);
 }
 private clearSelection():void{this.selected.clear();for(const row of this.host.querySelectorAll<HTMLElement>('.tetrader-gloss.is-selected')){row.classList.remove('is-selected');row.setAttribute('aria-selected','false');}this.selectionChanged(0);}
 async removeSelected():Promise<void>{if(!this.count||this.editing)return;const selection=[...this.selected].map(([law,indices])=>({law,indices:[...indices]}));await this.mutate(()=>selection.reduce((source,item)=>this.apply(source,item.law,{kind:'delete',indices:item.indices}),this.source));}
 private gap(parent:HTMLElement,law:LawId,slot:number,before?:HTMLElement,outer=false):void{
  const gap=parent.createDiv({cls:'em-tetrad-gap'});gap.classList.toggle('is-outer',outer);gap.classList.toggle('is-before',!!before);gap.dataset.emSlot=String(slot);gap.dataset.emLawTarget=law;if(before)before.before(gap);
  iconButton(gap,'plus',t(outer?'tetrad.appendEntry':'tetrad.insertEntry'),()=>{this.run(()=>this.addRow(law,slot,gap));});
 }
 private supported(event:DragEvent):boolean{return this.alive&&!this.dropping&&this.dragged?.token===this.token&&!!event.dataTransfer?.types.includes(DRAG);}
 private grips(lifecycle:Component,row:HTMLElement,law:LawId,index:number,newEntry=false):void{
  const select=()=>{if(newEntry)this.clearSelection();else this.select(law,index,false,false);};
  dragHandles(lifecycle,row,select,event=>{
   if(this.operation&&!this.activeEdit){event.preventDefault();this.releasePress();return;}
   select();this.dragged={token:this.token,law,index,...newEntry?{newEntry:true}:{}};event.dataTransfer?.setData(DRAG,JSON.stringify(this.dragged));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';row.addClass('is-dragging');this.host.addClass('is-tetrad-dragging');event.stopPropagation();
  },()=>{this.pressed=true;});
 }
 private async drop(event:DragEvent,law:LawId,slot:number):Promise<void>{
  this.dropping=true;
  try{const raw=event.dataTransfer?.getData(DRAG),drag=raw?JSON.parse(raw) as DragEntry:this.dragged;if(!drag||drag.token!==this.token)return;await this.flush();if(!this.alive)return;const source=this.current(),rebased=rebaseTetradDrop(this.source,source,this.pattern,drag.law,drag.index,law,slot,this.acceptedEdit,drag.newEntry);if(rebased.count!==0)await this.move(drag.law,rebased.index,law,rebased.slot,source,rebased.count);}catch(error){if(this.alive)this.showError(error);}finally{this.dropping=false;this.endDrag();}
 }
 async move(from:LawId,index:number,to:LawId,slot:number,source=this.source,count=1):Promise<void>{await this.mutate(()=>{
  if(from===to&&count===1)return this.apply(source,from,{kind:'move',index,to:slot});
  const model=tetradEntries(parseSource(source,this.pattern).sections.get(from)?.body??''),entries=model.entries.slice(index,index+count);
  if(count<1||entries.length!==count||entries.some(entry=>entry.kind!=='gloss'))throw new Error(t('tetrad.conflict'));
  if(from===to&&slot>=index&&slot<=index+count)return source;
  const removed=this.apply(source,from,{kind:'delete',indices:entries.map(entry=>entry.index)}),at=from===to&&slot>index?slot-count:slot,markdown=entries.map(entry=>entry.markdown).join(source.includes('\r\n')?'\r\n\r\n':'\n\n');
  return this.apply(removed,to,{kind:'insert',at,markdown});
 },source);}
 private autoscroll():void{this.scrollFrame=window.requestAnimationFrame(()=>{this.scrollFrame=undefined;if(this.scrollSpeed){this.host.scrollTop+=this.scrollSpeed;this.autoscroll();}});}
 private releasePress():void{if(!this.pressed)return;this.pressed=false;if(!this.interacting&&this.alive)this.finishInteraction();}
 private finishInteraction():void{
  const active=this.activeEdit,cleanup=()=>{if(this.alive&&!this.interacting&&this.activeEdit===active&&active?.accepted)this.cancelEdit();};
  try{const refresh=this.interactionEnded();if(refresh)void refresh.then(cleanup,error=>{cleanup();if(this.alive)this.showError(error);});else cleanup();}catch(error){cleanup();if(this.alive)this.showError(error);}
 }
 private endDrag():void{this.dragged=undefined;this.pressed=false;this.clearDrop();this.scrollSpeed=0;if(this.scrollFrame)window.cancelAnimationFrame(this.scrollFrame);this.scrollFrame=undefined;this.host.removeClass('is-tetrad-dragging');for(const element of this.host.querySelectorAll<HTMLElement>('.is-dragging'))element.removeClass('is-dragging');if(!this.interacting&&this.alive)this.finishInteraction();}
 get focusTarget():TetradEditTarget|undefined{return this.activeEdit?.editor.restoreFocus?this.activeEdit.target:undefined;}
 focus(target:TetradEditTarget):void{
  const element=target.kind==='title'?this.host.querySelector<HTMLElement>('.callout-title-inner'):target.kind==='core'?this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] [data-em-core]'):target.kind==='row'?this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .tetrader-gloss[data-em-entry-index="'+target.index+'"]')??this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] [data-em-placeholder]')??this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .em-tetrad-gap[data-em-slot="'+target.index+'"] button'):this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .em-tetrad-gap[data-em-slot="'+target.slot+'"] button');element?.focus({preventScroll:true});
 }
 async editCore(law:LawId):Promise<void>{await this.activate({kind:'core',law});}
 async editRow(law:LawId,index:number):Promise<void>{await this.activate({kind:'row',law,index});}
 async activate(target:TetradEditTarget,point?:{x:number;y:number}):Promise<void>{
  if(this.activeEdit){if(JSON.stringify(target)===JSON.stringify(this.activeEdit.target)){this.activeEdit.editor.focus(false,point);return;}await this.flush();}
  if(!this.alive){await this.follow(target,point);return;}if(this.operation)return;this.assertCurrent();
  if(target.kind==='title'){
   const element=this.host.querySelector<HTMLElement>('.callout-title-inner');if(!element)return;
   this.begin(element,parseSource(this.source,this.pattern).title,async value=>{await this.mutate(()=>this.source.replace(/^( {0,3}>\s?\[![^\]]+\][+-]?)[^\r\n]*/u,()=>this.source.match(/^( {0,3}>\s?\[![^\]]+\][+-]?)/u)![1]+' '+value));},target,undefined,point);return;
  }
  const model=tetradEntries(this.body(target.law));
  if(target.kind==='core'){
   const element=this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .tetrader-statement');if(!element)return;const value=model.core?.content??'';
   this.begin(element,value,async value=>{await this.mutate(()=>this.apply(this.source,target.law,{kind:'setCore',markdown:value}));},target,undefined,point);return;
  }
  if(target.kind==='row'){
   const entry=model.glosses.find(item=>item.index===target.index),element=this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .tetrader-gloss[data-em-entry-index="'+target.index+'"]');if(!entry||!element)return;
   this.begin(element,entry.content,async value=>{await this.mutate(()=>this.apply(this.source,target.law,{kind:'edit',index:target.index,markdown:value}));},target,undefined,point);return;
  }
  const gap=this.host.querySelector<HTMLElement>('[data-em-law='+target.law+'] .em-tetrad-gap[data-em-slot="'+target.slot+'"]');if(gap)await this.addRow(target.law,target.slot,gap);
 }
 private async addRow(law:LawId,slot:number,gap:HTMLElement,placeholder?:HTMLElement):Promise<void>{
  if(this.editing){await this.flush();if(!this.alive){await this.follow({kind:'insert',law,slot});return;}}
  if(this.operation||!this.alive)return;this.assertCurrent();
  placeholder??=gap.parentElement!.querySelector<HTMLElement>('[data-em-placeholder]')??undefined;
  const model=tetradEntries(this.body(law)),distance=model.glosses.filter(entry=>entry.index<slot).length,row=placeholder??gap.parentElement!.createDiv({cls:'tetrader-gloss is-new'});row.addClass('is-new');row.style.setProperty('--tetrader-outward',String(distance/Math.max(model.glosses.length,1)));if(!placeholder)gap.before(row);
  const controls=this.addChild(new Component());this.grips(controls,row,law,slot,true);
  const remove=()=>{this.removeChild(controls);if(placeholder)row.removeClass('is-new');else row.remove();};
  try{this.begin(row,placeholder?t('tetrad.glossPlaceholder'):'',async value=>{await this.mutate(()=>this.apply(this.source,law,{kind:'insert',at:slot,markdown:value}));},{kind:'row',law,index:slot+(model.core?0:1)},remove,undefined,{law,at:slot,inserted:true});}catch(error){remove();throw error;}
 }
 private begin(target:HTMLElement,value:string,save:(value:string)=>Promise<void>,targetKey:TetradEditTarget,remove?:()=>void,point?:{x:number;y:number},anchor?:Omit<AcceptedTetradEdit,'source'>):void{
  if(this.operation)return;this.assertCurrent();this.clearSelection();if(!point)target.scrollIntoView?.({block:'nearest',inline:'nearest'});const geometry=new TetradEditGeometry(target,value);target.addClass('is-editing','em-tetrad-edit-target');const inline=target.createDiv({cls:'em-tetrad-edit-overlay'});
  const restore=()=>{geometry.destroy();target.classList.remove('is-editing','em-tetrad-edit-target');if(remove)remove();};
  try{const editor=this.addChild(new TetradInlineEditor(this.app,inline,value,this.file,async next=>{try{if(next!==value&&(!remove||next.trim()))await save(next);if(this.alive){if(this.interacting){this.activeEdit!.accepted=true;this.activeEdit!.editor.holdAccepted();}else this.cancelEdit();}}catch(error){if(this.alive){this.cancelEdit();this.showError(error);}throw error;}},()=>this.cancelEdit(),targetKey.kind==='title',geometry));this.activeEdit={editor,restore,target:targetKey,anchor:anchor??this.editAnchor(targetKey)};editor.focus(value===(targetKey.kind==='core'?this.pattern.headings[targetKey.law]:targetKey.kind==='title'?t('tetrad.subject'):t('tetrad.glossPlaceholder')),point);}
  catch(error){inline.remove();restore();throw error;}
 }
 private editAnchor(target:TetradEditTarget):Omit<AcceptedTetradEdit,'source'>|undefined{
  if(target.kind==='row')return {law:target.law,at:target.index};
  if(target.kind==='core'){const core=tetradEntries(this.body(target.law)).core;return {law:target.law,at:core?.index??0,inserted:!core};}
  return undefined;
 }
 private cancelEdit():void{const active=this.activeEdit;this.activeEdit=undefined;if(active){const focus=this.alive&&active.editor.restoreFocus;this.removeChild(active.editor);active.restore();if(focus)this.focus(active.target);}}
}
