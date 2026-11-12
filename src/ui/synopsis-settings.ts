import {locale,t as tr} from '../i18n';
import {Menu,setIcon} from 'obsidian';
import type {EmergenceController} from '../controller';
import {synopsisFields} from '../graph/synopsis';
import {type SynopsisRelation} from '../graph/synopsis-types';
import {synopsisLabel} from '../graph/synopsis-layout';
const editable:SynopsisRelation[]=['broader','narrower','similar','friction','examples'];
export interface SynopsisSourceControls {refresh():void;closeMenu():void;destroy():void}
/** Native checked menus keep multi-field mappings usable without HTML multi-select list boxes. */
export function synopsisSourceSettings(host:HTMLElement,c:EmergenceController,changed:()=>void):SynopsisSourceControls{
 const body=host.createDiv({cls:'em-syn-source-settings'});let signature='';let menu:Menu|undefined;
 const refresh=()=>{
  const graph=c.graph.snapshot,fields=synopsisFields(graph,c.settings()),next=JSON.stringify([graph.fields,fields,c.settings().synopsis?.labels,locale()]);if(signature===next)return;signature=next;menu?.hide();
  const active=body.ownerDocument.activeElement,label=active instanceof HTMLElement?active.getAttribute('aria-label'):null;body.empty();
  for(const relation of editable){
   const row=body.createDiv({cls:'em-syn-source-row'}),id=crypto.randomUUID();row.createSpan({text:synopsisLabel(c.settings(),relation),attr:{id}});
   const selected=fields[relation],valueId=crypto.randomUUID(),control=row.createEl('button',{cls:'em-syn-source-choice',attr:{type:'button','aria-label':tr("graph.breadcrumbs_fields_for", {value1: synopsisLabel(c.settings(),relation)}),'aria-haspopup':'menu','aria-labelledby':id+' '+valueId}});
   control.createSpan({text:selected.length?selected.join(', '):tr("graph.no_assignment"),attr:{id:valueId}});setIcon(control.createSpan({cls:'em-syn-source-chevron',attr:{'aria-hidden':'true'}}),'chevron-down');control.disabled=!graph.fields.length;
   control.onclick=event=>{event.preventDefault();event.stopPropagation();
    menu?.hide();menu=new Menu().setUseNativeMenu(false);
    for(const field of graph.fields)menu.addItem(item=>item.setTitle(field).setChecked(selected.includes(field)).onClick(()=>{
     const chosen=selected.includes(field)?selected.filter(f=>f!==field):[...selected,field],settings=c.settings();
     settings.synopsis={...settings.synopsis,fields:{...settings.synopsis?.fields,[relation]:chosen}};refresh();changed();void c.run(()=>c.persist());
    }));
    const rect=control.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom});
   };
   if(label===control.getAttribute('aria-label'))control.focus({preventScroll:true});
  }
  for(const [relation,text]of [['literature','ZotLit'],['links',tr("labels.links_in_note_text")]] as const){const row=body.createDiv({cls:'em-syn-source-row'});row.createSpan({text:synopsisLabel(c.settings(),relation)});row.createSpan({text,cls:'em-muted'});}
  const assigned=new Set(Object.values(fields).flat()),unassigned=graph.fields.filter(f=>!assigned.has(f));
  if(unassigned.length)body.createDiv({text:tr("labels.custom_registers")+unassigned.join(', '),cls:'em-muted em-caption'});
 };refresh();return {refresh,closeMenu:()=>menu?.hide(),destroy:()=>{menu?.hide();body.remove();}};
}
