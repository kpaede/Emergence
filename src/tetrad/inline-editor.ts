import {Component,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {MermaidMarkdownEditor} from '../mermaid/markdown-editor';
import type {TetradEditGeometry} from './edit-geometry';

/** Markdown at the text's own position, accepted only after the write succeeds. */
export class TetradInlineEditor extends Component {
 readonly markdown:MermaidMarkdownEditor;
 private status:HTMLElement;
 private busy?:Promise<void>;
 private disposed=false;
 private accepted=false;
 private blurTimer?:number;
 private focusedSubmit=false;
 constructor(private app:App,readonly host:HTMLElement,value:string,file:TFile|undefined,private save:(value:string)=>Promise<void>,private cancel:()=>void,private singleLine=false,geometry?:TetradEditGeometry){
  super();
  if(singleLine&&/[\r\n]/u.test(value))throw new Error(t('tetrad.titleSingleLine'));
  host.addClass('em-tetrad-inline');host.classList.toggle('is-single-line',singleLine);
  const surface=host.createDiv({cls:'em-tetrad-inline-surface'});
  this.status=host.createDiv({cls:'em-error',attr:{role:'alert'}});
  this.markdown=this.addChild(new MermaidMarkdownEditor(app,surface,value,file,app.scope,()=>{void this.commit();},()=>this.escape(),{
   inline:true,singleLine,extensions:geometry?[geometry.extension]:undefined,onChange:view=>geometry?.changed(view),
   onEnter:(_view,mod)=>{if(this.suggesting()||!singleLine&&!mod)return false;void this.commit();return true;},
   onEscape:()=>this.escape(),
  }));
  geometry?.attach(this.markdown.native.cm);
  if(geometry)this.registerDomEvent(host,'load',()=>geometry.changed(this.markdown.native.cm),true);
  this.registerDomEvent(host,'blur',()=>{if(this.blurTimer)window.clearTimeout(this.blurTimer);this.blurTimer=window.setTimeout(()=>{this.blurTimer=undefined;if(!this.disposed&&!this.suggesting()&&!host.contains(host.ownerDocument.activeElement))void this.commit();},0);},true);
  this.registerDomEvent(host,'keydown',event=>{event.stopPropagation();if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing){event.preventDefault();this.escape();}});
  this.register(()=>{this.disposed=true;if(this.blurTimer)window.clearTimeout(this.blurTimer);host.remove();});
 }
 get pending():Promise<void>|undefined{return this.busy;}
 get restoreFocus():boolean{return this.focusedSubmit||this.host.contains(this.host.ownerDocument.activeElement);}
 get value():string{return this.markdown.value;}
 setValue(value:string):void{if(this.singleLine&&/[\r\n]/u.test(value))throw new Error(t('tetrad.titleSingleLine'));if(!this.busy&&!this.accepted)this.markdown.set(value);}
 /** Keep the actual drag source mounted after its value was accepted. */
 holdAccepted():void{this.accepted=true;this.focusedSubmit=false;if(this.blurTimer)window.clearTimeout(this.blurTimer);this.blurTimer=undefined;this.host.inert=true;}
 focus(selectAll=false,point?:{x:number;y:number}):void{const cm=this.markdown.native.cm;if(selectAll)cm.dispatch({selection:{anchor:0,head:this.value.length}});else if(point){const at=cm.posAtCoords(point,false);if(at!==null)cm.dispatch({selection:{anchor:at}});}this.markdown.focus();}
 private suggesting(){
  const workspace=this.app.workspace as typeof this.app.workspace&{editorSuggest?:{currentSuggest?:{context?:{editor?:unknown};close?():void}}};
  const suggest=workspace.editorSuggest?.currentSuggest;return suggest?.context?.editor===this.markdown.native.editor?suggest:undefined;
 }
 private escape():boolean{
  if(this.busy||this.disposed)return true;const suggest=this.suggesting();if(suggest?.close){suggest.close();return true;}this.cancel();return true;
 }
 commit():Promise<void>{
  if(this.busy)return this.busy;if(this.disposed||this.accepted)return Promise.resolve();
  const value=this.value;this.focusedSubmit=this.host.contains(this.host.ownerDocument.activeElement);this.status.empty();this.host.setAttribute('aria-busy','true');this.host.querySelector<HTMLElement>('.em-tetrad-inline-surface')!.inert=true;
  const work=Promise.resolve().then(()=>this.save(value)).catch((error:unknown)=>{if(!this.disposed){this.status.setText(error instanceof Error?error.message:String(error));}throw error;}).finally(()=>{if(this.busy===work)this.busy=undefined;this.focusedSubmit=false;if(!this.disposed){this.host.removeAttribute('aria-busy');this.host.querySelector<HTMLElement>('.em-tetrad-inline-surface')!.inert=false;}});
  this.busy=work;void work.catch(()=>{});return work;
 }
}
