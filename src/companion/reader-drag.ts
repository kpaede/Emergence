import {Component} from 'obsidian';
import {t} from '../i18n';
import {selectionRoots,type ThoughtIndex} from './board-model';
import {COMPANION_DRAG,dragOperations,type CompanionDrag} from './drag';
import {newId,type CompanionDocument,type Thought} from './model';
import type {Placement,ThoughtOperation} from './thoughts';
import {validReaderDrop} from './reader-model';

interface Context {path:string;document?:CompanionDocument;section:string;parent?:string;index:ThoughtIndex;selected:Set<string>;blocked:boolean}
/** Drag UI only: the common operation engine validates and executes every move. */
export class ReaderDrag extends Component {
 private cache=new Map<string,boolean>();private cachedDocument?:CompanionDocument;private current?:CompanionDrag;private hover?:number;private hoverId='';private frame?:number;private speed=0;private pointerY=0;
 constructor(private host:HTMLElement,private list:HTMLElement,private context:()=>Context,private navigate:(id:string)=>void,private apply:(operations:ThoughtOperation[],id?:string)=>Promise<void>){
  super();this.registerDomEvent(host.ownerDocument,'dragend',()=>this.end());this.registerDomEvent(host.ownerDocument,'drop',()=>this.end());this.register(()=>this.end());
  this.registerDomEvent(list,'dragover',event=>{this.pointerY=event.clientY;const box=list.getBoundingClientRect();this.speed=event.clientY<box.top+36?-10:event.clientY>box.bottom-36?10:0;if(this.speed&&!this.frame)this.autoscroll();const valid=this.supported(event)&&this.atEnd(event)&&(!this.current||this.valid(this.current,this.context().parent,'last'));this.list.toggleClass('is-append-target',valid);if(valid){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect=this.current?'move':'copy';}});
  this.registerDomEvent(list,'dragleave',event=>{if(!list.contains(event.relatedTarget as Node|null)){this.speed=0;this.list.removeClass('is-append-target');}});
  this.registerDomEvent(list,'drop',event=>{if(!this.supported(event)||!this.atEnd(event))return;event.preventDefault();event.stopPropagation();try{const raw=event.dataTransfer?.getData(COMPANION_DRAG),data=raw?JSON.parse(raw) as CompanionDrag:this.current,parent=this.context().parent;if(data)void this.move(data,parent,'last');else{const text=event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text/uri-list');if(text){const id=newId();void this.apply([{kind:'add',section:this.context().section,target:parent,placement:'last',text,id}],id);}}}catch{/* Malformed drag data never reaches the operation engine. */}this.end();});
 }
 data(id:string):CompanionDrag|undefined{
  const {path,index,selected,blocked}=this.context();if(blocked)return;const node=index.byId.get(id);if(!node)return;const selection=selected.has(id)?selected:new Set([id]);return {path,id,section:node.section,parent:node.parent,nodes:selectionRoots(index,selection).map(node=>({id:node.id,section:node.section,parent:node.parent}))};
 }
 valid(data:CompanionDrag,target:string|undefined,placement:Placement):boolean{const {document,path,section}=this.context();if(!document)return false;if(this.cachedDocument!==document){this.cache.clear();this.cachedDocument=document;}const key=JSON.stringify([data,section,target,placement]);let valid=this.cache.get(key);if(valid===undefined){valid=validReaderDrop(document,path,data,section,target,placement);this.cache.set(key,valid);}return valid;}
 move(data:CompanionDrag,target:string|undefined,placement:Placement):Promise<void>{const context=this.context();if(!this.valid(data,target,placement))return Promise.resolve();return this.apply(dragOperations(data,context.section,target,placement),data.id);}
 source(lifecycle:Component,grip:HTMLElement,node:Thought):void{
  grip.draggable=true;lifecycle.registerDomEvent(grip,'dragstart',event=>{const data=this.data(node.id);if(!data)return;this.current=data;this.host.addClass('is-dragging');event.dataTransfer?.setData(COMPANION_DRAG,JSON.stringify(data));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';event.stopPropagation();});
 }
 target(lifecycle:Component,element:HTMLElement,id:string,preview=false):void{
  const zones=element.createDiv({cls:'em-reader-drop-zones',attr:{'aria-hidden':'true'}});for(const placement of ['before','after','first','last'] as const){const zone=zones.createSpan({text:t(`companion.reader${placement[0]!.toUpperCase()+placement.slice(1)}` as 'companion.readerBefore')});zone.dataset.readerPlacement=placement;}
  const placement=(event:DragEvent):Placement=>{const explicit=(event.target as HTMLElement).closest<HTMLElement>('[data-reader-placement]')?.dataset.readerPlacement as Placement|undefined;if(explicit)return explicit;const box=element.getBoundingClientRect(),y=(event.clientY-box.top)/box.height;return y<.2?'before':y>.8?'after':event.clientX<box.left+box.width/2?'first':'last';};
  lifecycle.registerDomEvent(element,'dragover',event=>{
   if(!this.supported(event))return;this.list.removeClass('is-append-target');const data=this.current,position=placement(event);if(data&&!this.valid(data,id,position)){delete element.dataset.readerDrop;return;}event.preventDefault();event.stopPropagation();this.host.addClass('is-dragging');element.dataset.readerDrop=position;this.pointerY=event.clientY;const box=this.list.getBoundingClientRect();this.speed=event.clientY<box.top+36?-10:event.clientY>box.bottom-36?10:0;if(this.speed&&!this.frame)this.autoscroll();
   if(preview&&data&&this.hoverId!==id){this.clearHover();this.hoverId=id;this.hover=window.setTimeout(()=>{this.hover=undefined;this.hoverId='';this.navigate(id);},650);}
  });
  lifecycle.registerDomEvent(element,'dragleave',event=>{if(!element.contains(event.relatedTarget as Node|null)){delete element.dataset.readerDrop;this.clearHover();}});
  lifecycle.registerDomEvent(element,'drop',event=>{if(!this.supported(event))return;event.preventDefault();event.stopPropagation();const position=placement(event);try{const raw=event.dataTransfer?.getData(COMPANION_DRAG),data=raw?JSON.parse(raw) as CompanionDrag:this.current;if(data)void this.move(data,id,position);else{const text=event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text/uri-list');if(text){const {section}=this.context(),created=newId();void this.apply([{kind:'add',section,target:id,placement:position,text,id:created}],created);}}}catch{/* Invalid foreign drag payloads never reach the file service. */}this.end();});
 }
 private supported(event:DragEvent):boolean{return !this.context().blocked&&!!event.dataTransfer?.types.some(type=>[COMPANION_DRAG,'text/plain','text/uri-list'].includes(type));}
 private atEnd(event:DragEvent):boolean{if((event.target as HTMLElement).closest('.em-reader-node'))return false;const last=this.list.querySelectorAll<HTMLElement>('.em-reader-node').item(this.list.querySelectorAll('.em-reader-node').length-1);return !last||event.clientY>=last.getBoundingClientRect().bottom;}
 private clearHover():void{if(this.hover)window.clearTimeout(this.hover);this.hover=undefined;this.hoverId='';}
 private autoscroll():void{this.frame=window.requestAnimationFrame(()=>{this.frame=undefined;if(!this.speed)return;const box=this.list.getBoundingClientRect();if(this.pointerY>=box.top-10&&this.pointerY<=box.bottom+10)this.list.scrollTop+=this.speed;if(this.speed)this.autoscroll();});}
 private end():void{this.clearHover();this.current=undefined;this.cache.clear();this.speed=0;if(this.frame)window.cancelAnimationFrame(this.frame);this.frame=undefined;this.host.removeClass('is-dragging');this.list.removeClass('is-append-target');for(const element of this.host.querySelectorAll<HTMLElement>('[data-reader-drop]'))delete element.dataset.readerDrop;}
}
