import {SuggestModal,Notice} from 'obsidian';
import type {EmergenceController} from '../controller';
import type {SynopsisRelation} from '../graph/synopsis-types';
import {synopsisLabels} from '../graph/synopsis-types';
import {synopsisFields} from '../graph/synopsis';
import {normalize} from '../graph/registry';
import {matchingTargets} from '../llm/assignment-scope';
import {select} from './helpers';
import {targetTitle} from '../review/wikilink';
interface TargetChoice {path:string;title:string;exists:boolean}

/** Choosing a target explicitly authorizes one addition to the displayed Breadcrumbs field. */
export class SynopsisAddModal extends SuggestModal<TargetChoice>{
 private field='';private submitting=false;
 constructor(private controller:EmergenceController,private relation:SynopsisRelation,private source:string,private fixedField?:string){
  super(controller.app);this.limit=25;this.setTitle(`${fixedField??synopsisLabels[relation]} für „${targetTitle(source)}“ ergänzen`);this.setPlaceholder('Vorhandene Notiz suchen oder neuen Begriff eingeben');this.emptyStateText='Begriff eingeben';
  this.setInstructions([{command:'↑↓',purpose:'auswählen'},{command:'Enter',purpose:'Link ergänzen'},{command:'Esc',purpose:'abbrechen'}]);
 }
 async onOpen():Promise<void>{
  await super.onOpen();this.modalEl.addClass('em-syn-add-modal');
  const fields=this.fixedField?this.controller.graph.snapshot.fields.filter(f=>f===this.fixedField):synopsisFields(this.controller.graph.snapshot,this.controller.settings())[this.relation];
  this.field=fields.length===1?fields[0]!:'';
  const row=this.contentEl.createDiv({cls:'em-syn-add-field'});this.inputEl.parentElement?.before(row);
  if(fields.length===1)row.createDiv({text:`${targetTitle(this.source)} · ${this.field}`,cls:'em-muted'});
  else {const options:Record<string,string>={'':'Feld auswählen'};for(const field of fields)options[field]=field;select(row,'Frontmatter-Feld',options,'',value=>{this.field=value;});}
 }
 getSuggestions(query:string):TargetChoice[]{
  const title=query.trim().replace(/^\[\[|\]\]$/gu,'').replace(/\.md$/u,'').trim();if(!title)return [];
  const graph=this.controller.graph.snapshot,existing=graph.nodes.filter(n=>n.exists&&n.id.endsWith('.md'));
  const exact=matchingTargets(title,existing),q=normalize(title),partial=existing.filter(n=>[n.title,n.id,...n.aliases].some(value=>normalize(value).includes(q))).sort((a,b)=>a.title.localeCompare(b.title,'de'));
  const unique=[...new Map([...exact,...partial].map(n=>[n.id,n])).values()];
  const choices=unique.slice(0,20).map(n=>({path:n.id,title:n.title,exists:true}));
  if(!exact.length&&title.length<=512&&!/[[\]#|:\r\n\0/\\]/u.test(title)&&title!=='.'&&title!=='..')choices.push({path:title+'.md',title,exists:false});
  return choices;
 }
 renderSuggestion(choice:TargetChoice,el:HTMLElement):void{
  el.createDiv({text:choice.title,cls:`internal-link${choice.exists?'':' is-unresolved'}`});
  el.createDiv({text:choice.exists?choice.path:'Neuer Wiki-Link · Datei bleibt unangetastet',cls:'em-muted'});
 }
 selectSuggestion(choice:TargetChoice,event:MouseEvent|KeyboardEvent):void{if(!this.field){new Notice('Bitte zuerst das Frontmatter-Feld auswählen.');return;}super.selectSuggestion(choice,event);}
 onChooseSuggestion(choice:TargetChoice):void{
  if(this.submitting)return;
  if(!this.field){new Notice('Bitte zuerst das Frontmatter-Feld auswählen.');return;}
  this.submitting=true;
  void this.controller.run(async()=>{await this.controller.addSynopsisLink(this.source,this.field,choice.path,choice.exists?'existing':'unresolved');new Notice(`${this.field}: [[${choice.title}]] ergänzt`);});
 }
}
