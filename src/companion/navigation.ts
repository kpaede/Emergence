import {tooltipForClippedText} from '../ui/accessibility';
import {Component,setIcon} from 'obsidian';
import {t,locale} from '../i18n';
import type {CompanionDocument,CompanionSection,NavigationHeading} from './model';
import {documentOutline} from './outline-rules';
import type {OutlineMarkerPositions} from './outline-marker-position';
import {thoughts} from './thoughts';
import type {CompanionDrag} from './drag';
import {OutlineDrop} from './outline-drop';
import type {ThoughtOperation} from './thoughts';
import type {OutlineSizes,OutlineSizeMode} from './outline-size';
import {defaultCharacterCountOptions,type CharacterCountOptions} from './character-count';
import {countPolicyLabel} from './count-label';
export interface NavigationActions{navigate?(heading:NavigationHeading):void;prepare?(section:string):void;choose(section:CompanionSection):void;apply(operations:ThoughtOperation[],path:string):void|Promise<void>;openFile(section:CompanionSection):void;externalText?(event:DragEvent,destination:string):string|undefined;nativeDrag?(event:DragEvent):CompanionDrag|undefined;history?(redo:boolean,path:string):void;error?(reason:unknown):void}
interface SizeRow {row:HTMLElement;group?:HTMLElement;count?:HTMLElement;track?:HTMLElement;bar?:HTMLElement;characters?:number;percentage?:number;labelKey?:string}

