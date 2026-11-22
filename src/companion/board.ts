import {Component,MarkdownRenderer,Menu,setIcon,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {iconButton} from '../ui/panel';
import {COMPANION_DRAG,dragOperations,type CompanionDrag} from './drag';
import {thoughtIndex,branchPath,selectionRoots,columnWindow,type ThoughtIndex} from './board-model';
import {ThoughtInput} from './input';
import {thoughts,type Placement,type ThoughtOperation} from './thoughts';
import type {CompanionDocument,CompanionSection,Thought} from './model';
import type {CompanionDraft} from './service';

interface BoardActions{edit(node:Thought):void;add(section:string,target?:string,placement?:Placement):void;remove(node:Thought):void;move(operations:ThoughtOperation[]):void;clearSearch():void;closed():void}
interface EditActions{changed(draft:CompanionDraft):void;save(text:string,asNew:boolean):Promise<void>;discard():void}
/** Kanban columns are root thought groups; every descendant stays inside its own group. */
export class ThoughtBoard extends Component{
 private document?:CompanionDocument;private section?:CompanionSection;private query='';private index:ThoughtIndex=thoughtIndex([]);private lifecycle?:Component;
 private focusBySection=new Map<string,string>();private selected=new Set<string>();private selectionSection='';private anchor?:string;private pages=new Map<string,number>();private clickTimer?:number;
 private input?:ThoughtInput;private editorCard?:HTMLElement;private editorPlaceholder?:HTMLElement;private generation=0;private pendingFocus=false;private collapsed=new Set<string>();private rootOf=new Map<string,string>();private depths=new Map<string,number>();
 constructor(private app:App,readonly host:HTMLElement,private path:()=>string,private actions:BoardActions){super();this.register(()=>{if(this.clickTimer)window.clearTimeout(this.clickTimer);});if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(()=>{if(!this.input)this.scrollFocus();});observer.observe(host);this.register(()=>observer.disconnect());}}
 get editing():boolean{return !!this.input;}
 get focused():string{return this.focusBySection.get(this.section?.id??'')??'';}
 render(document:CompanionDocument,section:CompanionSection,query:string):void{
  if(this.input)return;this.document=document;this.section=section;this.query=query;this.index=thoughtIndex(thoughts(section));this.rootOf.clear();this.depths.clear();for(const node of this.index.nodes){this.rootOf.set(node.id,node.parent?this.rootOf.get(node.parent)??node.id:node.id);this.depths.set(node.id,node.parent?(this.depths.get(node.parent)??0)+1:0);}
  if(this.selectionSection!==section.id){this.selected.clear();this.anchor=undefined;this.selectionSection=section.id;}
  for(const id of this.selected)if(!this.index.byId.has(id))this.selected.delete(id);
  if(!this.index.byId.has(this.focused))this.focusBySection.set(section.id,this.index.children.get('')?.[0]?.id??'');
  this.paint();
 }
 private paint():void{
  if(!this.document||!this.section||this.input)return;const generation=++this.generation;if(this.lifecycle)this.removeChild(this.lifecycle);const lifecycle=this.lifecycle=this.addChild(new Component());this.host.empty();this.host.addClass('em-companion-board');
  const title=this.host.createDiv({cls:'em-companion-board-heading'});title.createEl('h3',{text:this.section.title});title.createSpan({cls:'em-muted',text:t('companion.chapterThoughts',{count:this.index.nodes.length})});
  const trail=this.host.createDiv({cls:'em-companion-breadcrumb',attr:{'aria-label':t('companion.thoughts')}});iconButton(trail,'house',t('companion.backToRoot'),()=>this.focus(''));
  const path=branchPath(this.index,this.focused);trail.hidden=path.length<2;for(const node of path.slice(-5)){const button=trail.createEl('button',{text:node.text.replace(/\[([^\]]+)\]\([^)]*\)/gu,'$1').slice(0,55)||t('companion.untitled'),attr:{title:node.text}});button.onclick=()=>this.focus(node.id);}
  const columns=this.host.createDiv({cls:'em-companion-columns'}),roots=this.index.children.get('')??[],matching=this.query?new Set(this.index.nodes.filter(node=>node.text.toLocaleLowerCase().includes(this.query.toLocaleLowerCase())).map(node=>this.rootOf.get(node.id))):undefined,groups=matching?roots.filter(root=>matching.has(root.id)):roots;
  const rootPage=columnWindow(groups,this.rootOf.get(this.focused)??'',this.pages.get('root-groups'),6);
  if(rootPage.start||rootPage.end<rootPage.total){const paging=title.createDiv({cls:'em-companion-group-pages'});if(rootPage.start)iconButton(paging,'chevron-left',t('companion.previousPage'),()=>{this.pages.set('root-groups',Math.max(0,rootPage.start-6));this.paint();});if(rootPage.end<rootPage.total)iconButton(paging,'chevron-right',t('companion.nextPage'),()=>{this.pages.set('root-groups',rootPage.start+6);this.paint();});}
  iconButton(title,'plus',t('companion.newThoughtGroup'),()=>this.actions.add(this.section!.id));
  if(!groups.length)columns.createDiv({cls:'em-companion-column-empty',text:t(this.query?'companion.noResults':'companion.noThoughts')});
  const found=this.query?new Set(this.index.nodes.filter(node=>node.text.toLocaleLowerCase().includes(this.query.toLocaleLowerCase())).flatMap(node=>branchPath(this.index,node.id).map(parent=>parent.id))):undefined;for(const root of rootPage.nodes){const nodes=this.index.nodes.filter(node=>this.rootOf.get(node.id)===root.id&&(!found||found.has(node.id))&&(!!this.query||!branchPath(this.index,node.id).slice(0,-1).some(parent=>this.collapsed.has(parent.id))));this.column(columns,lifecycle,generation,nodes,root);}
  if(this.pendingFocus){this.pendingFocus=false;this.host.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(this.focused)+'"]')?.focus({preventScroll:true});}
  this.scrollFocus();
 }
 private scrollFocus():void{const columns=this.host.querySelector<HTMLElement>('.em-companion-columns'),card=this.host.querySelector<HTMLElement>('.em-companion-card.is-focused'),column=card?.closest<HTMLElement>('.em-companion-column');if(!columns||!card||!column)return;columns.scrollLeft=Math.max(0,column.offsetLeft-(columns.clientWidth-column.clientWidth)/2);const list=card.parentElement;if(list){if(card.offsetTop<list.scrollTop)list.scrollTop=card.offsetTop;else if(card.offsetTop+card.offsetHeight>list.scrollTop+list.clientHeight)list.scrollTop=card.offsetTop+card.offsetHeight-list.clientHeight;}}
 private column(host:HTMLElement,lifecycle:Component,generation:number,nodes:Thought[],root:Thought):void{
  const column=host.createDiv({cls:'em-companion-column'});column.dataset.emParent=root.id;const header=column.createDiv({cls:'em-companion-column-heading'});this.card(header,lifecycle,generation,root,!!this.query);header.addClass('em-companion-group-header');
  const list=column.createDiv({cls:'em-companion-card-list',attr:{role:'list','aria-label':root.text}}),pageKey=this.section!.id+'|'+root.id,page=columnWindow(nodes.filter(node=>node.id!==root.id),this.query?nodes.find(node=>node.text.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()))?.id??this.focused:this.focused,this.pages.get(pageKey));
  const paging=(direction:-1|1)=>{this.pages.set(pageKey,Math.max(0,page.start+60*direction));this.paint();};
  if(page.start){const previous=list.createEl('button',{cls:'em-companion-page',text:t('companion.previousPage')});previous.onclick=()=>paging(-1);}
  for(const node of page.nodes)this.card(list,lifecycle,generation,node,!!this.query);
  if(page.end<page.total){const next=list.createEl('button',{cls:'em-companion-page',text:t('companion.nextPage')});next.onclick=()=>paging(1);}
  if(page.total>60)list.createDiv({cls:'em-muted em-companion-page-range',text:t('companion.pageRange',{from:page.start+1,to:page.end,total:page.total})});
  const add=column.createEl('button',{cls:'em-companion-add',text:t('companion.addChild')});add.onclick=()=>this.actions.add(this.section!.id,root.id,'last');
  lifecycle.registerDomEvent(list,'dragover',event=>{if(event.dataTransfer?.types.includes(COMPANION_DRAG))event.preventDefault();});lifecycle.registerDomEvent(list,'drop',event=>{event.preventDefault();this.drop(event,root.id,'last');});
  lifecycle.registerDomEvent(header,'dragover',event=>{if(event.dataTransfer?.types.includes(COMPANION_DRAG))event.preventDefault();});lifecycle.registerDomEvent(header,'drop',event=>{event.preventDefault();try{const data=JSON.parse(event.dataTransfer?.getData(COMPANION_DRAG)??'null') as CompanionDrag|null;if(data?.path!==this.path())return;const box=header.getBoundingClientRect(),placement:Placement=data.parent?'last':event.clientX<box.left+box.width/2?'before':'after';this.actions.move(dragOperations(data,this.section!.id,root.id,placement));}catch{/* Unrelated drag. */}});
 }
 private card(host:HTMLElement,lifecycle:Component,generation:number,node:Thought,search:boolean):void{
  const card=host.createDiv({cls:'em-companion-card',attr:{tabindex:'0',role:'listitem','aria-label':node.text,'aria-selected':String(this.selected.has(node.id))}});card.dataset.emNote=node.id;card.style.setProperty('--em-thought-depth',String(Math.min(6,this.depths.get(node.id)??0)));card.title=branchPath(this.index,node.id).slice(-5).map(item=>item.text).join(' › ');card.toggleClass('is-focused',node.id===this.focused);card.toggleClass('is-selected',this.selected.has(node.id));card.toggleClass('is-search-match',!!this.query&&node.text.toLocaleLowerCase().includes(this.query.toLocaleLowerCase()));
  const header=card.createDiv({cls:'em-companion-card-header'}),grip=iconButton(header,'grip-vertical',t('companion.moveThought'),()=>{});grip.addClass('em-companion-drag');grip.draggable=true;const depth=this.depths.get(node.id)??0;if(depth)header.createSpan({cls:'em-companion-depth',text:'↳ '+String(depth),attr:{title:card.title}});
  const children=this.index.children.get(node.id)??[];if(children.length){const open=header.createEl('button',{cls:'em-companion-child-count',text:String(children.length),attr:{'aria-label':t('companion.openChildren')}});setIcon(open.createSpan(),'chevron-right');open.onclick=event=>{event.stopPropagation();if(this.collapsed.has(node.id))this.collapsed.delete(node.id);else this.collapsed.add(node.id);open.setAttribute('aria-expanded',String(!this.collapsed.has(node.id)));this.paint();};}
  iconButton(header,'ellipsis',t('companion.cardActions'),()=>{const menu=new Menu();menu.addItem(item=>item.setTitle(t('companion.editThought')).setIcon('pencil').onClick(()=>this.actions.edit(node)));menu.addItem(item=>item.setTitle(t('companion.addChild')).setIcon('corner-down-right').onClick(()=>this.actions.add(node.section,node.id,'last')));menu.addItem(item=>item.setTitle(t('companion.addSibling')).setIcon('plus').onClick(()=>this.actions.add(node.section,node.id,'after')));menu.addSeparator();menu.addItem(item=>item.setTitle(t('companion.deleteThought')).setIcon('trash-2').onClick(()=>this.actions.remove(node)));menu.showAtPosition({x:card.getBoundingClientRect().right-30,y:card.getBoundingClientRect().top+25});});
  const text=card.createDiv({cls:'em-companion-thought markdown-rendered'});void MarkdownRenderer.render(this.app,node.text||'…',text,this.document!.files?.[node.section]??this.path(),lifecycle).then(()=>{if(generation!==this.generation)return;for(const link of text.querySelectorAll('a'))link.addEventListener('click',event=>event.stopPropagation());}).catch(()=>{if(generation===this.generation)text.setText(node.text);});
  lifecycle.registerDomEvent(header,'click',event=>event.stopPropagation());
  lifecycle.registerDomEvent(card,'click',event=>{if((event.target as HTMLElement).closest('button,a,input,textarea'))return;this.select(node,event);if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){if(this.clickTimer)window.clearTimeout(this.clickTimer);this.clickTimer=window.setTimeout(()=>{this.clickTimer=undefined;if(search){this.query='';this.actions.clearSearch();}this.focus(node.id);},220);}});
  lifecycle.registerDomEvent(card,'dblclick',event=>{if((event.target as HTMLElement).closest('button,a,input,textarea'))return;if(this.clickTimer)window.clearTimeout(this.clickTimer);event.preventDefault();this.actions.edit(node);});
  lifecycle.registerDomEvent(card,'keydown',event=>this.key(event,node));
  lifecycle.registerDomEvent(grip,'keydown',event=>{if(event.altKey&&event.key.startsWith('Arrow')){event.stopPropagation();this.key(event,node,true);}});
  lifecycle.registerDomEvent(grip,'dragstart',event=>{event.stopPropagation();if(!this.selected.has(node.id)){this.selected.clear();this.selected.add(node.id);this.paintSelection();}const nodes=selectionRoots(this.index,this.selected).map(item=>({id:item.id,section:item.section,parent:item.parent}));event.dataTransfer?.setData(COMPANION_DRAG,JSON.stringify({path:this.path(),id:node.id,section:node.section,parent:node.parent,nodes}));if(event.dataTransfer)event.dataTransfer.effectAllowed='move';});
  const placement=(event:DragEvent):Placement=>{const box=card.getBoundingClientRect(),y=(event.clientY-box.top)/box.height;return y<.25?'before':y>.75?'after':event.clientX<box.left+box.width/2?'first':'last';};
  lifecycle.registerDomEvent(card,'dragover',event=>{if(!event.dataTransfer?.types.includes(COMPANION_DRAG))return;event.preventDefault();event.stopPropagation();card.dataset.emDrop=placement(event);});lifecycle.registerDomEvent(card,'dragleave',()=>{delete card.dataset.emDrop;});lifecycle.registerDomEvent(card,'drop',event=>{event.preventDefault();event.stopPropagation();delete card.dataset.emDrop;this.drop(event,node.id,placement(event));});
 }
 private select(node:Thought,event:MouseEvent):void{
  if(event.ctrlKey||event.metaKey){if(this.selected.has(node.id))this.selected.delete(node.id);else this.selected.add(node.id);}
  else if(event.shiftKey&&this.anchor){const a=this.index.nodes.findIndex(n=>n.id===this.anchor),b=this.index.nodes.indexOf(node);for(const item of this.index.nodes.slice(Math.min(a,b),Math.max(a,b)+1))this.selected.add(item.id);}
  else{this.selected.clear();this.selected.add(node.id);}this.anchor=node.id;this.paintSelection();
 }
 private paintSelection():void{for(const card of this.host.querySelectorAll<HTMLElement>('[data-em-note]')){const selected=this.selected.has(card.dataset.emNote??'');card.toggleClass('is-selected',selected);card.setAttribute('aria-selected',String(selected));}}
 private focus(id:string,keyboard=false):void{if(!this.section||this.input)return;this.focusBySection.set(this.section.id,id);for(const parent of branchPath(this.index,id).slice(0,-1))this.collapsed.delete(parent.id);this.pages.clear();this.pendingFocus=keyboard;this.paint();}
 private key(event:KeyboardEvent,node:Thought,fromGrip=false):void{
  if(this.input||!fromGrip&&(event.target as HTMLElement).closest('button,input,textarea,.cm-editor'))return;const siblings=this.index.children.get(node.parent??'')??[],at=siblings.findIndex(item=>item.id===node.id);let target:Thought|undefined;
  if(event.altKey&&event.key.startsWith('Arrow')){event.preventDefault();let placement:Placement='before';if(event.key==='ArrowUp')target=siblings[at-1];else if(event.key==='ArrowDown'){target=siblings[at+1];placement='after';}else if(event.key==='ArrowRight'){target=siblings[at-1];placement='last';}else if(node.parent){target=this.index.byId.get(node.parent);placement='after';}if(target)this.actions.move([{kind:'move',id:node.id,section:node.section,target:target.id,placement,expectedSection:node.section,expectedParent:node.parent}]);return;}
  if(event.key==='Enter'){event.preventDefault();if(event.ctrlKey||event.metaKey)this.actions.add(node.section,node.id,'after');else this.actions.edit(node);return;}
  if(event.key==='ArrowUp')target=siblings[at-1];else if(event.key==='ArrowDown')target=siblings[at+1];else if(event.key==='ArrowLeft'&&node.parent)target=this.index.byId.get(node.parent);else if(event.key==='ArrowRight')target=this.index.children.get(node.id)?.[0];else return;
  if(target){event.preventDefault();this.focus(target.id,true);}
 }
 private drop(event:DragEvent,target:string|undefined,placement:Placement):void{try{const data=JSON.parse(event.dataTransfer?.getData(COMPANION_DRAG)??'null') as CompanionDrag|null;if(data?.path===this.path())this.actions.move(dragOperations(data,this.section!.id,target,placement));}catch{/* Unrelated drag. */}}
 beginEdit(draft:CompanionDraft,file:TFile|undefined,actions:EditActions,target?:string,placement:Placement='last'):void{
  this.closeEditor(false);if(!this.section)return;if(this.clickTimer)window.clearTimeout(this.clickTimer);
  let card=draft.id?this.host.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(draft.id)+'"]'):undefined;
  if(!card&&draft.id){this.focus(draft.id);card=this.host.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(draft.id)+'"]');}
  if(!card){
   if(target)this.focus(target);const relative=target?this.host.querySelector<HTMLElement>('[data-em-note="'+CSS.escape(target)+'"]'):null;let list=relative?.parentElement;
   if(!list){const columns=this.host.querySelector<HTMLElement>('.em-companion-columns')??this.host,column=columns.createDiv({cls:'em-companion-column'});column.createDiv({cls:'em-companion-column-heading',text:t('companion.newThoughtGroup')});list=column.createDiv({cls:'em-companion-card-list'});}
   card=list.createDiv({cls:'em-companion-card is-new'});this.editorPlaceholder=card;const depth=target?(this.depths.get(target)??0)+(placement==='first'||placement==='last'?1:0):0;card.style.setProperty('--em-thought-depth',String(Math.min(depth,6)));
   if(relative){let after:Element|null=relative;if(placement==='last'){const node=this.index.byId.get(target!);if(node)for(const candidate of list.querySelectorAll<HTMLElement>('[data-em-note]')){const descendant=this.index.byId.get(candidate.dataset.emNote??'');if(descendant&&descendant.from>node.from&&descendant.from<node.to)after=candidate;}}list.insertBefore(card,placement==='before'?relative:after.nextSibling);}
  }
  this.editorCard=card;card.addClass('is-editing');for(const child of card.children)(child as HTMLElement).hidden=true;const host=card.createDiv();
  this.input=this.addChild(new ThoughtInput(this.app,host,draft,file,{...actions,close:()=>this.closeEditor()}));this.input.focus();card.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 closeEditor(notify=true):void{if(!this.input)return;this.removeChild(this.input);this.input.host.remove();this.input=undefined;if(this.editorPlaceholder)this.editorPlaceholder.remove();else if(this.editorCard){this.editorCard.removeClass('is-editing');for(const child of this.editorCard.children)(child as HTMLElement).hidden=false;}this.editorCard=undefined;this.editorPlaceholder=undefined;if(notify){this.actions.closed();this.paint();}}
}
