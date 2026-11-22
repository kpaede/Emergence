import {Component,type App,type TFile} from 'obsidian';
import {EditorView} from '@codemirror/view';
import {EditorState,StateEffect} from '@codemirror/state';
import {MermaidMarkdownEditor} from '../mermaid/markdown-editor';
import {cursorIsInMarkdownList,waitForListContext} from './reader-list-context';
import {t} from '../i18n';
import {iconButton,relabelIcon} from '../ui/panel';

interface SuggestWorkspace {editorSuggest?:{currentSuggest?:{context?:{editor?:unknown};close?():void}}}
export interface ReaderEditOptions {singleLine?:boolean;adding?:boolean;remove?():void}
/** EOME's node interaction rules around the original Obsidian Markdown editor. */
export class ReaderEditor extends Component {
 private markdown:MermaidMarkdownEditor;private pending?:Promise<void>;private disposed=false;private parsing=false;private blurTimer?:number;private status:HTMLElement;
 constructor(private app:App,readonly host:HTMLElement,value:string,file:TFile|undefined,private save:(text:string,returnFocus:boolean)=>Promise<void>,private cancel:()=>void,private options:ReaderEditOptions={}){
  super();host.addClass('em-reader-editor');const surface=host.createDiv({cls:'em-reader-editor-surface'});this.status=host.createDiv({cls:'em-error',attr:{role:'status'}});
  this.markdown=this.addChild(new MermaidMarkdownEditor(app,surface,value,file,app.scope,()=>{void this.commit();},()=>{if(!this.pending&&!this.completing())this.cancel();},{
   onEnter:(view,mod,shift)=>this.enter(view,mod,shift),onBlur:()=>this.blurred(),onEscape:()=>this.escape(),onDelete:()=>{if(!this.pending)this.options.remove?.();},selectAll:true,inline:true,
  }));
  const actions=host.createDiv({cls:'em-reader-editor-actions'}),apply=iconButton(actions,'check',t(options.adding?'companion.addSibling':'companion.saveThought'),()=>{void this.commit();}),close=iconButton(actions,'x',t('companion.cancel'),()=>{if(!this.pending)this.cancel();});
  this.refreshLanguage();
  // Clicking our buttons must not trigger blur-save before Cancel is handled.
  for(const button of [apply,close])this.registerDomEvent(button,'mousedown',event=>event.preventDefault());
  this.registerDomEvent(host,'keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing&&this.escape())event.preventDefault();event.stopPropagation();});this.register(()=>{this.disposed=true;if(this.blurTimer)window.clearTimeout(this.blurTimer);host.remove();});
 }
 get value():string{return this.markdown.value;}
 refreshLanguage():void{this.markdown.native.cm.contentDOM.setAttribute('aria-label',t('companion.thoughtText'));this.host.querySelector('.em-reader-editor-surface')?.setAttribute('title',t(this.options.singleLine&&this.markdown.native.cm.state.doc.lines===1?'companion.readerEditSingleHelp':'companion.readerEditHelp'));const buttons=this.host.querySelectorAll<HTMLButtonElement>('.em-reader-editor-actions button');if(buttons[0])relabelIcon(buttons[0],t(this.options.adding?'companion.addSibling':'companion.saveThought'));if(buttons[1])relabelIcon(buttons[1],t('companion.cancel'));}
 focus():void{this.markdown.focus();}
 private completing():boolean{const suggest=(this.app.workspace as SuggestWorkspace).editorSuggest?.currentSuggest;return !!suggest&&suggest.context?.editor===this.markdown?.native.editor;}
 private escape():boolean{
  if(this.disposed||this.pending)return true;
  if(this.completing()){const suggest=(this.app.workspace as SuggestWorkspace).editorSuggest?.currentSuggest;if(!suggest?.close)return false;suggest.close();return true;}
  this.cancel();return true;
 }
 private enter(view:EditorView,mod:boolean,shift:boolean):boolean{
  if(this.disposed||this.pending)return true;if(!mod&&this.completing())return false;
  if(this.options.singleLine&&view.state.doc.lines===1){void this.commit();return true;}
  if(shift&&!mod){view.dispatch(view.state.replaceSelection('\n'));return true;}
  if(!mod){
   const context=cursorIsInMarkdownList(view.state);if(context===true)return false;
   if(context===null){
    if(!this.parsing){this.parsing=true;void waitForListContext(()=>view.state,()=>!this.disposed&&!this.pending&&this.host.isConnected).then(inList=>{this.parsing=false;if(inList===undefined||this.disposed)return;if(inList)view.contentDOM.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true,cancelable:true}));else void this.commit();}).catch(error=>{this.parsing=false;this.status.setText(error instanceof Error?error.message:t('companion.readerParsing'));});}
    return true;
   }
  }
  void this.commit();return true;
 }
 private blurred():void{
  if(this.disposed||this.pending)return;if(this.blurTimer)window.clearTimeout(this.blurTimer);
  this.blurTimer=window.setTimeout(()=>{this.blurTimer=undefined;if(this.disposed||this.pending||this.host.contains(this.host.ownerDocument.activeElement)||this.completing())return;void this.commit(false);},0);
 }
 commit(returnFocus=true):Promise<void>{
  if(this.pending)return this.pending;if(this.disposed)return Promise.resolve();const text=this.value;this.host.setAttribute('aria-busy','true');for(const button of this.host.querySelectorAll('button'))button.disabled=true;
  this.markdown.native.cm.dispatch({effects:StateEffect.appendConfig.of([EditorState.readOnly.of(true),EditorView.editable.of(false)])});
  this.pending=this.save(text,returnFocus).finally(()=>{this.pending=undefined;this.host.removeAttribute('aria-busy');});return this.pending;
 }
}
