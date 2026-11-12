import {t as tr} from '../../i18n';
import type {GraphSnapshot,Settings} from '../../types';
import {synopsisFields} from '../../graph/synopsis';
import {synopsisRelations,type SynopsisRelation} from '../../graph/synopsis-types';
import {placeSynopsis,synopsisLabel,synopsisPositions,type SynopsisPosition} from '../../graph/synopsis-layout';
import {RelationsSynopsis} from '../relations-synopsis';
import type {SettingsContext} from './context';

/** A small synthetic graph goes through the actual Graph renderer, without reading note content. */
export function previewGraph(snapshot:GraphSnapshot,settings:Settings):{graph:GraphSnapshot;settings:Settings}{
 const fields=synopsisFields(snapshot,settings),mapped:NonNullable<Settings['synopsis']>['fields']={};
 const graph:GraphSnapshot={version:0,builtAt:0,nodes:[],edges:[],fields:[],groups:[],rules:{},partial:false,diagnostics:[],unresolved:[],breadcrumbsVersion:''};
 const note=(id:string,title:string)=>{graph.nodes.push({id,title,exists:true,type:'md',aliases:[],tags:[],mtime:0,size:0});};
 note('preview.md',tr('settings.sampleNote'));
 for(const relation of synopsisRelations){
  const field='preview-'+relation;graph.fields.push(field);mapped[relation]=[field];
  let source='preview.md';
  for(let step=1;step<=4;step++){
   const id=relation+'-'+step+'.md',names=fields[relation];note(id,step===1?names.join(', ')||synopsisLabel(settings,relation):tr('settings.sampleStep',{step}));
   graph.edges.push({id:relation+step,source,target:id,field,layer:relation==='links'?'obsidian':'breadcrumbs',explicit:true,provenance:'preview',occurrences:[]});source=id;
  }
 }
 return {graph,settings:{...settings,synopsis:{...settings.synopsis,fields:mapped}}};
}
export function graphPreview(ctx:SettingsContext,host:HTMLElement,select:(relation:SynopsisRelation)=>void,changed:()=>void):{refresh():void;mark(relation:SynopsisRelation):void}{
 const preview=host.createDiv({cls:'em-graph-settings-preview em-workspace'}),canvas=preview.createDiv({cls:'em-graph-settings-canvas'});
 canvas.setAttribute('aria-label',tr('settings.graphPreview'));
 let selected:SynopsisRelation='broader',dragged:SynopsisRelation|undefined,current=ctx.draft;
 const renderer=new RelationsSynopsis(canvas,()=>current,(relation,depth)=>{ctx.draft.synopsis={...ctx.draft.synopsis,depths:{...ctx.draft.synopsis?.depths,[relation]:depth}};ctx.changed();changed();}, {activate:note=>{const relation=synopsisRelations.find(item=>note.id.startsWith(item+'-'));if(relation)select(relation);},inspect:()=>{}});
 ctx.register?.(()=>renderer.destroy());
 const mark=(relation:SynopsisRelation)=>{selected=relation;for(const heading of canvas.querySelectorAll<HTMLElement>('.em-syn-head'))heading.setAttribute('aria-pressed',String(heading.closest<HTMLElement>('[data-syn-relation]')?.dataset.synRelation===selected));};
 const drop=(event:DragEvent,position:SynopsisPosition,before?:SynopsisRelation)=>{if(!dragged)return;event.preventDefault();event.stopPropagation();placeSynopsis(ctx.draft,dragged,position,before);selected=dragged;dragged=undefined;ctx.changed();changed();};
 const refresh=()=>{
  const sample=previewGraph(ctx.controller.graph.snapshot,ctx.draft);current=sample.settings;sample.graph.version=Date.now();renderer.invalidate();renderer.render(sample.graph,'preview.md');
  for(const section of canvas.querySelectorAll<HTMLElement>('section[data-syn-relation]')){
   const relation=section.dataset.synRelation as SynopsisRelation,heading=section.querySelector<HTMLElement>('.em-syn-head')!;heading.setAttribute('role','button');heading.tabIndex=0;heading.draggable=true;
   heading.onclick=event=>{if((event.target as Element).closest('select,button'))return;select(relation);};heading.onkeydown=event=>{if(event.target===heading&&(event.key==='Enter'||event.key===' ')){event.preventDefault();select(relation);}};
   heading.ondragstart=event=>{dragged=relation;event.dataTransfer?.setData('application/x-emergence-synopsis',relation);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';};heading.ondragend=()=>{dragged=undefined;};
   section.ondragover=event=>{if(dragged){event.preventDefault();event.stopPropagation();}};section.ondrop=event=>drop(event,section.dataset.synPosition as SynopsisPosition,relation);
  }
  mark(selected);
 };
 const targets=preview.createDiv({cls:'em-graph-drop-targets'});
 for(const position of synopsisPositions){const target=targets.createDiv({cls:'em-graph-drop-target',text:tr(`settings.${position}` as const),attr:{'data-graph-drop':position}});target.ondragover=event=>{if(dragged)event.preventDefault();};target.ondrop=event=>drop(event,position);}
 refresh();return {refresh,mark};
}
