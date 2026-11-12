import {t as tr} from '../i18n';
import type {GraphSnapshot, Settings} from '../types';
import {SynopsisGraph,synopsisDepths} from '../graph/synopsis';
import {type SynopsisDepth,type SynopsisEntry,type SynopsisRelation} from '../graph/synopsis-types';
import {synopsisAt,synopsisLabel,synopsisPlacement} from '../graph/synopsis-layout';
import {literatureReference} from './literature-reference';
import {synopsisNote,type SynopsisLinkActions} from './synopsis-note';
import {iconButton, labelWithoutTooltip} from './panel';
import {SynopsisGeometry} from './synopsis-geometry';
import {SynopsisEditing, type SynopsisEditingActions} from './synopsis-editing';

/** Seven relation groups share one node component, typography and depth control. */
export class RelationsSynopsis {
 geometry?:SynopsisGeometry; model?:SynopsisGraph;
 private generation=0; private frame?:number; private diagram?:HTMLElement; private focus=''; private fingerprint='';
 constructor(private host:HTMLElement,private settings:()=>Settings,private changeDepth:(relation:SynopsisRelation,depth:SynopsisDepth)=>void,private actions:SynopsisLinkActions,private addRelation?:(relation:SynopsisRelation,source:string)=>void,private addField?:(field:string,source:string)=>void,private editingActions?:SynopsisEditingActions){host.addClass('em-relations-synopsis');}
 render(snapshot:GraphSnapshot,focus:string):void{
  const settings=this.settings(),labelFor=(relation:SynopsisRelation)=>synopsisLabel(settings,relation);
  const depths=synopsisDepths(settings),fingerprint=JSON.stringify([snapshot.version,focus,depths,settings.synopsis,settings.graphStructure]);
  if(fingerprint===this.fingerprint){this.geometry?.schedule();return;} this.fingerprint=fingerprint;
  const sameFocus=this.focus===focus,scroll=this.host.scrollTop;this.focus=focus;
  const selected=this.host.ownerDocument.activeElement instanceof HTMLSelectElement?(this.host.ownerDocument.activeElement).dataset.synDepth:undefined;
  this.geometry?.destroy();this.cancelFrame();const generation=++this.generation;this.host.empty();
  const model=this.model=new SynopsisGraph(snapshot,this.settings()),note=model.notes.get(focus);
  if(!note){this.host.createDiv({text:tr("common.open_a_markdown_note"),cls:'em-muted'});return;}
  const editing=new SynopsisEditing(model,this.settings(),focus,this.editingActions);
  const diagram=this.diagram=this.host.createDiv({cls:'em-syn-diagram'});
  const svg=diagram.createSvg('svg',{cls:'em-syn-edges',attr:{'aria-hidden':'true',focusable:'false',width:'100%',height:'0'}});
  const makeSection=(relation:SynopsisRelation,parent:HTMLElement)=>{
   const section=parent.createEl('section',{cls:`em-syn-section em-syn-${relation}`,attr:{'data-syn-relation':relation,'data-syn-position':synopsisPlacement(settings,relation).position}});
   const titleId=`em-syn-title-${crypto.randomUUID()}`;section.setAttribute('aria-labelledby',titleId);
   const heading=section.createDiv({cls:'em-syn-head'}),titleGroup=heading.createDiv({cls:'em-syn-title'}),title=titleGroup.createEl('h3',{text:labelFor(relation),attr:{id:titleId}});
   const count=model.neighbors(focus,relation).length+(relation==='literature'?model.citationNotice(focus):0);title.createSpan({text:` ${count}`,cls:'em-syn-count'});
   const controls=heading.createDiv({cls:'em-syn-controls'});
   if(['broader','narrower','similar','friction','examples'].includes(relation)){const add=iconButton(titleGroup,'plus',tr("common.add", {value1: labelFor(relation)}),()=>this.addRelation?.(relation,focus),false);add.dataset.synAdd=relation;add.disabled=!note.exists||!model.fields[relation].length||!this.addRelation;editing.section(section,model.fields[relation]);}
   const label=controls.createEl('label',{cls:'em-syn-depth'});labelWithoutTooltip(label,tr("common.depth_for", {value1: labelFor(relation)}));const select=label.createEl('select',{attr:{'data-syn-depth':relation,'aria-labelledby':label.getAttribute('aria-labelledby')!}});
   for(const value of [1,2,3,'all'] as const)select.createEl('option',{value:String(value),text:value==='all'?'∞':String(value)});
   select.value=String(depths[relation]);select.onchange=()=>this.changeDepth(relation,select.value==='all'?'all':Number(select.value) as 1|2|3);
   return section;
  };
  const above=diagram.createDiv({cls:'em-syn-above'});
  let parents:HTMLElement|undefined,pending:HTMLElement|undefined;
  const iterator=model.ancestorPaths(focus,depths.broader);
  const renderPaths=()=>{
   if(generation!==this.generation||!parents||!pending)return;
   const start=performance.now();let added=0;
   for(;;){const next=iterator.next();if(next.done){pending.remove();this.geometry?.schedule();return;}
    const path=next.value,li=parents.createEl('li',{cls:'em-syn-parent-path'});
    path.notes.forEach((ancestor,i)=>{if(i)li.createSpan({text:' › ',cls:'em-syn-crumb',attr:{'aria-hidden':'true'}});const link=synopsisNote(li,ancestor,this.actions);if(i===path.notes.length-1)link.dataset.synParentTerminal='';editing.term(link,path.notes[i+1]?.id??focus,ancestor.id,model.fields.broader);});
    if(path.cycle)li.createSpan({text:tr("common.back_reference"),cls:'em-syn-meta'});
    added++;if(added>=100||performance.now()-start>12)break;
   }
   pending.setText(tr("common.adding_more_ancestor_paths"));this.geometry?.schedule();
   this.frame=(this.host.ownerDocument.defaultView??window).requestAnimationFrame(()=>{this.frame=undefined;renderPaths();});
  };
  diagram.createDiv({cls:'em-syn-join',attr:{'aria-hidden':'true'}});
  const focusWrap=diagram.createDiv({cls:'em-syn-focus-wrap'}),focusFrame=focusWrap.createDiv({cls:'em-syn-focus'});synopsisNote(focusFrame,note,this.actions).setAttribute('aria-current','page');
  const lateral=diagram.createDiv({cls:'em-syn-lateral'});
  const populate=(relation:SynopsisRelation,parent:HTMLElement)=>{
   const position=synopsisPlacement(settings,relation).position;
   const section=makeSection(relation,parent),list=section.createEl('ul',{cls:position==='top'||position==='bottom'?'em-syn-children':position==='left'||position==='right'?'em-syn-lateral-items':'em-syn-register',attr:{'data-syn-list':relation}});
   const entries=model.entries(focus,relation,depths[relation]);
   const returns=model.returns(relation);if(returns)list.setAttribute('aria-description',tr("common.back_references_are_not_shown_again_as_new_steps", {value1: returns}));
   if(relation==='literature')for(const citation of model.citationReferences(focus)){
    const row=(position==='list'?section.createDiv({cls:'em-syn-citation'}):list.createEl('li',{cls:'em-syn-citation'}));row.dataset.synCitekey=citation.citekey??'';
    const reference=literatureReference(row,citation,{open:()=>this.actions.literature?.(citation),format:()=>this.settings().citekeyFormat??'brackets',run:this.actions.run,load:this.actions.referenceActions?()=>this.actions.referenceActions!(citation,focus):undefined,bibliography:this.actions.bibliography?reference=>this.actions.bibliography!(reference,focus):undefined});
    if(position!=='list')reference.querySelector<HTMLElement>('.em-literature-title')!.dataset.synDirect=relation;
   }
   if(!entries.length)return;
   const work:{entry:SynopsisEntry;list:HTMLElement;side:'left'|'right';parent?:HTMLElement;visualDepth:number}[]=entries.map((entry,index)=>({entry,list,visualDepth:0,side:position==='right'||(position==='bottom'||position==='top')&&index%2===0?'right':'left'}));
   for(let index=0;index<work.length;index++){
    const {entry,list,side,parent,visualDepth}=work[index]!,li=list.createEl('li',{attr:{'data-syn-step':String(entry.step)}});const actions=relation==='literature'&&snapshot.edges.some(e=>e.layer==='zotlit'&&e.target===entry.note.id)&&this.actions.literature?{...this.actions,activate:(_note:import('../graph/synopsis-types').SynopsisNote,event:MouseEvent)=>{if(event.button!==1)this.actions.literature?.({path:entry.note.path});}}:this.actions;const reference=relation==='literature'?model.reference(entry.note.id):undefined;
    let link:HTMLElement;
    if(reference){li.addClass('em-syn-literature-row');const row=literatureReference(li,{...reference,title:reference.title??entry.note.title},{open:()=>this.actions.literature?.({...reference,path:entry.note.path}),format:()=>this.settings().citekeyFormat??'brackets',run:this.actions.run,load:this.actions.referenceActions?()=>this.actions.referenceActions!(reference,focus):undefined,bibliography:this.actions.bibliography?reference=>this.actions.bibliography!(reference,focus):undefined});link=row.querySelector<HTMLElement>('.em-literature-title')!;link.addClass('em-syn-reference');link.dataset.emNote=entry.note.id;link.id='em-syn-note-'+crypto.randomUUID();}
    else link=synopsisNote(li,entry.note,actions);
    if(parent){link.dataset.synParent=parent.id;link.dataset.synSide=side;link.dataset.synRelation=relation;}else link.dataset.synDirect=relation;
    if(entry.step>3)li.createSpan({text:tr("messages.step",{step:entry.step}),cls:'em-syn-step-meta'});
    link.setAttribute('aria-description',tr("messages.relationStep",{relation:labelFor(relation),step:entry.step,parent:parent?tr("common.via",{value1:parent.textContent??''}):'',repeated:entry.repeated?tr("common.back_reference_or_note_already_reachable"):''}));
    if(['broader','narrower','similar','friction','examples'].includes(relation))editing.term(link,parent?.dataset.emNote??focus,entry.note.id,model.fields[relation]);
    if(entry.children.length){li.addClass('em-syn-has-steps');const nested=visualDepth<3?li.createEl('ul',{cls:'em-syn-nested',attr:{'data-side':side,'data-relation':relation}}):list;for(const child of entry.children)work.push({entry:child,list:nested,side,parent:link,visualDepth:Math.min(3,visualDepth+1)});}
   }
  };
  for(const relation of synopsisAt(settings,'top')){
   if(relation==='broader'){parents=makeSection(relation,above).createEl('ul',{cls:'em-syn-parents'});pending=parents.parentElement!.createDiv({cls:'em-syn-progress',attr:{role:'status','aria-live':'polite'}});}
   else populate(relation,above);
  }
  for(const position of ['left','right'] as const)for(const [index,relation]of synopsisAt(settings,position).entries()){
   populate(relation,lateral);const section=lateral.lastElementChild as HTMLElement;section.style.gridColumn=position==='left'?'1':'2';section.style.gridRow=`${index*3+1} / span 3`;
  }
  for(const relation of synopsisAt(settings,'bottom'))populate(relation,diagram);
  const registers=diagram.createDiv({cls:'em-syn-registers'});
  const extras=()=>{
  for(const field of model.extraFields(focus)){
   const targets=model.fieldNeighbors(focus,field);
   const titleId='em-syn-extra-'+crypto.randomUUID(),section=registers.createEl('section',{cls:'em-syn-section em-syn-extra',attr:{'data-syn-field':field,'aria-labelledby':titleId}}),heading=section.createDiv({cls:'em-syn-head'});
   const titleGroup=heading.createDiv({cls:'em-syn-title'});titleGroup.createEl('h3',{text:field,attr:{id:titleId}}).createSpan({text:' '+targets.length,cls:'em-syn-count'});
   const add=iconButton(titleGroup,'plus',tr("common.add", {value1: field}),()=>this.addField?.(field,focus),false);add.disabled=!note.exists||!this.addField;editing.section(section,[field]);
   const list=section.createEl('ul',{cls:'em-syn-register'});for(const target of targets){const link=synopsisNote(list.createEl('li'),target,this.actions);editing.term(link,focus,target.id,[field]);}
  }
  };
  let extraShown=false;for(const relation of synopsisAt(settings,'list')){if(relation==='literature'){extras();extraShown=true;}populate(relation,registers);}if(!extraShown)extras();
  if(this.actions.backlinks){const entries=[...new Set(this.actions.backlinks(focus))].flatMap(id=>{const note=model.notes.get(id);return note?[note]:[];});const section=diagram.createEl('section',{cls:'em-syn-section em-syn-backlinks',attr:{'aria-label':tr("common.backlinks")}}),heading=section.createDiv({cls:'em-syn-head'});heading.createEl('h3',{text:tr("common.backlinks")}).createSpan({text:' '+entries.length,cls:'em-syn-count'});const list=section.createEl('ul',{cls:'em-syn-register'});for(const entry of entries)synopsisNote(list.createEl('li'),entry,this.actions);}
  this.geometry=new SynopsisGeometry(diagram,svg);renderPaths();this.geometry.schedule();
  if(sameFocus)this.host.scrollTop=scroll;else this.host.scrollTop=0;
  if(selected)this.host.querySelector<HTMLElement>(`[data-syn-depth="${selected}"]`)?.focus({preventScroll:true});
 }
 refresh():void{this.geometry?.schedule();}
 center():void{const focus=this.diagram?.querySelector<HTMLElement>('.em-syn-focus');if(focus)this.host.scrollTop+=focus.getBoundingClientRect().top-this.host.getBoundingClientRect().top-this.host.clientHeight/2+focus.offsetHeight/2;}
 invalidate():void{this.fingerprint='';}
 private cancelFrame():void{if(this.frame!==undefined)(this.host.ownerDocument.defaultView??window).cancelAnimationFrame(this.frame);this.frame=undefined;}
 destroy():void{this.generation++;this.cancelFrame();this.geometry?.destroy();this.host.empty();}
}
