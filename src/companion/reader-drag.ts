import {Component} from 'obsidian';
import {t} from '../i18n';
import {selectionRoots,type ThoughtIndex} from './board-model';
import {COMPANION_DRAG,dragOperations,type CompanionDrag} from './drag';
import {newId,type CompanionDocument,type Thought} from './model';
import type {Placement,ThoughtOperation} from './thoughts';
import {validReaderDrop} from './reader-model';
import {readerSiblingSlot,type ReaderSlot} from './reader-slots';

interface Context {path:string;document?:CompanionDocument;section:string;parent?:string;index:ThoughtIndex;selected:Set<string>;blocked:boolean}
interface DropTarget extends ReaderSlot{line:boolean}
/** Shared sibling boundaries and explicit hierarchy targets. All writes use the common engine. */
export class ReaderDrag extends Component {
 private cache=new Map<string,boolean>();private cachedDocument?:CompanionDocument;private current?:CompanionDrag;private hover?:number;private hoverId='';private frame?:number;private speed=0;private pointerY=0;
 private feedback?:DropTarget;private line:HTMLElement;
 constructor(private host:HTMLElement,private list:HTMLElement,private context:()=>Context,private navigate:(id:string)=>void,private apply:(operations:ThoughtOperation[],id?:string)=>Promise<void>){
  super();this.line=list.createDiv({cls:'em-reader-drop-line',attr:{'aria-hidden':'true'}});this.line.hidden=true;
  this.registerDomEvent(host.ownerDocument,'dragend',()=>this.end());this.registerDomEvent(host.ownerDocument,'drop',()=>this.end());this.register(()=>{this.end();this.line.remove();});
  this.registerDomEvent(list,'dragover',event=>{if(!this.supported(event)||!this.atEnd(event))return;this.clearHover();const target=this.endTarget();if(this.accept(target))this.over(event,target);});
  this.registerDomEvent(list,'dragleave',event=>{if(!list.contains(event.relatedTarget as Node|null))this.speed=0;});
  this.registerDomEvent(host,'dragleave',event=>{if(host.contains(event.relatedTarget as Node|null))return;const box=host.getBoundingClientRect();if(event.clientX<=box.left||event.clientX>=box.right||event.clientY<=box.top||event.clientY>=box.bottom)this.clearFeedback();});
  this.registerDomEvent(list,'scroll',()=>{if(this.feedback?.line)this.paintLine(this.feedback);},{passive:true});
  this.registerDomEvent(list,'drop',event=>{if(this.supported(event)&&this.atEnd(event))this.drop(event,this.feedback??this.endTarget());});
 }
 data(id:string):CompanionDrag|undefined{
  const {path,index,selected,blocked}=this.context();if(blocked)return;const node=index.byId.get(id);if(!node)return;const selection=selected.has(id)?selected:new Set([id]);return {path,id,section:node.section,parent:node.parent,nodes:selectionRoots(index,selection).map(node=>({id:node.id,section:node.section,parent:node.parent}))};
 }
 valid(data:CompanionDrag,target:string|undefined,placement:Placement):boolean{const {document,path,section}=this.context();if(!document)return false;if(this.cachedDocument!==document){this.cache.clear();this.cachedDocument=document;}const key=JSON.stringify([data,section,target,placement]);let valid=this.cache.get(key);if(valid===undefined){valid=validReaderDrop(document,path,data,section,target,placement);this.cache.set(key,valid);}return valid;}
 move(data:CompanionDrag,target:string|undefined,placement:Placement):Promise<void>{const context=this.context();if(!this.valid(data,target,placement))return Promise.resolve();return this.apply(dragOperations(data,context.section,target,placement),data.id);}
 source(lifecycle:Component,grip:HTMLElement,node:Thought):void{
  grip.draggable=true;lifecycle.registerDomEvent(grip,'dragstart',event=>{const data=this.data(node.id);if(!data){event.preventDefault();return;}this.current=data;this.host.addClass('is-dragging');event.dataTransfer?.setData(COMPANION_DRAG,JSON.stringify(data));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';event.stopPropagation();});
 }
 slot(lifecycle:Component,slot:ReaderSlot):void{
  const target:DropTarget={...slot,line:true};
  lifecycle.registerDomEvent(slot.element,'dragover',event=>{if(!this.supported(event))return;this.clearHover();if(this.accept(target))this.over(event,target);});
  lifecycle.registerDomEvent(slot.element,'drop',event=>{if(this.supported(event))this.drop(event,this.feedback??target);});
 }
 target(lifecycle:Component,element:HTMLElement,id:string,preview=false):void{
  const zones=element.createDiv({cls:'em-reader-drop-zones',attr:{'aria-hidden':'true'}});for(const placement of ['before','after','first','last'] as const){const zone=zones.createSpan({text:t(`companion.reader${placement[0]!.toUpperCase()+placement.slice(1)}` as 'companion.readerBefore')});zone.dataset.readerPlacement=placement;}
  const resolve=(event:DragEvent):DropTarget=>{
   const explicit=(event.target as HTMLElement).closest<HTMLElement>('[data-reader-placement]')?.dataset.readerPlacement as Placement|undefined,box=element.getBoundingClientRect(),y=(event.clientY-box.top)/box.height,placement=explicit??(y<.2?'before':y>.8?'after':event.clientX<box.left+box.width/2?'first':'last');
   const slot=!preview?readerSiblingSlot(element,placement):undefined;return slot?{...slot,line:true}:{element,target:id,placement,line:false};
  };
  lifecycle.registerDomEvent(element,'dragover',event=>{
   if(!this.supported(event))return;const target=resolve(event);if(!this.accept(target)){this.clearHover();return;}this.over(event,target);
   if(preview&&this.current&&this.hoverId!==id){this.clearHover();this.hoverId=id;this.hover=window.setTimeout(()=>{this.hover=undefined;this.hoverId='';this.navigate(id);},650);}else if(!preview)this.clearHover();
  });
  lifecycle.registerDomEvent(element,'dragleave',event=>{if(!element.contains(event.relatedTarget as Node|null))this.clearHover();});
  lifecycle.registerDomEvent(element,'drop',event=>{if(this.supported(event))this.drop(event,this.feedback??resolve(event));});
 }
 clearFeedback():void{if(this.feedback&&!this.feedback.line)delete this.feedback.element.dataset.readerDrop;this.feedback=undefined;this.line.hidden=true;delete this.line.dataset.readerDropTarget;delete this.line.dataset.readerDropPlacement;}
 private canonical(target:DropTarget,data=this.current):DropTarget{
  if(!target.line||!data||!target.target)return target;const moved=new Set((data.nodes??[data]).map(node=>node.id));if(!moved.has(target.target))return target;
  const {index,parent}=this.context(),lower=index.byId.get(target.element.dataset.readerBefore??''),peers=index.children.get(lower?.parent??'')??[],at=peers.findIndex(node=>node.id===lower?.id),next=peers.slice(at<0?peers.length:at).find(node=>!moved.has(node.id));
  return {...target,target:next?.id??parent,placement:next?'before':'last'};
 }
 private accept(target:DropTarget):boolean{target=this.canonical(target);if(this.current&&!this.valid(this.current,target.target,target.placement)){this.clearFeedback();return false;}return true;}
 private over(event:DragEvent,target:DropTarget):void{
  target=this.canonical(target);event.preventDefault();event.stopPropagation();if(event.dataTransfer)event.dataTransfer.dropEffect=this.current?'move':'copy';this.host.addClass('is-dragging');this.clearFeedback();this.feedback=target;
  if(target.line)this.paintLine(target);else target.element.dataset.readerDrop=target.placement;
  this.pointerY=event.clientY;const box=this.list.getBoundingClientRect();this.speed=event.clientY<box.top+36?-10:event.clientY>box.bottom-36?10:0;if(this.speed&&!this.frame)this.autoscroll();
 }
 private paintLine(target:DropTarget):void{
  if(this.line.parentElement!==this.list)this.list.append(this.line);
  const base=this.list.getBoundingClientRect(),box=target.element.getBoundingClientRect(),fallback=target.element===this.list,last=this.list.querySelectorAll<HTMLElement>('.em-reader-node').item(this.list.querySelectorAll('.em-reader-node').length-1),top=fallback?(last?.getBoundingClientRect().bottom??base.top+12)+4:box.top;
  this.line.style.top=top-base.top+this.list.scrollTop-this.list.clientTop+'px';this.line.style.left=fallback?'8px':box.left-base.left+this.list.scrollLeft-this.list.clientLeft+'px';this.line.style.width=(fallback?this.list.clientWidth-16:box.width)+'px';
  this.line.dataset.readerDropTarget=target.target??'';this.line.dataset.readerDropPlacement=target.placement;this.line.hidden=false;
 }
 private drop(event:DragEvent,target:DropTarget):void{
  event.preventDefault();event.stopPropagation();try{const raw=event.dataTransfer?.getData(COMPANION_DRAG),data=raw?JSON.parse(raw) as CompanionDrag:this.current;target=this.canonical(target,data);
   if(data)void this.move(data,target.target,target.placement);else{const text=event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text/uri-list');if(text){const id=newId();void this.apply([{kind:'add',section:this.context().section,target:target.target,placement:target.placement,text,id}],id);}}
  }catch{/* Malformed foreign payloads never reach the operation engine. */}this.end();
 }
 private endTarget():DropTarget{
  const slot=[...this.list.querySelectorAll<HTMLElement>('.em-reader-slot')].at(-1);
  return {element:slot??this.list,target:this.context().parent,placement:'last',line:true};
 }
 private supported(event:DragEvent):boolean{return !this.context().blocked&&!!event.dataTransfer?.types.some(type=>[COMPANION_DRAG,'text/plain','text/uri-list'].includes(type));}
 private atEnd(event:DragEvent):boolean{if((event.target as HTMLElement).closest('.em-reader-node,.em-reader-slot'))return false;const rows=this.list.querySelectorAll<HTMLElement>('.em-reader-node'),last=rows.item(rows.length-1);return !last||event.clientY>=last.getBoundingClientRect().bottom;}
 private clearHover():void{if(this.hover)window.clearTimeout(this.hover);this.hover=undefined;this.hoverId='';}
 private autoscroll():void{this.frame=window.requestAnimationFrame(()=>{this.frame=undefined;if(!this.speed)return;const box=this.list.getBoundingClientRect();if(this.pointerY>=box.top-10&&this.pointerY<=box.bottom+10)this.list.scrollTop+=this.speed;if(this.speed)this.autoscroll();});}
 private end():void{this.clearHover();this.clearFeedback();this.current=undefined;this.cache.clear();this.speed=0;if(this.frame)window.cancelAnimationFrame(this.frame);this.frame=undefined;this.host.removeClass('is-dragging');}
}
