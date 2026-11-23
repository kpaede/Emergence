import type {Component} from 'obsidian';
import {t} from '../i18n';
import {iconButton} from '../ui/panel';
import type {Thought} from './model';
import type {Placement} from './thoughts';

export interface ReaderSlot{element:HTMLElement;target?:string;placement:Placement}
/** A visible boundary has one canonical anchor, shared by add and drop. */
export function readerSlots(lifecycle:Component,list:HTMLElement,nodes:Thought[],add:(target:string|undefined,placement:Placement)=>void,drop:(slot:ReaderSlot)=>void,parent?:string):void{
 if(!nodes.length)return;
 const rows=[...list.querySelectorAll<HTMLElement>(':scope > .em-reader-node')];
 for(let index=0;index<=nodes.length;index++){
  const next=nodes[index],previous=nodes[index-1],element=list.createDiv({cls:'em-reader-slot',attr:{role:'presentation'}});
  if(next)element.dataset.readerBefore=next.id;if(previous)element.dataset.readerAfter=previous.id;
  const slot:ReaderSlot={element,target:next?.id??parent,placement:next?'before':'last'};
  element.dataset.readerSlotTarget=slot.target??'';element.dataset.readerSlotPlacement=slot.placement;
  if(rows[index])rows[index]!.before(element);
  const button=iconButton(element,'plus',t('companion.addSibling'),()=>add(slot.target,slot.placement),false);button.tabIndex=-1;
  drop(slot);lifecycle.register(()=>element.remove());
 }
}
export function readerSiblingSlot(element:HTMLElement,placement:Placement):ReaderSlot|undefined{
 const neighbor=placement==='before'?element.previousElementSibling:placement==='after'?element.nextElementSibling:undefined;
 if(!neighbor?.classList.contains('em-reader-slot'))return undefined;
 const slot=neighbor as HTMLElement;
 return {element:slot,target:slot.dataset.readerSlotTarget||undefined,placement:slot.dataset.readerSlotPlacement as Placement};
}
