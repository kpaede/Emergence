import {Component,MarkdownRenderer,Menu,type App} from 'obsidian';
import {t,type TranslationKey} from '../i18n';
import {errorMessage} from '../util';
import {nameWithoutTooltip} from '../ui/accessibility';
import {iconButton,relabelIcon} from '../ui/panel';
import {thoughtIndex,selectionRoots,type ThoughtIndex} from './board-model';
import {thoughts,type Placement,type ThoughtOperation} from './thoughts';
import {newId,type CompanionDocument,type CompanionSection,type Thought} from './model';
import type {CompanionService} from './service';
import {ReaderEditor} from './reader-editor';
import {ReaderDeleteModal,ReaderMoveModal} from './reader-dialogs';
import {readerPreview,readerTarget,readerTask,readerSingleLine,readerVisibility} from './reader-model';
import {encodeOutlineText} from './multiline';
import {ReaderDrag} from './reader-drag';
import {rejectedChangeMessage} from './write-error';
import {readerMoveTargets} from './reader-move-targets';
import {readerSlots} from './reader-slots';
import {applyNativeListMarkers} from '../ui/markdown-lists';
import {readerPointer,type ReaderPointer} from './reader-caret';

/** One chapter projection. All mutations and history belong to CompanionService. */
export class HierarchyReader extends Component {
 private document?:CompanionDocument;private section?:CompanionSection;private path='';private creatingUnder?:string;private index:ThoughtIndex=thoughtIndex([]);private activeId='';
 private selected=new Set<string>();private anchor='';private scroll=new Map<string,number>();private level='';private rowLifecycle?:Component;private rowRaw='';private rowLevel='';private lifecycle?:Component;private editor?:ReaderEditor;private busy?:Promise<void>;private generation=0;
 private parent:HTMLElement;readonly list:HTMLElement;private childPane:HTMLElement;private status:HTMLElement;private tools:HTMLElement;private undo:HTMLButtonElement;private redo:HTMLButtonElement;private search:HTMLInputElement;private results:HTMLElement;
 private copied?:{text:string;nodes:Thought[];cut:boolean;path:string};private drag:ReaderDrag;private dialogs=new Set<ReaderDeleteModal|ReaderMoveModal>();private failure?:Error;private unreadable=false;private suspended=true;
 private hideCompleted=false;private visibility=readerVisibility(this.index,false);private filter:HTMLButtonElement;private editRow?:HTMLElement;private adding=false;
 private toolLabels=new Map<HTMLButtonElement,TranslationKey>();
 constructor(private app:App,readonly host:HTMLElement,private service:CompanionService,private reportError:()=>void=()=>{}){
  super();host.addClass('em-hierarchy-reader');
  this.tools=host.createDiv({cls:'em-reader-tools'});this.search=this.tools.createEl('input',{type:'search',attr:{'aria-label':t('companion.readerSearch'),placeholder:t('companion.readerSearch')}});this.results=this.tools.createSpan({cls:'em-reader-search-count',attr:{role:'status'}});
  this.tool('chevron-up','companion.previousThought',()=>this.find(-1));this.tool('chevron-down','companion.nextThought',()=>this.find(1));
  this.tool('plus','companion.addSibling',()=>this.add(this.activeId,'after'));this.tool('corner-down-right','companion.addChild',()=>this.add(this.activeId,'last'));
  this.filter=iconButton(this.tools,'list-todo',t('companion.readerHideCompleted'),()=>this.toggleCompleted());this.filter.setAttribute('aria-pressed','false');
  this.undo=this.tool('undo-2','companion.undo',()=>{void this.history();});this.redo=this.tool('redo-2','companion.redo',()=>{void this.history(true);});
  this.registerDomEvent(this.search,'input',()=>this.searchCount());this.registerDomEvent(this.search,'keydown',event=>{if(event.key==='Enter'){event.preventDefault();this.find(event.shiftKey?-1:1);}});
  this.status=host.createDiv({cls:'em-reader-status em-error',attr:{role:'status'}});this.parent=host.createDiv({cls:'em-reader-parent'});this.list=host.createDiv({cls:'em-reader-stream',attr:{role:'listbox',tabindex:'0','aria-multiselectable':'true','aria-label':t('companion.thoughts')}});this.childPane=host.createDiv({cls:'em-reader-children'});nameWithoutTooltip(this.search,t('companion.readerSearch'),this.tools);nameWithoutTooltip(this.list,t('companion.thoughts'),host);
  this.drag=this.addChild(new ReaderDrag(host,this.list,()=>({path:this.path,document:this.document,section:this.section?.id??'',parent:this.creatingUnder??this.index.byId.get(this.activeId)?.parent,index:this.index,selected:this.selected,blocked:this.editing||!!this.busy}),id=>this.navigate(id,false),(operations,id)=>this.change(operations,id)));
  this.registerDomEvent(this.list,'keydown',event=>this.key(event));this.registerDomEvent(this.list,'paste',event=>{if(this.editing||this.busy)return;event.preventDefault();event.stopPropagation();if(this.selected.size!==1&&this.index.nodes.length)return;const text=event.clipboardData?.getData('text/plain');if(text)void this.paste(text);});
  this.register(()=>{this.generation++;this.cancel(false);for(const dialog of this.dialogs)dialog.close();host.empty();});
 }
 get editing():boolean{return !!this.editor;}
 get pending():boolean{return this.editing||!!this.busy;}
 get focused():string{return this.activeId;}
 isShowing(path:string,section:string):boolean{return this.path===path&&this.section?.id===section;}
 focus():void{if(!this.suspended&&!this.unreadable)this.focusList();}
 reports(error:unknown):boolean{return !!this.failure&&this.failure===error;}
 private tool(icon:string,label:TranslationKey,action:()=>void):HTMLButtonElement{const button=iconButton(this.tools,icon,t(label),action);this.toolLabels.set(button,label);return button;}
 /** Relabel existing DOM, including an open editor, without replacing text or moving focus. */
 refreshLanguage():void{
  this.search.placeholder=t('companion.readerSearch');nameWithoutTooltip(this.search,t('companion.readerSearch'),this.tools);nameWithoutTooltip(this.list,t('companion.thoughts'),this.host);this.list.setAttribute('aria-description',t('companion.readerHelp'));
  for(const [button,label]of this.toolLabels)relabelIcon(button,t(label));
  this.parent.querySelector('.em-reader-root')?.setText(t('companion.readerRoot'));this.parent.querySelector('.em-reader-preview')?.setAttribute('aria-label',t('companion.readerParent'));
  this.childPane.querySelector('.em-reader-children-count')?.setText(t('companion.readerChildren',{count:this.creatingUnder?0:this.children(this.activeId).length}));
  for(const row of this.list.querySelectorAll<HTMLElement>('[data-em-note]')){
   const node=this.index.byId.get(row.dataset.emNote??'');if(!node)continue;const tools=row.querySelector('.em-reader-node-tools'),grip=tools?.querySelector<HTMLElement>('.em-reader-grip'),more=tools?.querySelector<HTMLElement>('.em-reader-more');if(grip)relabelIcon(grip,t('companion.moveThought'));if(more)relabelIcon(more,t('companion.cardActions'));
   const children=tools?.querySelector<HTMLElement>('.em-reader-open-children');children?.querySelector('.em-sr-only')?.setText(this.childrenLabel(node));
   tools?.querySelector('input')?.setAttribute('aria-label',t(readerTask(node.text).state?.toLowerCase()==='x'?'companion.readerUncheck':'companion.readerCheck'));const hint=row.querySelector<HTMLElement>('.em-reader-connector-hint');if(hint){hint.setText(t('companion.readerConnector'));hint.title=t('companion.readerConnectorHelp');}
  }
  for(const zone of this.host.querySelectorAll<HTMLElement>('[data-reader-placement]'))zone.setText(t(`companion.reader${zone.dataset.readerPlacement![0]!.toUpperCase()+zone.dataset.readerPlacement!.slice(1)}` as 'companion.readerBefore'));
  const empty=this.list.querySelector('.em-reader-empty');empty?.querySelector('div')?.setText(t('companion.readerNoOpenEntries'));empty?.querySelector('button')?.setText(t('companion.addSibling'));this.status.querySelector('button')?.setText(t('companion.retry'));
  this.editor?.refreshLanguage();this.searchCount();this.updateControls();
 }
 render(path:string,document:CompanionDocument,section:CompanionSection,committed=false):void{
  if(this.editing||this.busy&&!committed)return;const same=this.path===path&&this.section?.id===section.id,previous=this.index.byId.get(this.activeId),previousAt=previous?(this.index.children.get(previous.parent??'')??[]).findIndex(node=>node.id===previous.id):0;this.remember();this.path=path;this.document=document;this.section=section;this.index=thoughtIndex(thoughts(section));this.unreadable=false;
  if(!same||this.suspended){this.suspended=false;this.activeId=this.service.selectedThought(path,section.id);this.selected.clear();this.level='';this.search.value='';this.status.empty();}
  if(!this.index.byId.has(this.activeId)){const siblings=same&&previous?this.index.children.get(previous.parent??''):undefined;this.activeId=siblings?.[Math.min(Math.max(0,previousAt),siblings.length-1)]?.id??this.index.children.get('')?.[0]?.id??'';}
  this.refreshVisibility();
  this.saveSelection();this.paint();
 }
 private saveSelection():void{if(this.section)this.service.selectThought(this.path,this.section.id,this.activeId);}
 private children(parent:string):Thought[]{return (this.index.children.get(parent)??[]).filter(node=>this.visibility.visible.has(node.id));}
 private refreshVisibility():void{
  this.visibility=readerVisibility(this.index,this.hideCompleted);
  if(!this.visibility.visible.has(this.activeId)){
   const old=this.index.byId.get(this.activeId),peers=this.index.children.get(old?.parent??'')??[],at=old?peers.indexOf(old):-1;
   let parent=old?.parent;while(parent&&!this.visibility.visible.has(parent))parent=this.index.byId.get(parent)?.parent;
   this.activeId=peers.slice(at+1).find(node=>this.visibility.visible.has(node.id))?.id??peers.slice(0,at).reverse().find(node=>this.visibility.visible.has(node.id))?.id??parent??this.children('')[0]?.id??'';this.selected.clear();this.anchor=this.activeId;
  }
  for(const id of this.selected)if(!this.visibility.visible.has(id))this.selected.delete(id);if(this.activeId&&!this.selected.size)this.selected.add(this.activeId);
 }
 private toggleCompleted():void{if(this.editing||this.busy)return;this.hideCompleted=!this.hideCompleted;this.refreshVisibility();this.saveSelection();this.paint(true,true);}
 private levelKey():string{return JSON.stringify([this.path,this.section?.id,this.creatingUnder??this.index.byId.get(this.activeId)?.parent??'',this.hideCompleted]);}
 private remember():void{if(this.level)this.scroll.set(this.level,this.list.scrollTop);}
 private paint(reveal=false,focus=false):void{
  if(!this.document||!this.section||this.editing)return;this.drag.clearFeedback();this.remember();const key=this.levelKey(),same=key===this.level;this.level=key;
  if(this.lifecycle)this.removeChild(this.lifecycle);const lifecycle=this.lifecycle=this.addChild(new Component());this.parent.empty();this.childPane.empty();this.searchCount();const reuse=this.rowLevel===key&&this.rowRaw===this.section.raw&&!!this.rowLifecycle;let rows=this.rowLifecycle;if(!reuse){if(rows)this.removeChild(rows);rows=this.rowLifecycle=this.addChild(new Component());this.list.empty();this.rowRaw=this.section.raw;this.rowLevel=key;this.generation++;}const generation=this.generation;
  const active=this.index.byId.get(this.activeId),parent=this.creatingUnder?this.index.byId.get(this.creatingUnder):active?.parent?this.index.byId.get(active.parent):undefined;
  if(parent){const button=this.parent.createEl('button',{cls:'em-reader-preview',attr:{'aria-label':t('companion.readerParent')}});button.createSpan({text:'↑',cls:'em-reader-up'});button.createSpan({text:readerPreview(parent.text,300)});button.toggleClass('is-complete',readerTask(parent.text).state?.toLowerCase()==='x');button.onclick=()=>this.navigate(parent.id,true);this.drag.target(lifecycle,button,parent.id,true);}
  else this.parent.createSpan({text:t('companion.readerRoot'),cls:'em-reader-root'});
  const siblings=this.children(this.creatingUnder??active?.parent??'');
  if(!reuse&&!siblings.length){const empty=this.list.createDiv({cls:'em-reader-empty'});if(this.hideCompleted&&this.index.nodes.length)empty.createDiv({text:t('companion.readerNoOpenEntries')});empty.createEl('button',{text:t('companion.addSibling')}).onclick=()=>this.add(this.creatingUnder,'last');}
  if(!reuse){for(const node of siblings)this.node(rows!,node,generation);readerSlots(rows!,this.list,siblings,(target,placement)=>this.add(target,placement),slot=>this.drag.slot(rows!,slot),this.creatingUnder??active?.parent);this.drag.clearFeedback();}else for(const row of this.list.querySelectorAll<HTMLElement>('[data-em-note]')){const id=row.dataset.emNote??'';row.hidden=false;row.toggleClass('is-active',id===this.activeId);row.toggleClass('is-selected',this.selected.has(id));row.toggleClass('is-cut',!!this.copied?.cut&&this.copied.path===this.path&&this.copied.nodes.some(node=>node.id===id));row.setAttribute('aria-selected',String(this.selected.has(id)));row.tabIndex=id===this.activeId?0:-1;}
  const children=this.creatingUnder?[]:this.children(this.activeId);this.host.toggleClass('has-reader-children',children.length>0);this.childPane.createDiv({cls:'em-reader-children-count',text:t('companion.readerChildren',{count:children.length})});
  const previews=this.childPane.createDiv({cls:'em-reader-child-list'});for(const child of children){const button=previews.createEl('button',{cls:'em-reader-preview',attr:{title:child.text}});button.createSpan({text:readerPreview(child.text)});button.toggleClass('is-complete',readerTask(child.text).state?.toLowerCase()==='x');button.onclick=()=>this.navigate(child.id,true);this.drag.target(lifecycle,button,child.id,true);}
  this.list.scrollTop=this.scroll.get(key)??(same?this.list.scrollTop:0);if(reveal)this.reveal();if(focus)this.focusList();
  this.updateControls();this.list.setAttribute('aria-description',t('companion.readerHelp'));
 }
 private updateControls():void{this.host.setAttribute('aria-busy',String(!!this.busy));for(const button of this.tools.querySelectorAll('button'))button.disabled=this.editing||!!this.busy||this.unreadable;for(const button of this.list.querySelectorAll<HTMLButtonElement>('.em-reader-slot button'))button.disabled=this.editing||!!this.busy||this.unreadable;this.undo.disabled=this.editing||this.unreadable||!!this.busy||!this.service.canUndo(this.path);this.redo.disabled=this.editing||this.unreadable||!!this.busy||!this.service.canRedo(this.path);this.search.disabled=this.unreadable||this.editing||!!this.busy;this.filter.setAttribute('aria-pressed',String(this.hideCompleted));const label=t(this.hideCompleted?'companion.readerShowCompleted':'companion.readerHideCompleted');if(this.filter.getAttribute('aria-label')!==label)relabelIcon(this.filter,label);for(const [button,key]of this.toolLabels)if(key==='companion.addChild'||key==='companion.addSibling')button.disabled=this.editing||!!this.busy||this.unreadable||this.selected.size!==1&&(key==='companion.addChild'||this.index.nodes.length>0);for(const input of this.list.querySelectorAll<HTMLInputElement>('.em-reader-node-tools input'))input.disabled=this.editing||!!this.busy;for(const button of this.list.querySelectorAll<HTMLButtonElement>('.em-reader-open-children'))button.disabled=this.editing||!!this.busy||this.unreadable||!this.children(button.dataset.readerParent??'').length;}
 private childrenLabel(node:Thought):string{return this.children(node.id).length?t('companion.readerOpenChildren',{count:this.index.children.get(node.id)?.length??0}):t('companion.readerChildrenHidden');}
 private node(lifecycle:Component,node:Thought,generation:number):void{
  const row=this.list.createDiv({cls:'em-reader-node',attr:{role:'option',tabindex:node.id===this.activeId?'0':'-1','aria-selected':String(this.selected.has(node.id))}});row.dataset.emNote=node.id;row.toggleClass('is-active',node.id===this.activeId);row.toggleClass('is-selected',this.selected.has(node.id));row.toggleClass('is-cut',!!this.copied?.cut&&this.copied.path===this.path&&this.copied.nodes.some(item=>item.id===node.id));
  const controls=row.createDiv({cls:'em-reader-node-tools'}),grip=iconButton(controls,'grip-vertical',t('companion.moveThought'),()=>{});grip.addClass('em-reader-grip');this.drag.source(lifecycle,grip,node);
  const {body,state}=readerTask(node.text),checked=state?.toLowerCase()==='x';row.toggleClass('is-complete',checked);row.toggleClass('is-connector',this.visibility.connectors.has(node.id));const checkbox=controls.createEl('input',{type:'checkbox',attr:{'aria-label':t(checked?'companion.readerUncheck':'companion.readerCheck')}});checkbox.checked=checked;checkbox.indeterminate=state==='-';checkbox.onchange=()=>{if(this.editing||this.busy){checkbox.checked=checked;return;}void this.change([{kind:'edit',id:node.id,expected:node.text,text:'['+(checkbox.checked?'x':' ')+'] '+body}]);};
  if(this.index.children.get(node.id)?.length){const open=iconButton(controls,'chevron-right',this.childrenLabel(node),()=>{const child=this.children(node.id)[0];if(child)this.navigate(child.id);},false);open.addClass('em-reader-open-children');open.dataset.readerParent=node.id;}
  const more=iconButton(controls,'ellipsis',t('companion.cardActions'),()=>this.menu(node,row));more.addClass('em-reader-more');
  if(this.visibility.connectors.has(node.id))row.createDiv({cls:'em-reader-connector-hint',text:t('companion.readerConnector'),attr:{title:t('companion.readerConnectorHelp')}});
  const content=row.createDiv({cls:'em-reader-text markdown-rendered'}),sourcePath=this.document!.files?.[node.section]??this.path;lifecycle.registerDomEvent(content,'click',event=>{const link=(event.target as HTMLElement).closest<HTMLAnchorElement>('a');if(!link)return;event.stopPropagation();if(link.classList.contains('internal-link')){event.preventDefault();const href=link.dataset.href??link.getAttribute('href');if(href)void this.app.workspace.openLinkText(href,sourcePath,event.ctrlKey||event.metaKey).catch(error=>this.status.setText(errorMessage(error)));}});void MarkdownRenderer.render(this.app,body||'\u200b',content,sourcePath,lifecycle).then(()=>{if(generation!==this.generation)return;applyNativeListMarkers(content);for(const checkbox of content.querySelectorAll<HTMLInputElement>('input[type=checkbox]'))checkbox.disabled=true;}).catch(()=>{if(generation===this.generation)content.setText(body);});
  lifecycle.registerDomEvent(row,'mousedown',event=>{if(event.button===0&&(event.shiftKey||event.ctrlKey||event.metaKey)&&!(event.target as HTMLElement).closest('button,a,input,textarea,.cm-editor'))event.preventDefault();});
  lifecycle.registerDomEvent(row,'click',event=>{if((event.target as HTMLElement).closest('button,a,input,textarea,.cm-editor'))return;this.click(node,event);});
  lifecycle.registerDomEvent(row,'dblclick',event=>{if(event.shiftKey||event.ctrlKey||event.metaKey||(event.target as HTMLElement).closest('button,a,input,textarea,.cm-editor'))return;const point=readerPointer(content,body,event,node.text.length-body.length);event.preventDefault();this.edit(node,point);});
  lifecycle.registerDomEvent(row,'contextmenu',event=>{if(this.editing)return;event.preventDefault();this.menu(node,more,event);});this.drag.target(lifecycle,row,node.id);
 }
 private click(node:Thought,event:MouseEvent):void{
  if(this.editing||this.busy)return;const modified=event.shiftKey||event.metaKey||event.ctrlKey;if(!modified&&this.host.ownerDocument.getSelection()?.isCollapsed===false)return;if(modified){event.preventDefault();this.host.ownerDocument.getSelection()?.removeAllRanges();}
  if(event.shiftKey){this.selectRange(node.id,event.metaKey||event.ctrlKey);return;}
  else if(event.metaKey||event.ctrlKey){if(this.selected.has(node.id))this.selected.delete(node.id);else this.selected.add(node.id);}
  else{this.selected.clear();this.selected.add(node.id);}this.activeId=this.selected.has(node.id)||!this.selected.size?node.id:[...this.selected].at(-1)!;this.anchor=this.activeId;this.saveSelection();this.paint(false,true);
 }
 private selectRange(id:string,additive=false):void{
  const target=this.index.byId.get(id);if(!target)return;const siblings=this.children(target.parent??'');if(!siblings.some(node=>node.id===this.anchor))this.anchor=siblings.some(node=>node.id===this.activeId)?this.activeId:id;
  const from=siblings.findIndex(node=>node.id===this.anchor),to=siblings.findIndex(node=>node.id===id),range=siblings.slice(Math.min(from,to),Math.max(from,to)+1).map(node=>node.id);this.selected=new Set(additive?[...this.selected,...range]:range);this.activeId=id;this.saveSelection();this.paint(true,true);
 }
 navigate(id:string,keyboard=true):void{if(this.editing||this.busy||!this.visibility.visible.has(id))return;this.selected.clear();this.selected.add(id);this.anchor=id;this.activeId=id;this.saveSelection();this.paint(keyboard,keyboard);}
 private focusList():void{(this.list.querySelector<HTMLElement>('.is-active')??this.list).focus({preventScroll:true});}
 private reveal():void{const row=this.list.querySelector<HTMLElement>('.is-active');if(!row)return;const box=row.getBoundingClientRect(),list=this.list.getBoundingClientRect();if(box.height>list.height&&box.bottom>list.top&&box.top<list.bottom)return;if(box.top<list.top)this.list.scrollTop+=box.top-list.top;else if(box.bottom>list.bottom)this.list.scrollTop+=box.height>list.height?box.top-list.top:box.bottom-list.bottom;}
 private key(event:KeyboardEvent):void{
  if(this.editing||this.busy||event.isComposing||(event.target as HTMLElement).closest('button,input,textarea,a,[contenteditable=true]'))return;
  const mod=event.metaKey||event.ctrlKey,handled=()=>{event.preventDefault();event.stopPropagation();};
  if(event.shiftKey&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){handled();const next=readerTarget(this.index,this.activeId,event.key,this.visibility.visible);if(next)this.selectRange(next.id,mod);return;}
  if(mod&&['ArrowLeft','ArrowRight','ArrowDown'].includes(event.key)){handled();if(this.selected.size===1)this.add(this.activeId,event.key==='ArrowLeft'?'before':event.key==='ArrowRight'?'after':'last');return;}
  if(event.key==='Enter'){handled();if(this.selected.size===1){const node=this.index.byId.get(this.activeId);if(node)this.edit(node);}else if(!this.children('').length)this.add();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){handled();const next=readerTarget(this.index,this.activeId,event.key,this.visibility.visible);if(next)this.navigate(next.id);return;}
  if(event.key==='Escape'&&this.selected.size>1){handled();this.navigate(this.activeId);return;}
  if(mod){const key=event.key.toLowerCase();if(key==='z'||key==='y'){handled();void this.history(event.shiftKey||key==='y');}else if(key==='a'){handled();this.selected=new Set(this.children(this.index.byId.get(this.activeId)?.parent??'').map(node=>node.id));this.anchor=this.activeId;this.paint(false,true);}else if(key==='c'||key==='x'){if(this.host.ownerDocument.getSelection()?.isCollapsed===false)return;handled();void this.copy(key==='x');}else if(key==='v'){handled();if(this.selected.size===1||!this.index.nodes.length)void this.readClipboard();}return;}
  if(event.key==='Delete'||event.key==='Backspace'){handled();this.remove();}
 }
 edit(node:Thought,pointer?:ReaderPointer):void{this.beginEditor(node.text,text=>[{kind:'edit',id:node.id,expected:node.text,text}],node.id,undefined,'after',pointer);}
 add(target?:string,placement:Placement='last'):void{if(!this.section||this.editing||this.busy||this.unreadable)return;const id=newId();if(target&&(placement==='first'||placement==='last')){this.creatingUnder=target;this.paint();}this.beginEditor('',text=>[{kind:'add',section:this.section!.id,target:target||undefined,placement,text,id}],id,target,placement);}
 private beginEditor(value:string,operations:(text:string)=>ThoughtOperation[],id:string,target?:string,placement:Placement='after',pointer?:ReaderPointer):void{
  if(this.editing||this.busy||this.unreadable)return;this.status.empty();this.failure=undefined;this.host.addClass('is-editing');const row=this.list.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(id)+'"]'),relative=target?this.list.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(target)+'"]'):undefined;
  this.adding=!row;this.host.toggleClass('is-adding',this.adding);const editRow=this.editRow=row??this.list.createDiv({cls:'em-reader-node is-new',attr:{role:'option','aria-selected':'true'}});editRow.addClass('is-editing');
  for(const element of editRow.querySelectorAll<HTMLElement>('.em-reader-text,.em-reader-node-tools,.em-reader-connector-hint'))element.hidden=true;
  if(!row){for(const active of this.list.querySelectorAll('.is-active,.is-selected')){active.classList.remove('is-active','is-selected');active.setAttribute('aria-selected','false');}editRow.addClass('is-active');editRow.setAttribute('aria-selected','true');if(relative){if(placement==='before')relative.before(editRow);else relative.after(editRow);}else if(placement==='first')this.list.prepend(editRow);}
  const empty=this.list.querySelector<HTMLElement>('.em-reader-empty');if(empty)empty.hidden=true;
  const host=editRow.createDiv({cls:'em-reader-inline-editor'});
  try{this.editor=this.addChild(new ReaderEditor(this.app,host,value,this.app.vault.getFileByPath(this.document?.files?.[this.section!.id]??this.path)??undefined,async(text,returnFocus)=>{if(row&&text===value||!row&&!text.trim()){this.cancel(returnFocus);if(!returnFocus)this.paint();return;}await this.change(operations(text),id,returnFocus);},()=>this.cancel(),{adding:!row,pointer,singleLine:readerSingleLine(this.service.nativeHeader(this.path,this.section!.id,'eome')),remove:()=>{this.cancel();const node=this.index.byId.get(id);if(node){this.navigate(id,false);this.remove();}}}));}
  catch(error){host.remove();this.cancel();this.status.setText(t('companion.readerEditorUnavailable',{reason:errorMessage(error)}));return;}
  this.updateControls();this.editor.focus();editRow.scrollIntoView({block:'nearest'});
 }
 private cancel(focus=true):void{this.creatingUnder=undefined;this.host.removeClass('is-editing');this.host.removeClass('is-adding');if(this.editor){this.removeChild(this.editor);this.editor=undefined;}if(this.editRow){if(this.adding)this.editRow.remove();else{this.editRow.removeClass('is-editing');for(const element of this.editRow.querySelectorAll<HTMLElement>('.em-reader-text,.em-reader-node-tools,.em-reader-connector-hint'))element.hidden=false;}this.editRow=undefined;}this.adding=false;const empty=this.list.querySelector<HTMLElement>('.em-reader-empty');if(empty)empty.hidden=false;this.updateControls();if(focus){this.paint();this.focusList();}}
 async flush():Promise<void>{const pending=this.editor||this.busy;if(this.editor)await this.editor.commit();await this.busy;if(pending&&this.failure)throw this.failure;}
 async close():Promise<void>{await this.flush();this.remember();this.suspended=true;}
 retire():void{this.suspended=true;this.cancel(false);this.generation++;if(this.rowLifecycle){this.removeChild(this.rowLifecycle);this.rowLifecycle=undefined;}if(this.lifecycle){this.removeChild(this.lifecycle);this.lifecycle=undefined;}this.list.empty();this.parent.empty();this.childPane.empty();this.document=undefined;this.section=undefined;this.path='';this.level='';this.rowLevel='';this.rowRaw='';}
 private async reload():Promise<void>{const document=await this.service.readForView(this.path),section=document.sections.find(s=>s.id===this.section?.id);if(!section||document.unavailableFiles?.[section.id])throw new Error(t('companion.sectionFileMissing'));this.render(this.path,document,section,true);}
 change(operations:ThoughtOperation[],selected:string|readonly string[]=this.activeId,returnFocus=true):Promise<void>{return this.perform(()=>this.service.executeMany(this.path,operations),selected,returnFocus);}
 history(redo=false):Promise<void>{return this.perform(()=>this.service.history(this.path,redo));}
 private perform(action:()=>Promise<void>,selected:string|readonly string[]=this.activeId,returnFocus=true):Promise<void>{
  if(this.busy||this.unreadable)return Promise.resolve();this.host.setAttribute('aria-busy','true');const path=this.path,section=this.section?.id;this.busy=(async()=>{
   let failure:unknown;this.failure=undefined;try{await action();const ids=typeof selected==='string'?selected?[selected]:[]:selected;this.activeId=ids[0]??'';this.anchor=this.activeId;this.selected=new Set(ids);this.saveSelection();this.status.empty();}catch(error){failure=error;this.failure=error instanceof Error?error:new Error(errorMessage(error));}
   this.cancel(false);if(path!==this.path||section!==this.section?.id)return;
   try{await this.reload();if(failure){this.status.setText(rejectedChangeMessage(failure));this.reportError();}this.reveal();if(returnFocus)this.focusList();}
   catch(error){this.unreadable=true;this.list.empty();this.rowLevel='';this.rowRaw='';if(this.rowLifecycle){this.removeChild(this.rowLifecycle);this.rowLifecycle=undefined;}this.parent.empty();this.childPane.empty();this.status.setText(t('companion.readerReadError',{reason:String(error)}));this.reportError();const retry=this.status.createEl('button',{text:t('companion.retry')});retry.onclick=()=>{void this.reload().then(()=>this.status.empty()).catch(error=>this.status.setText(String(error)));};}
  })().finally(()=>{this.busy=undefined;this.updateControls();});return this.busy;
 }
 private menu(node:Thought,at:HTMLElement,event?:MouseEvent):void{
  if(this.editing||this.busy)return;if(!this.selected.has(node.id))this.navigate(node.id,false);const menu=new Menu(),count=this.roots().length,multiple=count>1;
  if(!multiple){
   menu.addItem(item=>item.setTitle(t('companion.editThought')).setIcon('pencil').onClick(()=>this.edit(node)));menu.addItem(item=>item.setTitle(t('companion.addSibling')).setIcon('plus').onClick(()=>this.add(node.id,'after')));menu.addItem(item=>item.setTitle(t('companion.addChild')).setIcon('corner-down-right').onClick(()=>this.add(node.id,'last')));
   menu.addItem(item=>item.setTitle(t(readerTask(node.text).state===undefined?'companion.readerTask':'companion.readerUntask')).setIcon('check-square').onClick(()=>{const task=readerTask(node.text);void this.change([{kind:'edit',id:node.id,expected:node.text,text:task.state===undefined?'[ ] '+node.text:task.body}]);}));menu.addSeparator();
  }
  menu.addItem(item=>item.setTitle(t(multiple?'companion.readerCopySelected':'companion.readerCopy',{count})).setIcon('copy').onClick(()=>{void this.copy();}));menu.addItem(item=>item.setTitle(t(multiple?'companion.readerCutSelected':'companion.readerCut',{count})).setIcon('scissors').onClick(()=>{void this.copy(true);}));menu.addItem(item=>item.setTitle(t('companion.readerPaste')).setIcon('clipboard').setDisabled(multiple).onClick(()=>{void this.readClipboard();}));menu.addItem(item=>item.setTitle(t('companion.readerMove')).setIcon('move').onClick(()=>this.moveDialog()));menu.addSeparator();menu.addItem(item=>item.setTitle(t(multiple?'companion.readerDeleteSelected':'companion.deleteThought',{count})).setIcon('trash-2').onClick(()=>this.remove()));
  menu.showAtPosition({x:event?.clientX??at.getBoundingClientRect().right,y:event?.clientY??at.getBoundingClientRect().bottom});
 }
 private roots():Thought[]{return selectionRoots(this.index,this.selected);}
 private remove():void{if(!this.document)return;const roots=this.roots(),section=this.section!,nodes=this.index.nodes.filter(node=>roots.some(root=>node.from>=root.from&&node.from<root.to)),operations:ThoughtOperation[]=roots.map(node=>({kind:'remove',id:node.id,expected:section.raw.slice(node.from,node.to)}));if(operations.length)this.dialog(new ReaderDeleteModal(this.app,nodes.length,()=>{void this.change(operations);}));}
 private moveDialog():void{const data=this.drag.data(this.activeId);if(!data||!this.document||!this.section)return;const valid=(node:Thought,placement:Placement)=>this.drag.valid(data,node.id,placement),targets=readerMoveTargets(this.index,new Set((data.nodes??[data]).map(node=>node.id)));this.dialog(new ReaderMoveModal(this.app,targets,node=>{const menu=new Menu();for(const placement of ['before','after','first','last'] as const)if(valid(node,placement))menu.addItem(item=>item.setTitle(t(`companion.reader${placement[0]!.toUpperCase()+placement.slice(1)}` as 'companion.readerBefore')).onClick(()=>{void this.drag.move(data,node.id,placement);}));menu.showAtPosition({x:this.host.getBoundingClientRect().left+20,y:this.host.getBoundingClientRect().top+30});}));}
 private dialog(modal:ReaderDeleteModal|ReaderMoveModal):void{this.dialogs.add(modal);const close=modal.onClose.bind(modal);modal.onClose=()=>{this.dialogs.delete(modal);close();};modal.open();}
 private async copy(cut=false):Promise<void>{
  const roots=this.roots();if(!roots.length)return;const nodes=this.index.nodes.filter(node=>roots.some(root=>node.from>=root.from&&node.from<root.to)),base=Math.min(...roots.map(node=>node.indent.length)),text=nodes.map(node=>encodeOutlineText(node.text,node.indent.slice(base))).join('\n');this.copied={text,nodes,cut,path:this.path};this.paint(false,true);
  try{await navigator.clipboard.writeText(text);}catch{this.status.setText(t('companion.readerInternalClipboard'));}
 }
 private async readClipboard():Promise<void>{const path=this.path,section=this.section?.id,target=this.activeId||undefined;let text='';try{text=await navigator.clipboard.readText();}catch{/* Use the internal clipboard only when the system clipboard is unavailable. */text=this.copied?.text??'';}if(path===this.path&&section===this.section?.id&&!this.editing&&!this.busy)await this.paste(text,target);}
 private async paste(text:string,target=this.activeId||undefined):Promise<void>{
  if(!text||!this.section)return;const copied=this.copied?.text.replace(/\r\n/gu,'\n')===text.replace(/\r\n/gu,'\n')?this.copied:undefined;
  if(copied?.cut&&copied.path===this.path){const selection=new Set(copied.nodes.map(node=>node.id)),nodes=selectionRoots(thoughtIndex(copied.nodes),selection);await this.change(nodes.map(node=>({kind:'move',id:node.id,expectedSection:node.section,expectedParent:node.parent,section:this.section!.id,target,placement:'last'})),nodes.map(node=>node.id));if(!this.failure){copied.cut=false;this.paint(false,true);}return;}
  if(!copied){const id=newId();await this.change([{kind:'add',section:this.section.id,target,placement:'last',text,id}],id);return;}
  const ids=new Map<string,string>(),operations:ThoughtOperation[]=[],roots:string[]=[];
  for(const node of copied.nodes){const id=newId(),parent=node.parent?ids.get(node.parent):undefined;if(!parent)roots.push(id);ids.set(node.id,id);operations.push({kind:'add',section:this.section.id,id,target:parent??target,placement:'last',text:node.text});}await this.change(operations,roots);
 }

 private searchCount():void{const count=this.matches().length;this.results.setText(this.search.value?t('companion.readerSearchCount',{count}):this.selected.size>1?t('companion.readerSelectedCount',{count:this.selected.size}):'');}
 private matches():Thought[]{const query=this.search.value.trim().toLocaleLowerCase();return query?this.index.nodes.filter(node=>this.visibility.visible.has(node.id)&&node.text.toLocaleLowerCase().includes(query)):[];}
 private find(direction:number):void{const matches=this.matches(),at=matches.findIndex(node=>node.id===this.activeId),target=matches[at<0?0:at+direction];if(target)this.navigate(target.id);}
}
