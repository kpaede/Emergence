import {existingTargetMatches} from '../../review/target-matches';
import {exampleTitle} from '../../llm/research-examples';
import {targetTitle} from '../../review/wikilink';
import {button, select} from '../helpers';
import {iconButton, type PanelContext} from '../panel';
import {errorMessage} from '../../util';

export function renderResearchExamples(host: HTMLElement, index: number, ctx: PanelContext): void {
 const c = ctx.controller, entry = c.inquiryHistory[index]; if(!entry?.examples)return;
 const state=ctx.state.inquiry, busy=!!c.abort||c.applyingIdea;
 host.createDiv({text:entry.source?targetTitle(entry.source):'Ohne Ausgangsnotiz',cls:'em-idea-context'});
 const fields=Object.fromEntries(c.graph.snapshot.fields.map(f=>[f,f]));
 select(host,'Eintragen in',{'':'Breadcrumbs-Feld auswählen',...fields},entry.field??'',field=>{entry.field=field;ctx.repaint();}).disabled=busy;
 const pending=entry.examples.filter(i=>i.status==='pending');
 if(!pending.length)host.createDiv({text:'Keine offenen Beispiele.',cls:'em-muted em-caption'});
 for(const idea of pending){
  const row=host.createDiv({cls:'em-idea-row',attr:{'data-research-idea':idea.id}}),edit=state.editingExample;
  if(edit?.id===idea.id){
   const box=row.createDiv({cls:'em-idea-edit'}),input=box.createEl('input',{type:'text',value:edit.value,attr:{'aria-label':'Beispiel bearbeiten'}});
   input.oninput=()=>{edit.value=input.value;};
   const save=()=>{try{idea.title=exampleTitle(input.value);idea.selectedTarget=undefined;state.editingExample=undefined;ctx.repaint();}catch(error){edit.error=errorMessage(error);ctx.repaint();}};
   input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();save();}if(event.key==='Escape'){state.editingExample=undefined;ctx.repaint();}};
   iconButton(row,'check','Bearbeitung speichern',save);iconButton(row,'x','Bearbeitung abbrechen',()=>{state.editingExample=undefined;ctx.repaint();});if(edit.error)box.createDiv({text:edit.error,cls:'em-error'});
   window.setTimeout(()=>{if(input.isConnected){input.focus();input.setSelectionRange(input.value.length,input.value.length);}},0);continue;
  }
  const matches=existingTargetMatches(idea.title,c.graph.snapshot,entry.source??''),ambiguous=matches.length>1&&!matches.some(n=>n.id===idea.selectedTarget);
  const name=row.createDiv({cls:'em-idea-name'});name.createSpan({text:idea.title});
  if(idea.creator||idea.artForm)name.createSpan({text:[idea.creator,idea.artForm].filter(Boolean).join(' · '),cls:'em-muted em-caption'});
  name.createSpan({text:matches.length?'Vorhanden':'Neu',cls:'em-idea-target-state',attr:{title:matches.map(n=>n.id).join('\n')}});
  name.createSpan({text:idea.sourceIds.length?'Suchhinweis':'Modellidee',cls:'em-muted em-caption',attr:{title:idea.sourceIds.join(', ')||'Nicht durch einen mitgegebenen Suchtreffer belegt.'}});
  const accept=iconButton(row,'check','Beispiel übernehmen',()=>{void ctx.run(()=>c.applyResearchIdea(index,idea.id));});
  accept.disabled=busy||!!edit||ambiguous||!entry.field||!c.graph.snapshot.fields.includes(entry.field)||entry.source!==c.activePath;
  iconButton(row,'x','Beispiel ablehnen',()=>{idea.status='rejected';ctx.repaint();}).disabled=busy||!!edit;
  iconButton(row,'pencil','Beispiel bearbeiten',()=>{state.editingExample={id:idea.id,value:idea.title};ctx.repaint();}).disabled=busy||!!edit;
  if(matches.length>1)select(row,'Vorhandene Notiz',{'':'Zielnotiz auswählen',...Object.fromEntries(matches.map(n=>[n.id,n.id]))},idea.selectedTarget??'',path=>{idea.selectedTarget=path;ctx.repaint();}).disabled=busy;
 }
 for(const idea of entry.examples.filter(i=>i.status==='applied')){
  const row=host.createDiv({cls:'em-idea-undo'});row.createSpan({text:'Ergänzt: '+idea.title,cls:'em-muted em-caption'});
  if(c.writer.journal.some(j=>j.id===idea.entryId&&j.status!=='undone'))button(row,'Rückgängig',()=>{void ctx.run(async()=>{await c.undoIdea(idea.entryId!);idea.status='pending';idea.entryId=undefined;});},busy||entry.source!==c.activePath);
 }
}
