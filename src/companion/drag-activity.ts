import {Component} from 'obsidian';

/** Keep the current surface stable during local and externally started native drags. */
export class CompanionDragActivity extends Component{
 private active=false;private local=false;
 constructor(host:HTMLElement,private enabled:()=>boolean,private changed:(active:boolean)=>void){
  super();const doc=host.ownerDocument;
  this.registerDomEvent(doc,'dragstart',()=>{if(this.enabled()){this.local=true;this.set(true);}},{capture:true});
  this.registerDomEvent(host,'dragenter',()=>{if(this.enabled())this.set(true);},{capture:true});
  this.registerDomEvent(host,'dragover',()=>{if(this.enabled())this.set(true);},{capture:true});
  this.registerDomEvent(host,'dragleave',event=>{if(!this.local&&!host.contains(event.relatedTarget as Node|null))this.set(false);});
  const finish=()=>{this.local=false;this.set(false);};
  this.registerDomEvent(doc,'dragend',finish,{capture:true});this.registerDomEvent(doc,'drop',finish,{capture:true});
  this.register(finish);
 }
 private set(active:boolean):void{if(this.active===active)return;this.active=active;this.changed(active);}
}
