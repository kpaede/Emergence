import type {GraphSnapshot, Settings} from '../types';
import {SynopsisGraph,synopsisDepths} from '../graph/synopsis';
import {synopsisLabels,type SynopsisDepth,type SynopsisEntry,type SynopsisRelation} from '../graph/synopsis-types';
import {synopsisNote,type SynopsisLinkActions} from './synopsis-note';
import {iconButton} from './panel';
import {SynopsisGeometry} from './synopsis-geometry';

/** Seven relation groups share one node component, typography and depth control. */
export class RelationsSynopsis {
 geometry?:SynopsisGeometry; model?:SynopsisGraph;
 private generation=0; private frame?:number; private diagram?:HTMLElement; private focus=''; private fingerprint='';
 constructor(private host:HTMLElement,private settings:()=>Settings,private changeDepth:(relation:SynopsisRelation,depth:SynopsisDepth)=>void,private actions:SynopsisLinkActions,private addRelation?:(relation:SynopsisRelation,source:string)=>void){host.addClass('em-relations-synopsis');}
 render(snapshot:GraphSnapshot,focus:string):void{
  const depths=synopsisDepths(this.settings()),fingerprint=JSON.stringify([snapshot.version,focus,depths,this.settings().synopsis?.fields,this.settings().graphStructure]);
  if(fingerprint===this.fingerprint){this.geometry?.schedule();return;} this.fingerprint=fingerprint;
  const sameFocus=this.focus===focus,scroll=this.host.scrollTop;this.focus=focus;
  const selected=this.host.ownerDocument.activeElement instanceof HTMLSelectElement?(this.host.ownerDocument.activeElement).dataset.synDepth:undefined;
  this.geometry?.destroy();this.cancelFrame();const generation=++this.generation;this.host.empty();
  const model=this.model=new SynopsisGraph(snapshot,this.settings()),note=model.notes.get(focus);
  if(!note){this.host.createDiv({text:'Öffne eine Markdown-Notiz.',cls:'em-muted'});return;}
  const diagram=this.diagram=this.host.createDiv({cls:'em-syn-diagram',attr:{'aria-label':'Relationssynopse'}});
  const svg=diagram.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');svg.addClass('em-syn-edges');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');diagram.append(svg);
  const makeSection=(relation:SynopsisRelation,parent:HTMLElement)=>{
   const section=parent.createEl('section',{cls:`em-syn-section em-syn-${relation}`,attr:{'data-syn-relation':relation}});
   const titleId=`em-syn-title-${crypto.randomUUID()}`;section.setAttribute('aria-labelledby',titleId);
   const heading=section.createDiv({cls:'em-syn-head'}),title=heading.createEl('h3',{text:synopsisLabels[relation],attr:{id:titleId}});
   const count=model.neighbors(focus,relation).length+(relation==='literature'?model.citationNotice(focus):0);title.createSpan({text:` ${count}`,cls:'em-syn-count',attr:{'aria-label':`${count} direkte Verbindungen`}});
   const controls=heading.createDiv({cls:'em-syn-controls'});
   if(['broader','narrower','similar','friction','examples'].includes(relation)){const add=iconButton(controls,'plus',`${synopsisLabels[relation]} ergänzen`,()=>this.addRelation?.(relation,focus));add.dataset.synAdd=relation;add.disabled=!note.exists||!model.fields[relation].length||!this.addRelation;if(!model.fields[relation].length)add.title='Zuerst ein vorhandenes Breadcrumbs-Feld zuordnen.';}
   const label=controls.createEl('label',{cls:'em-syn-depth'}),select=label.createEl('select',{attr:{'aria-label':`Sichttiefe ${synopsisLabels[relation]}`,'data-syn-depth':relation}});
   for(const value of [1,2,3,'all'] as const)select.createEl('option',{value:String(value),text:value==='all'?'∞':String(value)});
   select.value=String(depths[relation]);select.onchange=()=>this.changeDepth(relation,select.value==='all'?'all':Number(select.value) as 1|2|3);
   return section;
  };
  const parents=makeSection('broader',diagram).createEl('ul',{cls:'em-syn-parents'});
  const iterator=model.ancestorPaths(focus,depths.broader);
  const pending=parents.parentElement!.createDiv({cls:'em-syn-progress',attr:{role:'status','aria-live':'polite'}});
  const renderPaths=()=>{
   if(generation!==this.generation)return;
   const start=performance.now();let added=0;
   for(;;){const next=iterator.next();if(next.done){pending.remove();this.geometry?.schedule();return;}
    const path=next.value,li=parents.createEl('li',{cls:'em-syn-parent-path'});
    path.notes.forEach((ancestor,i)=>{if(i)li.createSpan({text:' › ',cls:'em-syn-crumb',attr:{'aria-hidden':'true'}});const link=synopsisNote(li,ancestor,this.actions);if(i===path.notes.length-1)link.dataset.synParentTerminal='';});
    if(path.cycle)li.createSpan({text:' (Rückverweis)',cls:'em-syn-meta'});
    added++;if(added>=100||performance.now()-start>12)break;
   }
   pending.setText('Weitere Ahnenpfade werden ergänzt …');this.geometry?.schedule();
   this.frame=(this.host.ownerDocument.defaultView??window).requestAnimationFrame(()=>{this.frame=undefined;renderPaths();});
  };
  diagram.createDiv({cls:'em-syn-join',attr:{'aria-hidden':'true'}});
  const focusWrap=diagram.createDiv({cls:'em-syn-focus-wrap'}),focusFrame=focusWrap.createDiv({cls:'em-syn-focus'});synopsisNote(focusFrame,note,this.actions).setAttribute('aria-current','page');
  const lateral=diagram.createDiv({cls:'em-syn-lateral'});
  const populate=(relation:SynopsisRelation,parent:HTMLElement)=>{
   const section=makeSection(relation,parent),list=section.createEl('ul',{cls:relation==='narrower'?'em-syn-children':relation==='similar'||relation==='friction'?'em-syn-lateral-items':'em-syn-register',attr:{'data-syn-list':relation}});
   const entries=model.entries(focus,relation,depths[relation]);
   const returns=model.returns(relation);if(returns)list.setAttribute('aria-description',`${returns} Rückverweise nicht erneut als neue Schritte angezeigt.`);
   if(relation==='literature')for(const citation of model.citationReferences(focus)){const row=section.createDiv({cls:'em-syn-citation',attr:{'data-syn-citekey':citation.citekey}});const link=row.createEl('a',{text:`@${citation.citekey}`,cls:'internal-link',attr:{href:'#','aria-label':`@${citation.citekey} in ZotLit Library öffnen`}});link.onclick=event=>{event.preventDefault();this.actions.literature?.({citekey:citation.citekey});};link.onauxclick=event=>{if(event.button===1)event.preventDefault();};row.createSpan({text:'Keine Literaturnotiz verknüpft',cls:'em-syn-meta'});}
   if(!entries.length)return;
   const work:{entry:SynopsisEntry;list:HTMLElement;side:'left'|'right';parent?:HTMLAnchorElement;visualDepth:number}[]=entries.map((entry,index)=>({entry,list,visualDepth:0,side:relation==='friction'||relation==='narrower'&&index%2===0?'right':'left'}));
   for(let index=0;index<work.length;index++){
    const {entry,list,side,parent,visualDepth}=work[index]!,li=list.createEl('li',{attr:{'data-syn-step':String(entry.step)}});const actions=relation==='literature'&&snapshot.edges.some(e=>e.layer==='zotlit'&&e.target===entry.note.id)&&this.actions.literature?{...this.actions,activate:(_note:import('../graph/synopsis-types').SynopsisNote,event:MouseEvent)=>{if(event.button!==1)this.actions.literature?.({path:entry.note.path});}}:this.actions;const link=synopsisNote(li,entry.note,actions);
    if(parent){link.dataset.synParent=parent.id;link.dataset.synSide=side;link.dataset.synRelation=relation;}
    if(entry.step>3)li.createSpan({text:`Schritt ${entry.step}`,cls:'em-syn-step-meta'});
    link.setAttribute('aria-description',`${synopsisLabels[relation]}, Schritt ${entry.step}${parent?`, über ${parent.textContent}`:''}${entry.repeated?', Rückverweis oder bereits erreichbare Notiz':''}`);
    if(entry.children.length){li.addClass('em-syn-has-steps');const nested=visualDepth<3?li.createEl('ul',{cls:'em-syn-nested',attr:{'data-side':side,'data-relation':relation}}):list;for(const child of entry.children)work.push({entry:child,list:nested,side,parent:link,visualDepth:Math.min(3,visualDepth+1)});}
   }
  };
  populate('similar',lateral);populate('friction',lateral);populate('narrower',diagram);
  for(const relation of ['examples','literature','links'] as const)populate(relation,diagram);
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
