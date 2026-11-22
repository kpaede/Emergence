import {Component,type App,type TFile} from 'obsidian';
import {EditorState,StateEffect,Prec} from '@codemirror/state';
import {EditorView,keymap} from '@codemirror/view';
import {MermaidMarkdownEditor} from '../mermaid/markdown-editor';
import {t} from '../i18n';
import type {CompanionDraft} from './service';

interface InputActions{changed(draft:CompanionDraft):void;save(text:string,asNew:boolean):Promise<void>;close():void;discard():void}
/** One isolated native Markdown editor for the active card, rather than one editor per thought. */
export class ThoughtInput extends Component{
 private markdown?:MermaidMarkdownEditor;private fallback?:HTMLTextAreaElement;private status:HTMLElement;private busy=false;
 constructor(private app:App,readonly host:HTMLElement,readonly draft:CompanionDraft,file:TFile|undefined,private actions:InputActions){
  super();host.addClass('em-companion-input');const editorHost=host.createDiv({cls:'em-companion-inline-editor'});this.status=host.createDiv({cls:'em-error',attr:{role:'status'}});
  const changed=()=>{this.draft.text=this.value;this.actions.changed({...this.draft});this.status.empty();};
  try{
   const editor=this.markdown=this.addChild(new MermaidMarkdownEditor(app,editorHost,draft.text,file,app.scope,()=>{void this.save();},()=>this.actions.close()));
   editor.native.cm.dispatch({effects:StateEffect.appendConfig.of([Prec.highest(keymap.of([{key:'Enter',run:()=>{void this.save();return true;}},{key:'Shift-Enter',run:()=>{void this.save();return true;}}])),EditorState.transactionFilter.of(tr=>tr.docChanged&&tr.newDoc.lines>1?[]:tr),EditorView.updateListener.of(update=>{if(update.docChanged)changed();})])});editor.native.cm.contentDOM.setAttribute('aria-label',t('companion.thoughtText'));
  }catch{editorHost.empty();const input=this.fallback=editorHost.createEl('textarea',{cls:'em-mm-text-input',attr:{'aria-label':t('companion.thoughtText')}});input.value=draft.text;this.registerDomEvent(input,'input',changed);this.registerDomEvent(input,'keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();void this.save();}else if(event.key==='Escape'){event.preventDefault();this.actions.close();}});}
  const paste=host.createDiv({cls:'em-companion-paste'});paste.hidden=true;this.registerDomEvent(editorHost,'paste',event=>{const text=event.clipboardData?.getData('text/plain');if(!text||!/[\r\n]/u.test(text))return;event.preventDefault();event.stopPropagation();paste.empty();paste.hidden=false;paste.createDiv({text:t('companion.pasteHelp')});const join=paste.createEl('button',{text:t('companion.joinPaste')});join.onclick=()=>{this.set(this.value+text.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean).join(' '));paste.hidden=true;};const cancel=paste.createEl('button',{text:t('companion.cancel')});cancel.onclick=()=>{paste.hidden=true;};},{capture:true});
  const tools=host.createDiv({cls:'em-companion-input-actions'});const save=tools.createEl('button',{text:t('companion.saveThought'),cls:'mod-cta'});save.onclick=()=>{void this.save();};if(draft.id){const copy=tools.createEl('button',{text:t('companion.saveAsNew')});copy.onclick=()=>{void this.save(true);};}const close=tools.createEl('button',{text:t('companion.closeDraft')});close.onclick=()=>{if(!this.busy)this.actions.close();};host.createDiv({cls:'em-muted em-companion-input-help',text:t('companion.inputHelp')});
  this.registerDomEvent(host,'click',event=>event.stopPropagation());this.registerDomEvent(host,'keydown',event=>event.stopPropagation());
 }
 get value():string{return this.markdown?.value??this.fallback?.value??this.draft.text;}
 set(value:string):void{if(this.markdown)this.markdown.set(value);else if(this.fallback)this.fallback.value=value;this.draft.text=value;this.actions.changed({...this.draft});}
 focus():void{if(this.markdown)this.markdown.focus();else this.fallback?.focus();}
 private async save(asNew=false):Promise<void>{if(this.busy)return;this.busy=true;try{await this.actions.save(this.value,asNew);this.actions.close();}catch(error){this.status.setText(String(error));}finally{this.busy=false;}}
}
