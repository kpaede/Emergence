import {Component,MarkdownRenderer,Modal,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {iconButton,relabelIcon} from '../ui/panel';
import {MermaidCodeEditor} from '../mermaid/code-editor';
import {MermaidHistory} from '../mermaid/history';
import {MermaidTextModal} from '../mermaid/dialogs';
import {noteText,noteEditor} from './note';
import {LAWS,type LawId} from './render/laws';
import {mountTetrad,type TetradLayout} from './render/layout';
import {TetradBinding} from './binding';
import {DEFAULT_PATTERN,type TetradStore} from './patterns';
import {parseSource,editSection,starter,tetradBlocks} from './source';
import {PatternModal,TetradDisplayModal} from './dialogs';

export class TetradPanel extends Component {
 readonly root:HTMLElement;readonly preview:HTMLElement;source=starter(DEFAULT_PATTERN);
 private editor:MermaidCodeEditor;private history=new MermaidHistory(this.source);private binding?:TetradBinding;
 private status:HTMLElement;private error:HTMLElement;private patternSelect:HTMLSelectElement;private blockSelect:HTMLSelectElement;
 private insertButton:HTMLButtonElement;private undoButton:HTMLButtonElement;private redoButton:HTMLButtonElement;
 private renderTimer?:number;private saveTimer?:number;private externalTimer?:number;private generation=0;private session=0;
 private enabled=true;private disposed=false;private layout?:TetradLayout;private rendered?:Component;private fullscreen?:Modal;
 private dialogs=new Set<Modal>();private fields:HTMLElement;private relabel:()=>void;private active=false;private blockFingerprint='';
 constructor(readonly app:App,host:HTMLElement,private currentFile:()=>TFile|undefined,private store:TetradStore){
  super();this.root=host.createDiv({cls:'em-mermaid em-tetrad'});
  const top=this.root.createDiv({cls:'em-mm-top'}),tools=top.createDiv({cls:'em-mm-tools'});
  this.patternSelect=tools.createEl('select',{attr:{'aria-label':t('tetrad.pattern')}});this.patternOptions();
  const fresh=tools.createEl('button',{text:t('tetrad.newDraft')});fresh.onclick=()=>{void this.run(()=>this.newDraft(starter(this.store.pattern(this.patternSelect.value)??DEFAULT_PATTERN)));};
  const pattern=iconButton(tools,'plus',t('tetrad.newPattern'),()=>this.openDialog(new PatternModal(app,store,value=>{this.patternOptions();this.patternSelect.value=value.id;})));
  this.undoButton=iconButton(tools,'undo-2',t('argdown.undo_ctrl_cmd_z'),()=>this.undo());this.redoButton=iconButton(tools,'redo-2',t('labels.redo_ctrl_cmd_shift_z'),()=>this.redo());
  const appearance=iconButton(tools,'settings-2',t('tetrad.appearance'),()=>this.openDialog(new TetradDisplayModal(app,store)));
  const maximize=iconButton(tools,'maximize',t('tetrad.fullscreen'),()=>this.toggleFullscreen());
  this.status=top.createDiv({cls:'em-mm-status',attr:{role:'status'}});
  const context=top.createDiv({cls:'em-mm-context'});
  this.blockSelect=context.createEl('select',{attr:{'aria-label':t('tetrad.inNote')}});
  this.blockSelect.onchange=()=>{const file=this.currentFile();if(file&&this.blockSelect.value!=='')void this.run(()=>this.openBlock(file,Number(this.blockSelect.value)));};
  this.insertButton=context.createEl('button',{text:t('tetrad.insert'),cls:'mod-cta'});this.insertButton.onclick=()=>{void this.run(()=>this.insert());};
  const detach=context.createEl('button',{text:t('tetrad.copyDraft')});detach.onclick=()=>{void this.run(()=>this.copyDraft());};
  const split=this.root.createDiv({cls:'em-mm-split'}),code=split.createDiv({cls:'em-mm-code'});
  const divider=split.createDiv({cls:'em-mm-divider',attr:{role:'separator',tabindex:'0','aria-label':t('tetrad.split'),'aria-valuemin':'20','aria-valuemax':'80','aria-valuenow':'36'}});
  const stage=split.createDiv({cls:'em-mm-stage em-tetrad-stage'});this.fields=stage.createDiv({cls:'em-tetrad-fields'});
  this.preview=stage.createDiv({cls:'em-tetrad-preview markdown-rendered'});
  this.error=this.root.createDiv({cls:'em-mm-error em-error',attr:{role:'status'}});
  const hint=this.root.createDiv({cls:'em-mm-hint',text:t('tetrad.editorHelp')});
  this.editor=new MermaidCodeEditor(code,this.source,value=>this.setSource(value,true),position=>this.selectSource(position),()=>this.undo(),()=>this.redo(),false,{label:t('tetrad.source'),syncSelection:true,tokens:()=>[]});
  let ratio=36;const resize=(value:number)=>{ratio=Math.max(20,Math.min(80,value));split.style.setProperty('--em-mm-split',ratio+'%');divider.setAttribute('aria-valuenow',String(ratio));};
  divider.onpointerdown=event=>{event.preventDefault();divider.setPointerCapture(event.pointerId);};divider.onpointermove=event=>{if(divider.hasPointerCapture(event.pointerId)){const r=split.getBoundingClientRect();resize(this.root.clientWidth>=720?(event.clientX-r.left)/r.width*100:(event.clientY-r.top)/r.height*100);}};
  divider.onkeydown=event=>{if(event.key.startsWith('Arrow')){event.preventDefault();resize(ratio+(['ArrowUp','ArrowLeft'].includes(event.key)?-5:5));}};
  this.registerDomEvent(this.preview,'dblclick',event=>{if((event.target as HTMLElement).closest('a,button'))return;const wing=(event.target as HTMLElement).closest<HTMLElement>('[data-em-law]');if(wing)this.edit(wing.dataset.emLaw as LawId);});
  this.register(this.store.subscribe(()=>{this.patternOptions();if(this.active)void this.render();}));
  this.register(()=>{void this.flush().catch(()=>{});this.disposed=true;this.generation++;for(const timer of [this.renderTimer,this.saveTimer,this.externalTimer])if(timer)window.clearTimeout(timer);this.layout?.destroy();this.editor.destroy();this.fullscreen?.close();for(const dialog of this.dialogs)dialog.close();this.root.remove();});
  this.relabel=()=>{
   fresh.setText(t('tetrad.newDraft'));detach.setText(t('tetrad.copyDraft'));this.insertButton.setText(t('tetrad.insert'));this.patternSelect.setAttribute('aria-label',t('tetrad.pattern'));this.blockSelect.setAttribute('aria-label',t('tetrad.inNote'));
   relabelIcon(pattern,t('tetrad.newPattern'));relabelIcon(appearance,t('tetrad.appearance'));relabelIcon(maximize,t('tetrad.fullscreen'));relabelIcon(this.undoButton,t('argdown.undo_ctrl_cmd_z'));relabelIcon(this.redoButton,t('labels.redo_ctrl_cmd_shift_z'));divider.setAttribute('aria-label',t('tetrad.split'));hint.setText(t('tetrad.editorHelp'));this.editor.setLabel(t('tetrad.source'));
  };this.context();
 }
 onload():void{
  const schedule=()=>{if(this.externalTimer)window.clearTimeout(this.externalTimer);this.externalTimer=window.setTimeout(()=>{if(!this.disposed&&this.enabled)void this.run(async()=>{await this.flush();await this.binding?.refresh();await this.refreshBlocks();});},250);};
  this.registerEvent(this.app.workspace.on('editor-change',schedule));this.registerEvent(this.app.vault.on('modify',file=>{if(file===this.binding?.file||file===this.currentFile())schedule();}));
 }
 private patternOptions():void{const selected=this.patternSelect.value;this.patternSelect.empty();for(const pattern of this.store.list())this.patternSelect.createEl('option',{text:pattern.name,value:pattern.id});if(this.store.pattern(selected))this.patternSelect.value=selected;}
 async activate():Promise<void>{if(!this.enabled)return;this.active=true;await this.render();await this.refreshBlocks();this.context();}
 context():void{this.status.setText(this.binding?t('tetrad.bound',{file:this.binding.file.basename,index:this.binding.index+1}):t('argdown.draft_not_inserted_yet'));this.insertButton.disabled=!!this.binding||!this.currentFile();this.undoButton.disabled=!this.history.canUndo;this.redoButton.disabled=!this.history.canRedo;}
 setEnabled(value:boolean):void{this.enabled=value;if(!value){this.fullscreen?.close();for(const dialog of this.dialogs)dialog.close();}}
 refreshLanguage():void{this.blockFingerprint='';void this.refreshBlocks();this.relabel();this.context();if(this.active)void this.render();}
 async run(action:()=>unknown):Promise<void>{try{await action();}catch(error){if(!this.disposed)this.error.setText(String(error));}}
 private pattern(){const type=/^ {0,3}>\s?\[!([^\]]+)\]/u.exec(this.source)?.[1]?.toLowerCase(),pattern=type&&this.store.pattern(type);if(!pattern)throw new Error(t('tetrad.invalidSource'));return pattern;}
 setSource(source:string,typing=false,remember=true):void{
  this.source=source;if(remember)this.history.push(source,typing);this.editor.setSource(source);this.context();
  if(this.renderTimer)window.clearTimeout(this.renderTimer);this.renderTimer=window.setTimeout(()=>{void this.render();},120);
  if(this.saveTimer)window.clearTimeout(this.saveTimer);if(this.binding)this.saveTimer=window.setTimeout(()=>{void this.run(()=>this.flush());},650);
 }
 undo():void{const value=this.history.undo();if(value!==undefined)this.setSource(value,false,false);}
 redo():void{const value=this.history.redo();if(value!==undefined)this.setSource(value,false,false);}
 async flush():Promise<void>{
  if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=undefined;}
  if(this.binding){parseSource(this.source,this.pattern());const binding=this.binding,source=this.source;if(source!==binding.source){await binding.save(source);if(this.binding===binding&&this.source===source&&binding.source!==source){this.source=binding.source;this.editor.setSource(this.source);}}await binding.flush();}
 }
 async copyDraft():Promise<void>{const source=this.source;try{await this.binding?.flush();}catch{/* The preserved local draft can be detached after a conflict. */}this.binding=undefined;if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=undefined;}this.session++;this.reset(source);await this.render();}
 async newDraft(source=starter(DEFAULT_PATTERN)):Promise<void>{await this.flush();this.binding=undefined;if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=undefined;}this.session++;this.reset(source);await this.render();}
 private reset(source:string):void{this.source=source;this.history=new MermaidHistory(source);this.editor.setSource(source);this.error.empty();this.context();}
 async openBlock(file:TFile,index:number):Promise<void>{
  const session=++this.session;await this.flush();const note=await noteText(this.app,file),block=tetradBlocks(note,this.store.list())[index];if(session!==this.session||this.disposed)return;if(!block)throw new Error(t('tetrad.useCursor'));
  this.binding=new TetradBinding(this.app,file,note,block,()=>this.store.list());this.reset(block.source);await this.render();await this.refreshBlocks();
 }
 async refreshBlocks():Promise<void>{
  const file=this.currentFile(),session=this.session,note=file?await noteText(this.app,file):'',blocks=tetradBlocks(note,this.store.list());if(this.disposed||session!==this.session)return;
  const fingerprint=JSON.stringify([file?.path,note,this.binding?.file.path,this.binding?.index]);if(fingerprint===this.blockFingerprint)return;this.blockFingerprint=fingerprint;
  this.blockSelect.empty();this.blockSelect.createEl('option',{value:'',text:blocks.length?t('tetrad.openInNote'):t('tetrad.noBlocks')});
  for(const block of blocks)this.blockSelect.createEl('option',{value:String(block.index),text:`${block.index+1}. ${block.source.split('\n')[0]?.replace(/^.*?\][+-]?\s*/u,'')||block.type}`});
  this.blockSelect.disabled=!blocks.length;if(this.binding&&this.binding.file===file)this.blockSelect.value=String(this.binding.index);
 }
 async insert():Promise<void>{
  if(this.binding)return;parseSource(this.source,this.pattern());const file=this.currentFile();if(!file)throw new Error(t('tetrad.useCursor'));
  const current=await noteText(this.app,file),editor=noteEditor(this.app,file.path),cursor=editor?editor.posToOffset({line:editor.getCursor().line,ch:0}):current.length;
  const prefix=current.slice(0,cursor),insert=(prefix&&!prefix.endsWith('\n\n')?'\n\n':'')+this.source.replace(/\n*$/u,'')+'\n\n',next=prefix+insert+current.slice(cursor);
  const expected=cursor+insert.indexOf('>'),block=tetradBlocks(next,this.store.list()).find(candidate=>candidate.from===expected);if(!block)throw new Error(t('tetrad.invalidSource'));
  if(editor){if(editor.getValue()!==current)throw new Error(t('tetrad.conflict'));editor.replaceRange(insert,editor.offsetToPos(cursor),undefined,'emergence-tetrad');}
  else await this.app.vault.process(file,latest=>{if(latest!==current)throw new Error(t('tetrad.conflict'));return next;});
  this.binding=new TetradBinding(this.app,file,next,block,()=>this.store.list());this.reset(block.source);await this.render();await this.refreshBlocks();
 }
 private selectSource(position:number):void{try{const doc=parseSource(this.source,this.pattern());for(const law of LAWS){const section=doc.sections.get(law.id);this.preview.querySelector('.tetrader-'+law.id)?.classList.toggle('em-tetrad-selected',!!section&&position>=section.headingFrom&&position<section.to);}}catch{/* Incomplete source remains editable. */}}
 edit(law:LawId):void{
  void this.run(()=>{const pattern=this.pattern(),source=this.source,section=parseSource(source,pattern).sections.get(law);if(section)this.editor.highlight([{from:section.headingFrom,to:section.to}],true);
   this.openDialog(new MermaidTextModal(this.app,pattern.headings[law],section?.body??'',value=>{void this.run(()=>{if(this.source!==source)throw new Error(t('tetrad.conflict'));this.setSource(editSection(source,pattern,law,value));});},'markdown',this.binding?.file??this.currentFile(),t('tetrad.bodyHelp')));
  });
 }
 async render():Promise<void>{
  if(this.disposed)return;const generation=++this.generation;
  const rendered=new Component();rendered.load();const container=createDiv();
  try{
   const pattern=this.pattern(),doc=parseSource(this.source,pattern);const callout=container.createDiv({cls:'callout'});callout.dataset.callout=pattern.id;
   callout.createDiv({cls:'callout-title',text:doc.title});const content=callout.createDiv({cls:'callout-content'});
   const markdown=this.source.split(/\r?\n/u).slice(1).map(line=>line.replace(/^ {0,3}> ?/u,'')).join('\n');
   await MarkdownRenderer.render(this.app,markdown,content,this.binding?.file.path??this.currentFile()?.path??'',rendered);
   if(generation!==this.generation||this.disposed){rendered.unload();return;}
   this.layout?.destroy();if(this.rendered)this.removeChild(this.rendered);this.rendered=this.addChild(rendered);this.preview.replaceChildren(...Array.from(container.childNodes));
   this.layout=mountTetrad(callout,this.store.settings(pattern),pattern);this.fields.empty();
   for(const law of LAWS){const button=this.fields.createEl('button',{text:pattern.headings[law.id]});button.onclick=()=>this.edit(law.id);const wing=callout.querySelector<HTMLElement>('.tetrader-'+law.id);if(wing)wing.dataset.emLaw=law.id;}
   this.error.empty();
  }catch(error){rendered.unload();if(generation===this.generation){this.error.setText(String(error));this.fields.empty();this.layout?.destroy();this.layout=undefined;this.preview.empty();}}
 }
 private openDialog(dialog:Modal):void{this.dialogs.add(dialog);const close=dialog.onClose.bind(dialog);dialog.onClose=()=>{this.dialogs.delete(dialog);close();};dialog.open();}
 toggleFullscreen():void{
  if(this.fullscreen){this.fullscreen.close();return;}const parent=this.root.parentElement!,next=this.root.nextSibling,modal=this.fullscreen=new Modal(this.app);modal.setTitle(t('tetrad.title'));modal.modalEl.addClass('em-mm-fullscreen');modal.onOpen=()=>modal.contentEl.append(this.root);modal.onClose=()=>{parent.insertBefore(this.root,next?.parentNode===parent?next:null);this.fullscreen=undefined;};modal.open();
 }
}
