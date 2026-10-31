import {Menu,setIcon} from 'obsidian';
import type {EmergenceController} from '../controller';
import {synopsisFields} from '../graph/synopsis';
import {synopsisLabels,type SynopsisRelation} from '../graph/synopsis-types';
const editable:SynopsisRelation[]=['broader','narrower','similar','friction','examples'];
export interface SynopsisSourceControls {refresh():void;closeMenu():void;destroy():void}
/** Native checked menus keep multi-field mappings usable without HTML multi-select list boxes. */
export function synopsisSourceSettings(host:HTMLElement,c:EmergenceController,changed:()=>void):SynopsisSourceControls{
 const body=host.createDiv({cls:'em-syn-source-settings'});let signature='';let menu:Menu|undefined;
 const refresh=()=>{
  const graph=c.graph.snapshot,fields=synopsisFields(graph,c.settings()),next=JSON.stringify([graph.fields,fields]);if(signature===next)return;signature=next;menu?.hide();
  const active=body.ownerDocument.activeElement,label=active instanceof HTMLElement?active.getAttribute('aria-label'):null;body.empty();
  for(const relation of editable){
   const row=body.createDiv({cls:'em-syn-source-row'}),id=crypto.randomUUID();row.createSpan({text:synopsisLabels[relation],attr:{id}});
   const selected=fields[relation],valueId=crypto.randomUUID(),control=row.createEl('button',{cls:'em-syn-source-choice',attr:{type:'button','aria-label':`Breadcrumbs-Felder für ${synopsisLabels[relation]}`,'aria-haspopup':'menu','aria-labelledby':id+' '+valueId}});
   control.createSpan({text:selected.length?selected.join(', '):'Keine Zuordnung',attr:{id:valueId}});setIcon(control.createSpan({cls:'em-syn-source-chevron',attr:{'aria-hidden':'true'}}),'chevron-down');control.disabled=!graph.fields.length;
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
  for(const [relation,text]of [['literature','ZotLit'],['links','Links im Notiztext']] as const){const row=body.createDiv({cls:'em-syn-source-row'});row.createSpan({text:synopsisLabels[relation]});row.createSpan({text,cls:'em-muted'});}
  const assigned=new Set(Object.values(fields).flat()),unassigned=graph.fields.filter(f=>!assigned.has(f));
  if(unassigned.length)body.createDiv({text:'Eigene Register: '+unassigned.join(', '),cls:'em-muted em-caption'});
 };refresh();return {refresh,closeMenu:()=>menu?.hide(),destroy:()=>{menu?.hide();body.remove();}};
}