/** Native Outline tree structure and theme classes; thoughts never enter this navigation tree. */
export class CompanionNavigation extends Component{
 private collapsed=new Set<string>();private lifecycle?:Component;private host:HTMLElement;
 private sizeRows=new Map<string,SizeRow>();private markerPositions:OutlineMarkerPositions=new Map();private observer?:ResizeObserver;private observedRows:HTMLElement[]=[];
 private markerRows:{row:HTMLElement;item:HTMLElement;activate:()=>void}[]=[];
 private version=0;private structure='';private badges=new Map<string,HTMLElement>();private rows=new Map<string,HTMLElement>();private path='';private drops:OutlineDrop;
 get revision():number{return this.version;}
 get hasMarkers():boolean{return this.markerRows.length>0;}
 get markerSignature():string{return this.markerRows.map(({row})=>row.dataset.emSection).join('|');}
 setMarkerPositions(values:OutlineMarkerPositions):void{this.markerPositions=values;for(const {row}of this.markerRows)row.hidden=!values.has(row.dataset.emSection!);const visible=this.visibleRows();if(!visible.some(row=>row.tabIndex===0))this.roving(visible[0]);this.observeMarkerRows();this.markerWidths();}
 private observeMarkerRows():void{if(!this.observer)return;const rows=new Set([this.host]);for(const position of this.markerPositions.values())for(const key of [position.previous,position.next]){const row=key?this.rows.get(key):undefined;if(row)rows.add(row);}const next=[...rows];if(next.length===this.observedRows.length&&next.every((row,i)=>row===this.observedRows[i]))return;this.observedRows=next;this.observer.disconnect();for(const row of next)this.observer.observe(row);}
 constructor(parent:HTMLElement,private actions:NavigationActions){super();this.host=parent;this.drops=this.addChild(new OutlineDrop(parent,()=>this.path,this.rows,{apply:(operations,path)=>actions.apply(operations,path),text:(event,destination)=>actions.externalText?actions.externalText(event,destination):event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text/uri-list')||undefined,native:event=>actions.nativeDrag?.(event),focus:row=>this.focusRow(row,false),error:reason=>actions.error?.(reason),prepare:section=>actions.prepare?.(section)}));if(typeof ResizeObserver!=='undefined'){const observer=this.observer=new ResizeObserver(()=>this.markerWidths());observer.observe(parent);this.register(()=>observer.disconnect());}this.registerDomEvent(parent,'click',event=>this.markerClick(event),{capture:true});this.register(()=>{this.rows.clear();this.badges.clear();this.sizeRows.clear();this.markerRows=[];this.observedRows=[];});}
 render(document:CompanionDocument,selected:string,path:string,countsPending=false):void{
  if(this.path!==path)this.markerPositions=new Map();this.path=path;const linked=documentOutline(document),structure=JSON.stringify([path,locale(),document.id,document.source,document.storage?.mode,linked.map(h=>[h.key,h.title,h.level,h.kind,h.parent,h.from,h.line]),document.sections.map(section=>[section.id,section.title,section.level,section.state,document.files?.[section.id],document.unavailableFiles?.[section.id]?.reason,document.unavailableFiles?.[section.id]?.path])]);
  if(structure===this.structure){this.updateRows(document,selected,countsPending);return;}this.structure=structure;this.drops.clearHover();this.version++;
  const focused=this.host.ownerDocument.activeElement as HTMLElement|null,focusedRow=focused?.closest<HTMLElement>('[data-em-section]'),restore=!!focusedRow&&this.host.contains(focusedRow),focusedId=restore?focusedRow.dataset.emSection:undefined,restoreFile=restore&&focused?.classList.contains('em-companion-section-open'),unassignedOpen=this.host.querySelector('details')?.open??false;
  if(this.lifecycle)this.removeChild(this.lifecycle);const lifecycle=this.lifecycle=this.addChild(new Component());this.sizeRows.clear();this.badges.clear();this.rows.clear();this.markerRows=[];this.host.empty();this.host.addClasses(['outline','em-companion-outline']);
  const tree=this.host.createDiv({cls:'tree-item-children',attr:{role:'tree','aria-label':t('companion.outline')}}),containers=new Map<number,HTMLElement>(),parents=new Set(linked.filter(h=>h.kind!=='marker').map(h=>h.parent)),byId=new Map(document.sections.map(s=>[s.id,s]));
  let current=linked.find(h=>h.key===selected)?.parent??-1;while(current>=0){const heading=linked[current];if(!heading)break;this.collapsed.delete(heading.key);current=heading.parent;}
  let largestNoteCount=0;const depths:number[]=[];
  for(let index=0;index<linked.length;index++){
   const heading=linked[index]!;depths[index]=(depths[heading.parent]??0)+1;const section=heading.kind==='section'&&heading.section?byId.get(heading.section):undefined,parent=containers.get(heading.parent)??tree,item=parent.createDiv({cls:'tree-item',attr:{role:'treeitem','aria-selected':String(heading.key===selected),'aria-level':String(depths[index])}}),activate=()=>section?this.actions.choose(section):this.actions.navigate?.(heading);
   if(heading.kind==='marker'){
    item.addClass('em-companion-marker-item');if(heading.parent>=0&&parent.parentElement?.classList.contains('tree-item'))parent.parentElement.insertBefore(item,parent);const row=item.createEl('button',{cls:'tree-item-self em-companion-marker',attr:{type:'button',tabindex:'-1','aria-label':t('companion.positionMarkerLabel',{title:heading.title})}});row.dataset.emSection=heading.key;row.hidden=!this.markerPositions.has(heading.key);row.createSpan({cls:'em-companion-marker-line',attr:{'aria-hidden':'true'}});this.rows.set(heading.key,row);this.markerRows.push({row,item,activate});lifecycle.registerDomEvent(row,'click',activate);this.bindKeyboard(lifecycle,row,activate);continue;
   }
   const row=item.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'-1','aria-current':String(heading.key===selected)}});row.dataset.emSection=heading.key;this.rows.set(heading.key,row);row.toggleClass('is-active',heading.key===selected);if(heading.kind==='excluded')row.dataset.emOutlineKind='excluded';
   const hasChildren=parents.has(index),icon=row.createDiv({cls:'tree-item-icon collapse-icon'}),text=row.createDiv({cls:'tree-item-inner',text:heading.title||t('companion.untitled')});tooltipForClippedText(text,heading.title);
   if(hasChildren){setIcon(icon,'right-triangle');item.setAttribute('aria-expanded',String(!this.collapsed.has(heading.key)));icon.toggleClass('is-collapsed',this.collapsed.has(heading.key));}else icon.addClass('em-outline-leaf');
   if(section){
    this.sizeRows.set(section.id,{row});const unavailable=!!document.unavailableFiles?.[section.id],unknown=countsPending||unavailable,count=unknown?0:thoughts(section).length;largestNoteCount=Math.max(largestNoteCount,count);
    const badge=row.createSpan({cls:'em-companion-outline-count',attr:{'aria-label':unknown?t('companion.countUnavailable'):t('companion.chapterThoughts',{count})}});badge.createSpan({cls:'em-companion-count-value',text:unknown?'—':String(count)});this.badges.set(section.id,badge);this.fileControls(lifecycle,row,document,section);if(!unavailable)this.drops.bind(lifecycle,row,section.id,path,document.files?.[section.id]??path);
   }
   const children=item.createDiv({cls:'tree-item-children',attr:{role:'group'}});children.hidden=hasChildren&&this.collapsed.has(heading.key);containers.set(index,children);
   const toggle=()=>{children.hidden=!children.hidden;if(children.hidden)this.collapsed.add(heading.key);else this.collapsed.delete(heading.key);icon.toggleClass('is-collapsed',children.hidden);item.setAttribute('aria-expanded',String(!children.hidden));this.markerWidths();};
   lifecycle.registerDomEvent(icon,'click',event=>{if(!hasChildren)return;event.stopPropagation();toggle();});lifecycle.registerDomEvent(row,'click',activate);this.bindKeyboard(lifecycle,row,activate,hasChildren?{children,toggle}:undefined);
  }
  const other=document.sections.filter(s=>s.state!=='linked'&&(s.state!=='excluded'||s.raw.trim()||document.unavailableFiles?.[s.id]));if(other.length){const details=this.host.createEl('details',{cls:'em-companion-unassigned'});details.open=unassignedOpen||other.some(s=>s.id===selected);details.createEl('summary',{text:t('companion.general')});for(const section of other){const row=details.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'-1','aria-current':String(section.id===selected)}});row.createDiv({cls:'tree-item-inner',text:section.title});row.dataset.emSection=section.id;this.rows.set(section.id,row);if(section.state==='review'||section.state==='excluded')row.createSpan({cls:'em-companion-state',text:t(section.state==='excluded'?'companion.excludedNotes':'companion.review')});const activate=()=>this.actions.choose(section);lifecycle.registerDomEvent(row,'click',activate);this.bindKeyboard(lifecycle,row,activate);this.fileControls(lifecycle,row,document,section);if(section.state!=='excluded'&&!document.unavailableFiles?.[section.id])this.drops.bind(lifecycle,row,section.id,path,document.files?.[section.id]??path);}}
  this.host.style.setProperty('--em-outline-note-digits',String(String(largestNoteCount).length));const rows=this.visibleRows(),target=rows.find(row=>row.dataset.emSection===focusedId)??rows.find(row=>row.dataset.emSection===selected)??rows[0];this.roving(target);
  this.drops.refresh();this.observeMarkerRows();this.markerWidths();if(restore&&target){const file=target.querySelector<HTMLButtonElement>('.em-companion-section-open');(restoreFile&&file&&!file.disabled?file:target).focus({preventScroll:true});}
 }
 /** The boundary has no layout height. Click tolerance uses existing row padding;
  * pointer events pass through the line so normal drag targets remain intact. */
 private markerClick(event:MouseEvent):void{
  if(!event.detail||event.button!==0||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!this.markerRows.length)return;
  const target=event.target as HTMLElement|null;if(target?.closest('button,a,input,select,textarea,.collapse-icon'))return;
  for(const {row,item,activate}of this.markerRows){
   if(item.closest('[hidden]'))continue;const rect=row.getBoundingClientRect();
   if(rect.width<=0||event.clientX<rect.left||event.clientX>rect.right||Math.abs(event.clientY-rect.top)>5)continue;
   event.preventDefault();event.stopPropagation();activate();return;
  }
 }
 /** Interpolate over native row geometry; keep the tree's own indentation and spacing. */
 private markerWidths():void{
  if(!this.markerRows.length)return;const bounds=this.host.getBoundingClientRect(),rtl=this.host.ownerDocument.defaultView?.getComputedStyle(this.host).direction==='rtl';
  for(const {row,item}of this.markerRows){if(item.closest('[hidden]'))continue;const rect=item.getBoundingClientRect(),inset=Math.max(0,rtl?bounds.right-rect.right:rect.left-bounds.left),value=inset+'px';if(row.style.getPropertyValue('--em-marker-inset')!==value)row.style.setProperty('--em-marker-inset',value);const position=this.markerPositions.get(row.dataset.emSection!);if(!position)continue;const previousElement=position.previous?this.rows.get(position.previous):undefined,nextElement=position.next?this.rows.get(position.next):undefined,previous=previousElement?.getBoundingClientRect(),next=nextElement&&!nextElement.closest('[hidden]')?nextElement.getBoundingClientRect():undefined,top=previous?previous.top+position.fraction*((next?.top??previous.bottom)-previous.top):next?.top??rect.top,offset=(top-rect.top)+'px';if(row.style.getPropertyValue('--em-marker-offset')!==offset)row.style.setProperty('--em-marker-offset',offset);}
 }
 /** Entry edits update counts in place instead of rebuilding the complete chapter tree. */
 private updateRows(document:CompanionDocument,selected:string,countsPending=false):void{
  for(const [key,row]of this.rows){const active=key===selected;row.setAttribute('aria-current',String(active));row.toggleClass('is-active',active);if(row.parentElement?.getAttribute('role')==='treeitem')row.parentElement.setAttribute('aria-selected',String(active));}
  let largest=0;for(const section of document.sections){const row=this.rows.get(section.id);if(!row)continue;const badge=this.badges.get(section.id);if(badge){const unavailable=countsPending||!!document.unavailableFiles?.[section.id],count=unavailable?0:thoughts(section).length;largest=Math.max(largest,count);const text=unavailable?'—':String(count),value=badge.querySelector('.em-companion-count-value');if(value?.textContent!==text)value?.setText(text);const label=unavailable?t('companion.countUnavailable'):t('companion.chapterThoughts',{count});if(badge.getAttribute('aria-label')!==label)badge.setAttribute('aria-label',label);}}
  const digits=String(String(largest).length);if(this.host.style.getPropertyValue('--em-outline-note-digits')!==digits)this.host.style.setProperty('--em-outline-note-digits',digits);
  let expanded=false;const selectedRow=this.rows.get(selected);if(selectedRow){const hidden=selectedRow.closest('details');if(hidden)hidden.open=true;for(let parent=selectedRow.parentElement?.parentElement;parent&&parent!==this.host;parent=parent.parentElement)if(parent.classList.contains('tree-item-children')&&parent.hidden){parent.hidden=false;expanded=true;const item=parent.parentElement,row=item?.querySelector<HTMLElement>(':scope > [data-em-section]');if(row){this.collapsed.delete(row.dataset.emSection!);row.querySelector('.collapse-icon')?.removeClass('is-collapsed');item?.setAttribute('aria-expanded','true');}}}
  this.drops.refresh();if(expanded)this.markerWidths();if(!this.host.contains(this.host.ownerDocument.activeElement))this.roving(this.visibleRows().find(row=>row.dataset.emSection===selected));
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
 private bindKeyboard(lifecycle:Component,row:HTMLElement,activate:()=>void,branch?:{children:HTMLElement;toggle:()=>void}):void{
  lifecycle.registerDomEvent(row,'focusin',()=>this.roving(row));
  lifecycle.registerDomEvent(row,'keydown',event=>{
   if(event.target===row&&!event.isComposing&&!event.altKey&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&this.actions.history){event.preventDefault();event.stopPropagation();const redo=event.shiftKey,path=this.path;void this.drops.flush().then(()=>this.actions.history?.(redo,path));return;}
   if(event.target!==row||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
   if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();return;}
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
