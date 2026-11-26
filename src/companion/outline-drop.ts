import {Component} from 'obsidian';
import {newId} from './model';
import {COMPANION_DRAG,dragOperations,type CompanionDrag} from './drag';
import type {ThoughtOperation} from './thoughts';

export interface OutlineDropActions{
 apply(operations:ThoughtOperation[],path:string):void|Promise<void>;
 text(event:DragEvent,destination:string):string|undefined;
 native(event:DragEvent):CompanionDrag|undefined;
 focus(row:HTMLElement):void;
 error(reason:unknown):void;
 prepare?(section:string):void;
}
/** A drop is acknowledged immediately; entries change only after the ordinary durable save. */
export class OutlineDrop extends Component{
 private hovered?:HTMLElement;private pending=new Map<string,{path:string;section:string;count:number}>();private marked=new Set<HTMLElement>();private tasks=new Set<Promise<void>>();
 constructor(private host:HTMLElement,private path:()=>string,private rows:Map<string,HTMLElement>,private actions:OutlineDropActions){super();this.registerDomEvent(host.ownerDocument,'dragend',()=>this.clearHover());this.register(()=>{this.clearHover();this.pending.clear();this.refresh();});}
 bind(lifecycle:Component,row:HTMLElement,section:string,path:string,destination:string):void{
  for(const type of ['dragenter','dragover'] as const)lifecycle.registerDomEvent(row,type,event=>{if(!this.supported(event))return;event.preventDefault();event.stopPropagation();if(this.hovered!==row){this.clearHover();this.hovered=row;row.addClass('is-being-dragged-over');this.actions.prepare?.(section);}if(event.dataTransfer)event.dataTransfer.dropEffect=event.dataTransfer.types.some(type=>[COMPANION_DRAG,'text/mindmap-line'].includes(type))?'move':'copy';});
  lifecycle.registerDomEvent(row,'dragleave',event=>{if(!row.contains(event.relatedTarget as Node|null)&&this.hovered===row)this.clearHover();});
  lifecycle.registerDomEvent(row,'drop',event=>{
   if(!this.supported(event))return;event.preventDefault();event.stopPropagation();this.clearHover();let operations:ThoughtOperation[]=[];
   if(event.dataTransfer?.types.includes('text/mindmap-line')){const data=this.actions.native(event);if(data?.path===path)operations=dragOperations(data,section,undefined,'last');}
   else if(event.dataTransfer?.types.includes(COMPANION_DRAG)){try{const data=JSON.parse(event.dataTransfer.getData(COMPANION_DRAG)) as CompanionDrag|null;if(data?.path===path)operations=dragOperations(data,section,undefined,'last');}catch{/* Internal data never becomes a literal text entry. */}}
   else{const text=this.actions.text(event,destination);if(text?.trim())operations=[{kind:'add',section,placement:'last',text,id:newId()}];}
   if(operations.length){const task=this.submit(row,path,section,operations);this.tasks.add(task);void task.then(()=>this.tasks.delete(task),()=>this.tasks.delete(task));}
  });
 }
 async flush():Promise<void>{while(this.tasks.size)await Promise.all([...this.tasks]);}
 refresh():void{
  for(const row of this.marked){row.removeClass('is-drop-pending');row.removeAttribute('aria-busy');}this.marked.clear();
  for(const entry of this.pending.values())if(entry.path===this.path()){const row=this.rows.get(entry.section);if(row){row.addClass('is-drop-pending');row.setAttribute('aria-busy','true');this.marked.add(row);}}
 }
 clearHover():void{this.hovered?.removeClass('is-being-dragged-over');this.hovered=undefined;}
 private supported(event:DragEvent):boolean{return !!event.dataTransfer?.types.some(type=>[COMPANION_DRAG,'text/mindmap-line','text/plain','text/uri-list'].includes(type));}
 private async submit(row:HTMLElement,path:string,section:string,operations:ThoughtOperation[]):Promise<void>{
  const key=JSON.stringify([path,section]),entry=this.pending.get(key)??{path,section,count:0};entry.count++;this.pending.set(key,entry);this.refresh();this.actions.focus(row);
  try{await this.actions.apply(operations,path);}catch(reason){this.actions.error(reason);}finally{entry.count--;if(!entry.count)this.pending.delete(key);this.refresh();}
 }
}
