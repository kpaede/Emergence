import {EditorState,type TransactionSpec} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import type {App,TFile,Scope} from 'obsidian';
import type {EmbeddedMarkdownKeys} from '../../src/mermaid/markdown-editor';
/** Component lifecycle and original-view UI boundary for the reader tests. */
export class TestComponent {
 private callbacks:(()=>void)[]=[];private componentChildren:TestComponent[]=[];
 register(callback:()=>void):void{this.callbacks.push(callback);}
 registerEvent():void{/* Vault event callbacks belong to the fixture. */}
 registerDomEvent(element:EventTarget,type:string,callback:EventListener,options?:boolean|AddEventListenerOptions):void{element.addEventListener(type,callback,options);this.register(()=>element.removeEventListener(type,callback,options));}
 addChild<T extends TestComponent>(child:T):T{this.componentChildren.push(child);return child;}
 removeChild<T extends TestComponent>(child:T):T{child.unload();this.componentChildren=this.componentChildren.filter(item=>item!==child);return child;}
 unload():void{for(const child of this.componentChildren.splice(0))child.unload();for(const callback of this.callbacks.splice(0))callback();}
}
export class TestModal extends TestComponent {
 contentEl=document.body.createDiv();modalEl=this.contentEl;setTitle():void{}setPlaceholder():void{}onOpen():void{}onClose():void{}open():void{this.onOpen();}close():void{this.onClose();this.contentEl.remove();}
}

/** A test boundary only. Native completion and parsing run in the Obsidian checks. */
export class TestMarkdownEditor extends TestComponent {
 readonly native:{cm:EditorView;editor:{getValue():string;setValue(value:string):void}};
 private input:HTMLTextAreaElement;
 constructor(_app:App,host:HTMLElement,value:string,_file:TFile|undefined,_scope:Scope,submit:()=>void,cancel:()=>void,keys?:EmbeddedMarkdownKeys){
  super();const input=this.input=host.createEl('textarea');input.value=value;
  const state=()=>EditorState.create({doc:input.value,selection:{anchor:input.selectionStart,head:input.selectionEnd}}),cm={get state(){return state();},contentDOM:input,dispatch(spec:TransactionSpec){const next=state().update(spec).state;input.value=next.doc.toString();input.setSelectionRange(next.selection.main.anchor,next.selection.main.head);},focus:()=>input.focus()} as unknown as EditorView;
  this.native={cm,editor:{getValue:()=>input.value,setValue:value=>{input.value=value;input.setSelectionRange(value.length,value.length);}}};
  this.registerDomEvent(input,'keydown',event=>{const key=event as KeyboardEvent;if(key.key==='Escape'){if(keys?.onEscape?keys.onEscape():(cancel(),true))event.preventDefault();}else if(key.key==='Enter'){if(keys?keys.onEnter(cm,key.metaKey||key.ctrlKey,key.shiftKey):(submit(),true))event.preventDefault();}});
  this.registerDomEvent(input,'blur',()=>keys?.onBlur?.());if(keys?.selectAll)input.select();
 }
 get value():string{return this.input.value;}
 focus():void{this.input.focus();}
}
