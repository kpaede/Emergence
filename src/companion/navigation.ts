import {tooltipForClippedText} from '../ui/accessibility';
import {Component,setIcon} from 'obsidian';
import {t,locale} from '../i18n';
import type {CompanionDocument,CompanionSection} from './model';
import {thoughts} from './thoughts';
import type {CompanionDrag} from './drag';
import {OutlineDrop} from './outline-drop';
import type {ThoughtOperation} from './thoughts';
import type {OutlineSizes,OutlineSizeMode} from './outline-size';
import {defaultCharacterCountOptions,type CharacterCountOptions} from './character-count';
import {countPolicyLabel} from './count-label';
export interface NavigationActions{prepare?(section:string):void;choose(section:CompanionSection):void;apply(operations:ThoughtOperation[],path:string):void|Promise<void>;openFile(section:CompanionSection):void;externalText?(event:DragEvent,destination:string):string|undefined;nativeDrag?(event:DragEvent):CompanionDrag|undefined;history?(redo:boolean,path:string):void;error?(reason:unknown):void}
interface SizeRow {row:HTMLElement;group?:HTMLElement;count?:HTMLElement;track?:HTMLElement;bar?:HTMLElement;characters?:number;percentage?:number;labelKey?:string}

/** Native Outline tree structure and theme classes; thoughts never enter this navigation tree. */
export class CompanionNavigation extends Component{
 private collapsed=new Set<string>();private lifecycle?:Component;private host:HTMLElement;
 private sizeRows=new Map<string,SizeRow>();
 private version=0;private structure='';private badges=new Map<string,HTMLElement>();private rows=new Map<string,HTMLElement>();private path='';private drops:OutlineDrop;
 get revision():number{return this.version;}
 constructor(parent:HTMLElement,private actions:NavigationActions){super();this.host=parent;this.drops=this.addChild(new OutlineDrop(parent,()=>this.path,this.rows,{apply:(operations,path)=>actions.apply(operations,path),text:(event,destination)=>actions.externalText?actions.externalText(event,destination):event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text/uri-list')||undefined,native:event=>actions.nativeDrag?.(event),focus:row=>this.focusRow(row,false),error:reason=>actions.error?.(reason),prepare:section=>actions.prepare?.(section)}));this.register(()=>{this.rows.clear();this.badges.clear();this.sizeRows.clear();});}
 render(document:CompanionDocument,selected:string,path:string,countsPending=false):void{
  this.path=path;const structure=JSON.stringify([path,locale(),document.id,document.source,document.storage?.mode,document.sections.map(section=>[section.id,section.title,section.level,section.state,section.base?.parent,section.base?.from,section.base?.line,document.files?.[section.id],document.unavailableFiles?.[section.id]?.reason,document.unavailableFiles?.[section.id]?.path])]);
  if(structure===this.structure){this.updateRows(document,selected,countsPending);return;}this.structure=structure;this.drops.clearHover();this.version++;
  const focused=this.host.ownerDocument.activeElement as HTMLElement|null,focusedRow=focused?.closest<HTMLElement>('[data-em-section]'),restore=!!focusedRow&&this.host.contains(focusedRow),focusedId=restore?focusedRow.dataset.emSection:undefined,restoreFile=restore&&focused?.classList.contains('em-companion-section-open'),unassignedOpen=this.host.querySelector('details')?.open??false;
  if(this.lifecycle)this.removeChild(this.lifecycle);const lifecycle=this.lifecycle=this.addChild(new Component());this.sizeRows.clear();this.badges.clear();this.rows.clear();this.host.empty();this.host.addClasses(['outline','em-companion-outline']);
  const tree=this.host.createDiv({cls:'tree-item-children',attr:{role:'tree','aria-label':t('companion.outline')}}),containers=new Map<number,HTMLElement>(),ancestors:number[]=[];
  const linked=document.sections.filter(s=>s.state==='linked'),selectedAt=linked.findIndex(s=>s.id===selected);let current=selectedAt<0?-1:linked[selectedAt]?.base?.parent??-1;while(current>=0){const section=linked[current];if(!section)break;this.collapsed.delete(section.id);current=section.base?.parent??-1;}
  let largestNoteCount=0;for(let index=0;index<linked.length;index++){
   const section=linked[index]!,level=section.level;while(ancestors.length&&linked[ancestors[ancestors.length-1]!]!.level>=level)ancestors.pop();
   const parent=ancestors.length?containers.get(ancestors[ancestors.length-1]!)??tree:tree,item=parent.createDiv({cls:'tree-item',attr:{role:'treeitem','aria-level':String(ancestors.length+1),'aria-selected':String(section.id===selected)}});
   const row=item.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'-1','aria-current':String(section.id===selected)}});row.dataset.emSection=section.id;this.rows.set(section.id,row);row.toggleClass('is-active',section.id===selected);
   const hasChildren=(linked[index+1]?.level??0)>level,icon=row.createDiv({cls:'tree-item-icon collapse-icon'}),text=row.createDiv({cls:'tree-item-inner',text:section.title||t('companion.untitled')});tooltipForClippedText(text,section.title);
   this.sizeRows.set(section.id,{row});
   if(hasChildren){setIcon(icon,'right-triangle');item.setAttribute('aria-expanded',String(!this.collapsed.has(section.id)));icon.toggleClass('is-collapsed',this.collapsed.has(section.id));}else icon.addClass('em-outline-leaf');
   const unavailable=!!document.unavailableFiles?.[section.id],unknown=countsPending||unavailable,count=unknown?0:thoughts(section).length;largestNoteCount=Math.max(largestNoteCount,count);const badge=row.createSpan({cls:'em-companion-outline-count',attr:{'aria-label':unknown?t('companion.countUnavailable'):t('companion.chapterThoughts',{count})}});badge.createSpan({cls:'em-companion-count-value',text:unknown?'—':String(count)});this.badges.set(section.id,badge);this.fileControls(lifecycle,row,document,section);
   const children=item.createDiv({cls:'tree-item-children',attr:{role:'group'}});children.hidden=this.collapsed.has(section.id);containers.set(index,children);ancestors.push(index);
   const toggle=()=>{children.hidden=!children.hidden;if(children.hidden)this.collapsed.add(section.id);else this.collapsed.delete(section.id);icon.toggleClass('is-collapsed',children.hidden);item.setAttribute('aria-expanded',String(!children.hidden));};
   lifecycle.registerDomEvent(icon,'click',event=>{if(!hasChildren)return;event.stopPropagation();toggle();});lifecycle.registerDomEvent(row,'click',()=>this.actions.choose(section));
   this.bindKeyboard(lifecycle,row,section,hasChildren?{children,toggle}:undefined);
   if(!unavailable)this.drops.bind(lifecycle,row,section.id,path,document.files?.[section.id]??path);
  }
  const other=document.sections.filter(s=>s.state!=='linked');if(other.length){const details=this.host.createEl('details',{cls:'em-companion-unassigned'});details.open=unassignedOpen||other.some(s=>s.id===selected);details.createEl('summary',{text:t('companion.general')});for(const section of other){const row=details.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'-1','aria-current':String(section.id===selected)}});row.createDiv({cls:'tree-item-inner',text:section.title});row.dataset.emSection=section.id;this.rows.set(section.id,row);if(section.state==='review')row.createSpan({cls:'em-companion-state',text:t('companion.review')});lifecycle.registerDomEvent(row,'click',()=>this.actions.choose(section));this.bindKeyboard(lifecycle,row,section);this.fileControls(lifecycle,row,document,section);if(!document.unavailableFiles?.[section.id])this.drops.bind(lifecycle,row,section.id,path,document.files?.[section.id]??path);}}
  this.host.style.setProperty('--em-outline-note-digits',String(String(largestNoteCount).length));const rows=this.visibleRows(),target=rows.find(row=>row.dataset.emSection===focusedId)??rows.find(row=>row.dataset.emSection===selected)??rows[0];this.roving(target);
  this.drops.refresh();if(restore&&target){const file=target.querySelector<HTMLButtonElement>('.em-companion-section-open');(restoreFile&&file&&!file.disabled?file:target).focus({preventScroll:true});}
 }
 /** Entry edits update counts in place instead of rebuilding the complete chapter tree. */
 private updateRows(document:CompanionDocument,selected:string,countsPending=false):void{
  let largest=0;for(const section of document.sections){const row=this.rows.get(section.id);if(!row)continue;const active=String(section.id===selected);if(row.getAttribute('aria-current')!==active){row.setAttribute('aria-current',active);row.toggleClass('is-active',section.id===selected);if(row.parentElement?.getAttribute('role')==='treeitem')row.parentElement.setAttribute('aria-selected',active);}const badge=this.badges.get(section.id);if(badge){const unavailable=countsPending||!!document.unavailableFiles?.[section.id],count=unavailable?0:thoughts(section).length;largest=Math.max(largest,count);const text=unavailable?'—':String(count),value=badge.querySelector('.em-companion-count-value');if(value?.textContent!==text)value?.setText(text);const label=unavailable?t('companion.countUnavailable'):t('companion.chapterThoughts',{count});if(badge.getAttribute('aria-label')!==label)badge.setAttribute('aria-label',label);}}
  const digits=String(String(largest).length);if(this.host.style.getPropertyValue('--em-outline-note-digits')!==digits)this.host.style.setProperty('--em-outline-note-digits',digits);
  const selectedRow=this.rows.get(selected);if(selectedRow){const hidden=selectedRow.closest('details');if(hidden)hidden.open=true;for(let parent=selectedRow.parentElement?.parentElement;parent&&parent!==this.host;parent=parent.parentElement)if(parent.classList.contains('tree-item-children')&&parent.hidden){parent.hidden=false;const item=parent.parentElement,row=item?.querySelector<HTMLElement>(':scope > [data-em-section]');if(row){this.collapsed.delete(row.dataset.emSection!);row.querySelector('.collapse-icon')?.removeClass('is-collapsed');item?.setAttribute('aria-expanded','true');}}}
  this.drops.refresh();if(!this.host.contains(this.host.ownerDocument.activeElement))this.roving(this.visibleRows().find(row=>row.dataset.emSection===selected));
 }
 /** Number and width updates preserve the native outline rows, focus and expansion. */
 setSizes(values:OutlineSizes|undefined,mode:OutlineSizeMode,options:CharacterCountOptions=defaultCharacterCountOptions):void{
  const language=locale(),formatter=mode==='off'?undefined:new Intl.NumberFormat(language),labelKey=language+mode+String(options.whitespace)+String(options.footnotes);
  for(const [id,item]of this.sizeRows){
   if(mode==='off'){item.group?.remove();item.group=undefined;item.count=undefined;item.track=undefined;item.bar=undefined;item.characters=undefined;item.percentage=undefined;item.labelKey=undefined;continue;}
   if(!item.count){item.group=item.row.createSpan({cls:'em-companion-size'});item.row.querySelector('.em-companion-outline-count')?.before(item.group);item.count=item.group.createSpan({cls:'em-companion-size-count'});item.track=item.group.createSpan({cls:'em-companion-size-track',attr:{'aria-hidden':'true'}});item.bar=item.track.createSpan({cls:'em-companion-size-bar'});}
   const size=values?.get(id),characters=size?.characters,percentage=size?.percentage;
   if(characters!==item.characters||labelKey!==item.labelKey){const count=characters===undefined?'—':formatter!.format(characters);item.count.setText(count+' '+t('companion.characterUnit'));item.count.dataset.emCharacters=characters===undefined?'pending':String(characters);item.count.setAttribute('aria-label',characters===undefined?t('companion.sectionSizePending'):t(mode==='subtree'?'companion.sectionSizeSubtreeLabel':'companion.sectionSizeLabel',{count})+' · '+countPolicyLabel(options));item.characters=characters;item.labelKey=labelKey;}
   item.track!.hidden=percentage===undefined;item.bar!.hidden=percentage===undefined;if(percentage!==item.percentage){item.bar!.style.width=(percentage??0)+'%';item.percentage=percentage;}
  }
 }
 private visibleRows():HTMLElement[]{return [...this.host.querySelectorAll<HTMLElement>('[data-em-section]')].filter(row=>!row.closest('[hidden]')&&row.closest('details')?.open!==false);}
 private roving(target?:HTMLElement):void{for(const row of this.host.querySelectorAll<HTMLElement>('[data-em-section]')){const tab=row===target?0:-1;if(row.tabIndex!==tab)row.tabIndex=tab;const file=row.querySelector<HTMLButtonElement>('.em-companion-section-open');if(file&&file.tabIndex!==tab)file.tabIndex=tab;}}
 private focusRow(row:HTMLElement|undefined,reveal=true):void{if(!row)return;this.roving(row);row.focus({preventScroll:true});if(reveal)row.scrollIntoView({block:'nearest'});}
 private bindKeyboard(lifecycle:Component,row:HTMLElement,section:CompanionSection,branch?:{children:HTMLElement;toggle:()=>void}):void{
  lifecycle.registerDomEvent(row,'focusin',()=>this.roving(row));
  lifecycle.registerDomEvent(row,'keydown',event=>{
   if(event.target===row&&!event.isComposing&&!event.altKey&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&this.actions.history){event.preventDefault();event.stopPropagation();const redo=event.shiftKey,path=this.path;void this.drops.flush().then(()=>this.actions.history?.(redo,path));return;}
   if(event.target!==row||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
   if(event.key==='Enter'||event.key===' '){event.preventDefault();this.actions.choose(section);return;}
   const rows=this.visibleRows(),at=rows.indexOf(row);let target:HTMLElement|undefined;
   if(event.key==='ArrowUp')target=rows[at-1];else if(event.key==='ArrowDown')target=rows[at+1];else if(event.key==='Home')target=rows[0];else if(event.key==='End')target=rows.at(-1);
   else if(event.key==='ArrowRight'){if(branch?.children.hidden)branch.toggle();else target=branch?.children.querySelector<HTMLElement>('[data-em-section]')??undefined;}
   else if(event.key==='ArrowLeft'){if(branch&&!branch.children.hidden)branch.toggle();else target=row.parentElement?.parentElement?.closest('.tree-item')?.querySelector<HTMLElement>(':scope > [data-em-section]')??undefined;}
   else return;event.preventDefault();this.focusRow(target);
  });
 }
 private fileControls(lifecycle:Component,row:HTMLElement,document:CompanionDocument,section:CompanionSection):void{
  if(document.storage?.mode!=='sections')return;const path=document.files?.[section.id],issue=document.unavailableFiles?.[section.id];row.dataset.fileState=issue?.reason??'available';
  if(issue){const status=row.createSpan({cls:'em-companion-file-status',text:t(issue.reason==='missing'?'companion.fileStatusMissing':'companion.fileStatusInvalid')});status.title=issue.path||t('companion.noFileLink');}
  const label=t('companion.openChapterFile',{title:section.title}),button=row.createEl('button',{cls:'clickable-icon em-companion-section-open',attr:{'aria-label':label,title:label+'\n'+(path??t('companion.noFileLink'))}});setIcon(button,'file-text');button.disabled=!path||issue?.reason==='missing';
  lifecycle.registerDomEvent(button,'click',event=>{event.preventDefault();event.stopPropagation();this.actions.openFile(section);});lifecycle.registerDomEvent(button,'keydown',event=>event.stopPropagation());
 }
 flush():Promise<void>{return this.drops.flush();}
 reveal(selected:string):void{this.rows.get(selected)?.scrollIntoView({block:'nearest'});}
}
