import type {Component} from 'obsidian';
import type {LawId} from './render/laws';

/** Rows and gaps resolve to the same slot. One overlay owns the entire drag's
 * visual feedback; insertion controls never draw an additional drop marker. */
export function tetradDropTargets(lifecycle:Component,host:HTMLElement,supported:(event:DragEvent)=>boolean,drop:(event:DragEvent,law:LawId,slot:number)=>void):()=>void{
 let marked:HTMLElement|undefined;const win=host.ownerDocument.defaultView as Window&{Element:typeof Element;Node:typeof Node};
 const indicator=host.createDiv({cls:'em-tetrad-drop-indicator',attr:{'aria-hidden':'true'}});indicator.hidden=true;
 const clear=()=>{marked=undefined;indicator.hidden=true;delete indicator.dataset.emSlot;delete indicator.dataset.emLawTarget;};
 const resolve=(event:DragEvent):HTMLElement|undefined=>{
  const element=event.target instanceof win.Element?event.target as HTMLElement:undefined;
  const direct=element?.closest<HTMLElement>('.em-tetrad-gap');if(direct&&host.contains(direct))return direct;
  const wing=element?.closest<HTMLElement>('[data-em-law]');if(!wing||!host.contains(wing))return;
  const row=element?.closest<HTMLElement>('.tetrader-gloss[data-em-entry-index]');
  if(row){
   const box=row.getBoundingClientRect(),before=event.clientY<(box.top+box.bottom)/2,index=Number(row.dataset.emEntryIndex),upper=wing.dataset.emLaw==='enhances'||wing.dataset.emLaw==='reverses',slot=upper?(before?index+1:index):(before?index:index+1);
   return wing.querySelector<HTMLElement>('.em-tetrad-gap[data-em-slot="'+slot+'"]')??undefined;
  }
  let nearest:HTMLElement|undefined,distance=Infinity;
  for(const gap of wing.querySelectorAll<HTMLElement>('.em-tetrad-gap')){const next=Math.abs(event.clientY-gap.getBoundingClientRect().top);if(next<distance){nearest=gap;distance=next;}}
  return nearest;
 };
 lifecycle.registerDomEvent(host,'dragover',event=>{
  if(!supported(event)){clear();return;}const target=resolve(event);if(!target){clear();return;}
  event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect='move';
  const box=target.getBoundingClientRect(),base=host.getBoundingClientRect();marked=target;
  indicator.style.left=box.left-base.left+host.scrollLeft-host.clientLeft+'px';indicator.style.top=box.top-base.top+host.scrollTop-host.clientTop+'px';indicator.style.width=box.width+'px';
  indicator.dataset.emSlot=target.dataset.emSlot;indicator.dataset.emLawTarget=target.dataset.emLawTarget;indicator.hidden=false;
 });
 lifecycle.registerDomEvent(host,'drop',event=>{
  if(!supported(event))return;const target=marked??resolve(event);if(!target)return;
  event.preventDefault();event.stopPropagation();clear();drop(event,target.dataset.emLawTarget as LawId,Number(target.dataset.emSlot));
 });
 lifecycle.registerDomEvent(host,'dragleave',event=>{
  if(event.relatedTarget instanceof win.Node&&host.contains(event.relatedTarget))return;
  const box=host.getBoundingClientRect();if(event.clientX<=box.left||event.clientX>=box.right||event.clientY<=box.top||event.clientY>=box.bottom)clear();
 });
 lifecycle.register(()=>{clear();indicator.remove();});return clear;
}
