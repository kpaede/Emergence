import type {EmergenceController} from '../controller';
import {synopsisFields} from '../graph/synopsis';
import {synopsisLabels,synopsisRelations} from '../graph/synopsis-types';
import {disclosure} from './panel';

/** Refresh only when mappings change; keep the surrounding disclosure and focus stable. */
export function synopsisSourceSettings(host:HTMLElement,c:EmergenceController,changed:()=>void):()=>void{
 const section=disclosure(host,'Datenquellen der Relationssynopse'),body=section.createDiv();let signature='';
 const refresh=()=>{
  const graph=c.graph.snapshot,fields=synopsisFields(graph,c.settings()),next=JSON.stringify([graph.fields,fields]);if(signature===next)return;signature=next;
  const active=body.ownerDocument.activeElement,label=active instanceof HTMLElement?active.getAttribute('aria-label'):null;body.empty();
  body.createDiv({text:'Breadcrumbs-Felder den sieben Ansichten zuordnen. Literatur nutzt zusätzlich vorhandene ZotLit-Notizverweise, freie Verweise den Obsidian-Linkindex.',cls:'em-muted'});
  for(const relation of synopsisRelations){
   const row=body.createEl('label',{cls:'em-field'});row.createSpan({text:synopsisLabels[relation]});
   const control=row.createEl('select',{attr:{multiple:'',size:'3','aria-label':`Breadcrumbs-Felder für ${synopsisLabels[relation]}`}});
   for(const field of graph.fields){const option=control.createEl('option',{value:field,text:field});option.selected=fields[relation].includes(field);}
   control.onchange=()=>{const s=c.settings();s.synopsis={...s.synopsis,fields:{...s.synopsis?.fields,[relation]:[...control.selectedOptions].map(o=>o.value)}};void c.run(async()=>{await c.persist();refresh();changed();});};
   if(label===control.getAttribute('aria-label'))control.focus({preventScroll:true});
  }
  const assigned=new Set(Object.values(fields).flat()),unassigned=graph.fields.filter(f=>!assigned.has(f));
  if(unassigned.length)body.createDiv({text:`Nicht zugeordnet: ${unassigned.join(', ')}. Diese Felder bleiben in „Nachbarschaft und Links“ erhalten.`,cls:'em-muted'});
 };refresh();return refresh;
}
