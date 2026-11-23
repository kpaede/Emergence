import {Component,Menu,Modal,Notice,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {errorMessage} from '../util';
import {iconButton,relabelIcon} from '../ui/panel';
import {MermaidCodeEditor} from '../mermaid/code-editor';
import {MermaidHistory} from '../mermaid/history';
import {noteText,noteEditor} from './note';
import type {LawId} from './render/laws';
import {renderTetrad} from './render/source';
import type {TetradLayout} from './render/layout';
import {TetradBinding} from './binding';
import {DEFAULT_PATTERN,type TetradStore} from './patterns';
import {parseSource,tetradBlocks,sourceInsertion} from './source';
import {newTetrad,type TetradFormat} from './preferences';
import {TetradDisplayModal} from './dialogs';
import {decorateTetrad,tetradSplit} from './editor-ui';
import {TetradGraphEditor} from './graph-editor';
import {measureTetradFlow} from './render/line-flow';

export class TetradPanel extends Component {
 readonly root:HTMLElement;readonly preview:HTMLElement;source:string;
 private editor:MermaidCodeEditor;private history:MermaidHistory;private binding?:TetradBinding;private savedSource:string;
 private status:HTMLElement;private error:HTMLElement;
 private newButton:HTMLButtonElement;private insertButton:HTMLButtonElement;private undoButton:HTMLButtonElement;private redoButton:HTMLButtonElement;private sourceButton:HTMLButtonElement;private deleteButton:HTMLButtonElement;private graph?:TetradGraphEditor;
 private renderTimer?:number;private saveTimer?:number;private externalTimer?:number;private generation=0;private session=0;private renderedSession=-1;
 private renderPending=false;
 private enabled=true;private disposed=false;private layout?:TetradLayout;private rendered?:Component;private fullscreen?:Modal;
 private dialogs=new Set<Modal>();private relabel:()=>void;private active=false;private failed=false;private inserting?:Promise<void>;private insertionWrite?:Promise<void>;private creating?:Promise<void>;private showSource=false;private selectedLaw:LawId='enhances';private creationFormat?:TetradFormat;
 constructor(readonly app:App,host:HTMLElement,private currentFile:()=>TFile|undefined,private store:TetradStore,private defaultFormat:()=>TetradFormat=()=>'headings-2'){
  super();this.creationFormat=defaultFormat();this.source=this.savedSource=newTetrad(this.creationFormat);this.history=new MermaidHistory(this.source);this.root=host.createDiv({cls:'em-mermaid em-tetrad'});
  const top=this.root.createDiv({cls:'em-mm-top'}),tools=top.createDiv({cls:'em-mm-tools'});
  this.undoButton=iconButton(tools,'undo-2',t('argdown.undo_ctrl_cmd_z'),()=>{void this.run(()=>this.undo());});this.redoButton=iconButton(tools,'redo-2',t('labels.redo_ctrl_cmd_shift_z'),()=>{void this.run(()=>this.redo());});
  this.deleteButton=iconButton(tools,'trash-2',t('tetrad.deleteSelected'),()=>{void this.run(()=>this.graph?.removeSelected());});this.deleteButton.hidden=true;
  this.sourceButton=iconButton(tools,'code-2',t('tetrad.showSource'),()=>this.toggleSource());this.sourceButton.setAttribute('aria-pressed','false');
  const appearance=iconButton(tools,'settings-2',t('tetrad.appearance'),()=>this.openDialog(new TetradDisplayModal(app,store,this.pattern())));
  const maximize=iconButton(tools,'maximize',t('tetrad.fullscreen'),()=>this.toggleFullscreen());
  this.status=top.createDiv({cls:'em-mm-status',attr:{role:'status'}});
  const context=tools;
  this.newButton=context.createEl('button',{text:t('tetrad.new')});this.newButton.onclick=()=>{void this.run(()=>this.createNew());};
  this.insertButton=context.createEl('button',{text:t('tetrad.insert'),cls:'mod-cta'});this.insertButton.onclick=()=>{void this.run(()=>this.insert());};tools.prepend(this.newButton,this.insertButton);
  const split=this.root.createDiv({cls:'em-mm-split'}),code=split.createDiv({cls:'em-mm-code'});
  const divider=split.createDiv({cls:'em-mm-divider',attr:{role:'separator',tabindex:'0','aria-label':t('tetrad.split'),'aria-valuemin':'20','aria-valuemax':'80','aria-valuenow':'36'}});
  const stage=split.createDiv({cls:'em-mm-stage em-tetrad-stage'});this.preview=stage.createDiv({cls:'em-tetrad-preview markdown-rendered'});
  this.error=this.root.createDiv({cls:'em-mm-error em-error',attr:{role:'status'}});
  const hint=this.root.createDiv({cls:'em-mm-hint',text:t('tetrad.editorHelp')});
  this.editor=new MermaidCodeEditor(code,this.source,value=>this.setSource(value,true),position=>this.selectSource(position),()=>{void this.run(()=>this.undo());},()=>{void this.run(()=>this.redo());},false,{label:t('tetrad.source'),syncSelection:true,tokens:()=>[]});
  tetradSplit(this,this.root,split,divider);this.root.toggleClass('em-tetrad-graphic',!this.showSource);
  this.registerDomEvent(this.preview,'focusin',event=>{const law=(event.target as HTMLElement).closest<HTMLElement>('[data-em-law]')?.dataset.emLaw;if(law)this.chooseLaw(law as LawId);});
  this.registerDomEvent(this.root,'keydown',event=>this.keydown(event));
  this.register(this.store.subscribe(()=>{if(this.active)void this.render();}));
  this.register(()=>{void this.flush().catch(error=>new Notice(t('tetrad.rejected',{reason:errorMessage(error)})));this.disposed=true;this.generation++;for(const timer of [this.renderTimer,this.saveTimer,this.externalTimer])if(timer)window.clearTimeout(timer);this.layout?.destroy();this.editor.destroy();this.fullscreen?.close();for(const dialog of this.dialogs)dialog.close();this.root.remove();});
  this.relabel=()=>{this.newButton.setText(t('tetrad.new'));this.insertButton.setText(t('tetrad.insert'));relabelIcon(appearance,t('tetrad.appearance'));relabelIcon(maximize,t('tetrad.fullscreen'));relabelIcon(this.sourceButton,t(this.showSource?'tetrad.hideSource':'tetrad.showSource'));relabelIcon(this.undoButton,t('argdown.undo_ctrl_cmd_z'));relabelIcon(this.redoButton,t('labels.redo_ctrl_cmd_shift_z'));relabelIcon(this.deleteButton,t('tetrad.deleteSelected'));divider.setAttribute('aria-label',t('tetrad.split'));hint.setText(t('tetrad.editorHelp'));this.editor.setLabel(t('tetrad.source'));};this.context();
 }
 onload():void{
  const schedule=()=>{if(this.externalTimer)window.clearTimeout(this.externalTimer);this.externalTimer=window.setTimeout(()=>{if(!this.disposed&&this.enabled&&this.active)void this.run(async()=>{if(this.graph?.editing||this.graph?.saving){return;}await this.flush();await this.binding?.refresh();this.context();});},250);};
  this.registerEvent(this.app.workspace.on('editor-change',editor=>{if(editor===noteEditor(this.app,this.binding?.file.path??this.currentFile()?.path??''))schedule();}));this.registerEvent(this.app.vault.on('modify',file=>{if(file===this.binding?.file||file===this.currentFile())schedule();}));
 }
 async activate():Promise<void>{if(!this.enabled)return;this.active=true;await this.render();this.context();}
 context():void{
  const file=this.currentFile(),busy=!!this.inserting||!!this.creating;this.editor.setReadOnly(busy);this.preview.inert=busy;
  this.status.hidden=!!this.binding;this.status.setText(this.binding?'':file?t('tetrad.newInNote',{file:file.basename}):t('tetrad.chooseNote'));
  this.status.title=this.binding?'':file?.path??'';this.newButton.hidden=false;this.newButton.disabled=busy;
  this.insertButton.hidden=false;this.insertButton.disabled=busy||!file||!!this.binding;this.insertButton.title=this.binding?t('tetrad.alreadyInserted'):file?t('tetrad.insertTarget',{file:file.path}):t('tetrad.chooseNote');
  this.undoButton.disabled=busy||!this.history.canUndo;this.redoButton.disabled=busy||!this.history.canRedo;this.deleteButton.disabled=busy;
 }

 setEnabled(value:boolean):void{this.enabled=value;if(!value){this.fullscreen?.close();for(const dialog of this.dialogs)dialog.close();}}
 refreshLanguage():void{this.relabel();this.context();if(this.active)void this.render();}
 async run(action:()=>unknown):Promise<void>{try{await action();}catch(error){if(!this.disposed)this.showError(error);}}
 private showError(error:unknown):void{this.error.setText(t('tetrad.rejected',{reason:errorMessage(error)}));if(this.binding){const retry=this.error.createEl('button',{text:t('tetrad.reopen')});retry.onclick=()=>{void this.run(()=>this.reopen());};}}
 private pattern(){const type=/^ {0,3}>\s?\[!([^\]]+)\]/u.exec(this.source)?.[1]?.toLowerCase(),pattern=type&&this.store.pattern(type);if(!pattern)throw new Error(t('tetrad.invalidSource'));return pattern;}
 setSource(source:string,typing=false,remember=true):void{
  this.source=source;if(remember)this.history.push(source,typing);this.editor.setSource(source);this.context();
  if(this.renderTimer)window.clearTimeout(this.renderTimer);this.renderTimer=window.setTimeout(()=>{void this.render();},120);
  if(this.saveTimer)window.clearTimeout(this.saveTimer);if(this.binding)this.saveTimer=window.setTimeout(()=>{void this.run(()=>this.flush());},650);
 }
 private async commit(source:string,remember=true):Promise<void>{
  await this.insertionWrite;parseSource(source,this.store.pattern(/^ {0,3}>\s?\[!([^\]]+)\]/u.exec(source)?.[1]??'')??DEFAULT_PATTERN);const binding=this.binding,session=this.session;
  if(binding)await binding.save(source);if(this.disposed||session!==this.session||binding!==this.binding)throw new Error(t('tetrad.closed'));
  this.failed=false;this.error.empty();this.savedSource=binding?.source??source;this.source=this.savedSource;if(remember)this.history.push(this.source);this.editor.setSource(this.source);this.context();await this.render();
 }
 async undo():Promise<void>{await this.flush();const value=this.history.undo();if(value!==undefined)try{await this.commit(value,false);}catch(error){this.history.redo();throw error;}}
 async redo():Promise<void>{await this.flush();const value=this.history.redo();if(value!==undefined)try{await this.commit(value,false);}catch(error){this.history.undo();throw error;}}
 async flush():Promise<void>{
  if(this.graph?.editing||this.graph?.saving)await this.graph.flush();if(this.inserting)await this.inserting;if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=undefined;}if(!this.binding||this.source===this.savedSource&&this.failed)return;
  const source=this.source,binding=this.binding,session=this.session;
  try{parseSource(source,this.pattern());if(source!==binding.source)await binding.save(source);await binding.flush();if(this.binding!==binding||this.session!==session)return;this.savedSource=binding.source;this.failed=false;this.error.empty();if(this.source===source){this.source=binding.source;this.editor.setSource(this.source);}this.context();}
  catch(error){if(this.binding===binding&&this.session===session){this.failed=true;this.source=this.savedSource;this.history=new MermaidHistory(this.source);this.editor.setSource(this.source);this.context();if(!this.disposed){this.showError(error);await this.render();}}throw error;}
 }
 createNew():Promise<void>{
  if(this.creating)return this.creating;
  let nextSession:number|undefined;const binding=this.binding,session=this.session,work=Promise.resolve().then(async()=>{
   await this.flush();if(this.disposed||this.session!==session||this.binding!==binding)throw new Error(t('tetrad.closed'));
   this.renderedSession=-1;if(binding)await this.newDraft();else{this.creationFormat=this.defaultFormat();await this.commit(newTetrad(this.creationFormat));}nextSession=this.session;
  }).finally(()=>{if(this.creating===work)this.creating=undefined;this.context();}).then(async()=>{if(nextSession===this.session&&!this.disposed)await this.graph?.editCore('enhances');});this.creating=work;this.context();return work;
 }
 async newDraft(source?:string):Promise<void>{await this.finishSwitch();this.binding=undefined;this.session++;this.creationFormat=source===undefined?this.defaultFormat():undefined;this.reset(source??newTetrad(this.creationFormat!));await this.render();}
 async updateDefaultFormat():Promise<void>{
  const format=this.defaultFormat();if(this.binding||!this.creationFormat||this.graph?.editing||this.graph?.saving||format===this.creationFormat||this.source!==newTetrad(this.creationFormat))return;
  this.creationFormat=format;this.reset(newTetrad(format));await this.render();
 }
 private async finishSwitch():Promise<void>{if(this.inserting)await this.inserting.catch(()=>{});try{await this.flush();}catch(error){if(!this.failed)throw error;}}
 private reset(source:string):void{this.source=this.savedSource=source;this.failed=false;this.history=new MermaidHistory(source);this.editor.setSource(source);this.error.empty();this.context();}
 async openBlock(file:TFile,index:number):Promise<void>{
  const session=++this.session;await this.finishSwitch();const note=await noteText(this.app,file),block=tetradBlocks(note,this.store.list())[index];if(session!==this.session||this.disposed)return;if(!block)throw new Error(t('tetrad.useCursor'));
  this.binding=new TetradBinding(this.app,file,note,block,()=>this.store.list());this.reset(block.source);await this.render();
 }
 private async reopen():Promise<void>{const file=this.binding?.file;if(!file)return;const blocks=tetradBlocks(await noteText(this.app,file),this.store.list());if(blocks.length===1){await this.openBlock(file,0);return;}const menu=new Menu();for(const block of blocks)menu.addItem(item=>item.setTitle(`${block.index+1}. ${block.source.split('\n')[0]!.replace(/^.*?\][+-]?\s*/u,'')}`).onClick(()=>{void this.run(()=>this.openBlock(file,block.index));}));menu.showAtMouseEvent({clientX:this.error.getBoundingClientRect().left,clientY:this.error.getBoundingClientRect().bottom} as MouseEvent);}
 insert():Promise<void>{
  if(this.inserting)return this.inserting;if(this.binding)return Promise.resolve();
  const file=this.currentFile(),session=this.session,pending=this.insertNew(file,this.source,session).finally(()=>{if(this.inserting===pending)this.inserting=undefined;this.context();if(this.binding?.file===file&&this.session===session&&this.currentFile()===file)this.graph?.focus({kind:'core',law:this.selectedLaw});});this.inserting=pending;this.context();return pending;
 }
 private async insertNew(file:TFile|undefined,source:string,session:number):Promise<void>{
  if(!file)throw new Error(t('tetrad.chooseNote'));
  if(this.graph?.editing||this.graph?.saving){await this.graph.flush();source=this.source;}
  if(this.disposed||this.session!==session)throw new Error(t('tetrad.closed'));parseSource(source,this.pattern());
  const writing=this.writeInsertion(file,source,session);this.insertionWrite=writing;
  try{await writing;}finally{if(this.insertionWrite===writing)this.insertionWrite=undefined;}
 }
 private async writeInsertion(file:TFile,source:string,session:number):Promise<void>{
  const current=await noteText(this.app,file);if(this.disposed||this.session!==session)throw new Error(t('tetrad.closed'));
  const editor=noteEditor(this.app,file.path),cursor=editor?editor.posToOffset(editor.getCursor('to')):current.length;
  const insertion=sourceInsertion(current.slice(0,cursor),current.slice(cursor),source),next=current.slice(0,cursor)+insertion.text+current.slice(cursor);
  const expected=cursor+insertion.sourceOffset,block=tetradBlocks(next,this.store.list()).find(candidate=>candidate.from===expected);if(!block)throw new Error(t('tetrad.invalidSource'));
  if(editor){if(editor.getValue()!==current)throw new Error(t('tetrad.conflict'));editor.replaceRange(insertion.text,editor.offsetToPos(cursor),undefined,'emergence-tetrad');}else await this.app.vault.process(file,latest=>{if(latest!==current)throw new Error(t('tetrad.conflict'));return next;});
  if(this.disposed||this.session!==session)return;this.binding=new TetradBinding(this.app,file,next,block,()=>this.store.list());this.reset(block.source);await this.render();
 }
 private chooseLaw(law:LawId):void{this.selectedLaw=law;}
 private anchorPosition():number|undefined{const box=this.preview.querySelector<HTMLElement>('[data-em-law='+this.selectedLaw+'] .tetrader-core')?.getBoundingClientRect();return box&&(this.selectedLaw==='enhances'||this.selectedLaw==='reverses'?box.bottom:box.top);}
 private selectSource(position:number):void{try{const doc=parseSource(this.source,this.pattern());for(const [law,section]of doc.sections)if(position>=section.headingFrom&&position<section.to)this.chooseLaw(law);}catch{/* Incomplete source remains editable. */}}
 edit(law:LawId):void{this.chooseLaw(law);void this.run(()=>this.graph?.editCore(law));}
 private keydown(event:KeyboardEvent):void{
  if(event.defaultPrevented||this.dialogs.size||(event.target as HTMLElement).closest('.cm-editor,input,textarea,select'))return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();void this.run(()=>event.shiftKey?this.redo():this.undo());return;}
 }
 toggleSource():void{const show=!this.showSource;if(this.graph?.editing){void this.run(async()=>{try{await this.graph?.flush();}finally{this.setSourceShown(show);}});}else this.setSourceShown(show);}
 private setSourceShown(show:boolean):void{this.showSource=show;this.root.toggleClass('em-tetrad-graphic',!show);this.sourceButton.setAttribute('aria-pressed',String(show));relabelIcon(this.sourceButton,t(show?'tetrad.hideSource':'tetrad.showSource'));if(show)this.editor.view.focus();}
 async render():Promise<void>{
  if(this.graph?.interacting){this.renderPending=true;return;}
  if(this.disposed||this.graph?.editing&&!this.graph.saving)return;const generation=++this.generation,rendered=new Component();rendered.load();const container=createDiv(),callout=container.createDiv({cls:'callout'});
  try{const pattern=this.pattern(),settings=this.store.settings(pattern);callout.dataset.callout=pattern.id;const layout=await renderTetrad(this.app,callout,this.source,pattern,settings,this.binding?.file.path??this.currentFile()?.path??'',rendered,()=>generation===this.generation&&!this.disposed);if(generation!==this.generation||this.disposed){layout.destroy();rendered.unload();return;}
   if(this.graph?.interacting){this.renderPending=true;layout.destroy();rendered.unload();return;}
   this.renderPending=false;const focus=this.graph?.focusTarget,scroll=this.preview.scrollTop,anchor=this.renderedSession===this.session?this.anchorPosition():undefined;if(this.graph){this.removeChild(this.graph);this.graph=undefined;}this.layout?.destroy();if(this.rendered)this.removeChild(this.rendered);this.rendered=this.addChild(rendered);this.layout=layout;this.preview.replaceChildren(callout);decorateTetrad(this.preview);this.graph=this.addChild(new TetradGraphEditor(this.app,this.preview,this.source,pattern,this.binding?.file??this.currentFile(),()=>this.source,source=>this.commit(source),count=>{this.deleteButton.hidden=count===0;},(target,point)=>this.graph?.activate(target,point)??Promise.resolve(),error=>this.showError(error),()=>this.renderPending?this.render():undefined));const grid=callout.querySelector<HTMLElement>('.tetrader-grid');if(grid)measureTetradFlow(grid);const nextAnchor=this.anchorPosition();this.preview.scrollTop=anchor!==undefined&&nextAnchor!==undefined?scroll+nextAnchor-anchor:0;this.renderedSession=this.session;if(focus)this.graph.focus(focus);if(!this.failed)this.error.empty();this.chooseLaw(this.selectedLaw);
  }catch(error){rendered.unload();if(generation===this.generation){if(this.graph){this.removeChild(this.graph);this.graph=undefined;}this.layout?.destroy();this.layout=undefined;this.preview.empty();if(!this.failed)this.error.setText(errorMessage(error));if(!this.showSource)this.toggleSource();}}
 }
 private openDialog(dialog:Modal):void{this.dialogs.add(dialog);const close=dialog.onClose.bind(dialog);dialog.onClose=()=>{this.dialogs.delete(dialog);close();this.graph?.focus({kind:'core',law:this.selectedLaw});};dialog.open();}
 toggleFullscreen():void{if(this.fullscreen){this.fullscreen.close();return;}const parent=this.root.parentElement!,next=this.root.nextSibling,modal=this.fullscreen=new Modal(this.app);modal.setTitle(t('tetrad.title'));modal.modalEl.addClass('em-mm-fullscreen');modal.onOpen=()=>modal.contentEl.append(this.root);modal.onClose=()=>{parent.insertBefore(this.root,next?.parentNode===parent?next:null);this.fullscreen=undefined;};modal.open();}
}
