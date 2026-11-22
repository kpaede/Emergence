import {Component,setIcon} from 'obsidian';
import {t} from '../i18n';
import type {CompanionDocument,CompanionSection} from './model';
import {thoughts} from './thoughts';
import {dragOperations,type CompanionDrag,COMPANION_DRAG} from './drag';
import type {ThoughtOperation} from './thoughts';

/** Native Outline tree structure and theme classes; thoughts never enter this navigation tree. */
export class CompanionNavigation extends Component{
 private collapsed=new Set<string>();private lifecycle?:Component;private host:HTMLElement;
 constructor(parent:HTMLElement,private choose:(section:CompanionSection)=>void,private move:(operations:ThoughtOperation[])=>void,private openFile:(section:CompanionSection)=>void){super();this.host=parent;}
 render(document:CompanionDocument,selected:string,path:string):void{
  if(this.lifecycle)this.removeChild(this.lifecycle);const lifecycle=this.lifecycle=this.addChild(new Component());this.host.empty();this.host.addClasses(['outline','em-companion-outline']);
  const tree=this.host.createDiv({cls:'tree-item-children',attr:{role:'tree','aria-label':t('companion.outline')}}),containers=new Map<number,HTMLElement>(),ancestors:number[]=[];
  const linked=document.sections.filter(s=>s.state==='linked');let current=linked.findIndex(s=>s.id===selected);while(current>=0){const section=linked[current];if(!section)break;this.collapsed.delete(section.id);current=section.base?.parent??-1;}
  for(let index=0;index<linked.length;index++){
   const section=linked[index]!,level=section.level;while(ancestors.length&&linked[ancestors[ancestors.length-1]!]!.level>=level)ancestors.pop();
   const parent=ancestors.length?containers.get(ancestors[ancestors.length-1]!)??tree:tree,item=parent.createDiv({cls:'tree-item',attr:{role:'treeitem','aria-level':String(ancestors.length+1),'aria-selected':String(section.id===selected)}});
   const row=item.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'0','aria-current':String(section.id===selected)}});row.dataset.emSection=section.id;row.toggleClass('is-active',section.id===selected);
   const hasChildren=(linked[index+1]?.level??0)>level,icon=row.createDiv({cls:'tree-item-icon collapse-icon'}),text=row.createDiv({cls:'tree-item-inner',text:section.title||t('companion.untitled')});text.title=section.title;
   if(hasChildren){setIcon(icon,'right-triangle');item.setAttribute('aria-expanded',String(!this.collapsed.has(section.id)));icon.toggleClass('is-collapsed',this.collapsed.has(section.id));}else icon.addClass('em-outline-leaf');
   const unavailable=!!document.unavailableFiles?.[section.id],count=unavailable?0:thoughts(section).length;row.createSpan({cls:'em-companion-outline-count',text:unavailable?'—':String(count),attr:{'aria-label':unavailable?t('companion.countUnavailable'):t('companion.chapterThoughts',{count})}});this.fileControls(lifecycle,row,document,section);
   const children=item.createDiv({cls:'tree-item-children',attr:{role:'group'}});children.hidden=this.collapsed.has(section.id);containers.set(index,children);ancestors.push(index);
   const toggle=()=>{children.hidden=!children.hidden;if(children.hidden)this.collapsed.add(section.id);else this.collapsed.delete(section.id);icon.toggleClass('is-collapsed',children.hidden);item.setAttribute('aria-expanded',String(!children.hidden));};
   lifecycle.registerDomEvent(icon,'click',event=>{if(!hasChildren)return;event.stopPropagation();toggle();});lifecycle.registerDomEvent(row,'click',()=>this.choose(section));
   lifecycle.registerDomEvent(row,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.choose(section);}else if(hasChildren&&((event.key==='ArrowLeft'&&!children.hidden)||(event.key==='ArrowRight'&&children.hidden))){event.preventDefault();toggle();}});
   if(!unavailable)this.drop(lifecycle,row,section,path);
  }
  const other=document.sections.filter(s=>s.state!=='linked');if(other.length){const details=this.host.createEl('details',{cls:'em-companion-unassigned'});details.open=other.some(s=>s.id===selected);details.createEl('summary',{text:t('companion.general')});for(const section of other){const row=details.createDiv({cls:'tree-item-self is-clickable em-companion-section',attr:{tabindex:'0','aria-current':String(section.id===selected)}});row.createDiv({cls:'tree-item-inner',text:section.title});row.dataset.emSection=section.id;if(section.state==='review')row.createSpan({cls:'em-companion-state',text:t('companion.review')});lifecycle.registerDomEvent(row,'click',()=>this.choose(section));lifecycle.registerDomEvent(row,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.choose(section);}});this.fileControls(lifecycle,row,document,section);if(!document.unavailableFiles?.[section.id])this.drop(lifecycle,row,section,path);}}
 }
 private fileControls(lifecycle:Component,row:HTMLElement,document:CompanionDocument,section:CompanionSection):void{
  if(document.storage?.mode!=='sections')return;const path=document.files?.[section.id],issue=document.unavailableFiles?.[section.id];row.dataset.fileState=issue?.reason??'available';
  if(issue){const status=row.createSpan({cls:'em-companion-file-status',text:t(issue.reason==='missing'?'companion.fileStatusMissing':'companion.fileStatusInvalid')});status.title=issue.path||t('companion.noFileLink');}
  const label=t('companion.openChapterFile',{title:section.title}),button=row.createEl('button',{cls:'clickable-icon em-companion-section-open',attr:{'aria-label':label,title:label+'\n'+(path??t('companion.noFileLink'))}});setIcon(button,'file-text');button.disabled=!path||issue?.reason==='missing';
  lifecycle.registerDomEvent(button,'click',event=>{event.preventDefault();event.stopPropagation();this.openFile(section);});lifecycle.registerDomEvent(button,'keydown',event=>event.stopPropagation());
 }
 reveal(selected:string):void{this.host.querySelector<HTMLElement>('[data-em-section="'+CSS.escape(selected)+'"]')?.scrollIntoView({block:'nearest'});}
 private drop(lifecycle:Component,row:HTMLElement,section:CompanionSection,path:string):void{
  lifecycle.registerDomEvent(row,'dragover',event=>{if(event.dataTransfer?.types.includes(COMPANION_DRAG))event.preventDefault();});
  lifecycle.registerDomEvent(row,'drop',event=>{event.preventDefault();event.stopPropagation();try{const data=JSON.parse(event.dataTransfer?.getData(COMPANION_DRAG)??'null') as CompanionDrag|null;if(data?.path===path)this.move(dragOperations(data,section.id,undefined,'last'));}catch{/* Unrelated drag. */}});
 }
}
