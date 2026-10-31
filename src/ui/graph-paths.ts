import type {EmergenceController} from '../controller';
import {connectionPaths} from '../graph/paths';
import {ConceptRegistry} from '../graph/registry';
import {synopsisNote} from './synopsis-note';
import {input, select} from './helpers';

export class GraphPaths {
 private target = ''; private query = ''; private depth = 6;
 constructor(private host: HTMLElement, private controller: EmergenceController, private focus: () => string, private explore: (id: string, event?: MouseEvent) => void) {}
 render(): void {
  const host = this.host, graph = this.controller.graph.snapshot;
  host.empty();
  const search = input(host, 'Verbindung zu …', this.query, value => {this.query = value; this.find(matches);}) as HTMLInputElement;
  search.type = 'search'; search.placeholder = 'Zielbegriff suchen';
  const matches = host.createDiv({cls: 'em-path-matches'});
  this.find(matches);
  select(host, 'Maximale Schritte', {'2': '2', '4': '4', '6': '6', '10': '10'}, String(this.depth), value => {this.depth = Number(value); this.render();});
  host.createDiv({text: 'Kürzeste Breadcrumbs-Pfade · beide Richtungen', cls: 'em-muted'});
  if (!this.target) return;
  const target = graph.nodes.find(n => n.id === this.target);
  host.createEl('h4', {text: target?.title ?? this.target});
  const result = connectionPaths(graph, this.focus(), this.target, this.depth);
  if (!result.paths.length) host.createDiv({text: result.limited ? 'Suchgrenze erreicht. Die Suche konnte nicht vollständig abgeschlossen werden.' : result.depthLimited ? `Kein Pfad innerhalb von ${this.depth} Schritten gefunden.` : 'Kein Breadcrumbs-Pfad gefunden.', cls: 'em-muted'});
  for (const path of result.paths) {
   const list = host.createEl('ol', {cls: 'em-connection-path'});
   path.nodes.forEach((id, index) => {
    const step = list.createEl('li');
    if (index) step.createDiv({text: stepLabel(path.steps[index - 1]!), cls: 'em-muted'});
    const concept = graph.nodes.find(n => n.id === id);
    synopsisNote(step, {id,title:concept?.title ?? id,path:concept?.exists?id:undefined,linktext:id,sourcePath:this.focus(),exists:!!concept?.exists}, {activate:(_note,event)=>this.explore(id,event),inspect:()=>this.explore(id)});
   });
  }
  if (result.more || result.limited && result.paths.length) host.createDiv({text: 'Bis zu fünf kürzeste Pfade angezeigt; weitere Verbindungen möglich.', cls: 'em-muted'});
 }
 private find(matches: HTMLElement): void {
  matches.empty(); if (!this.query.trim()) return;
  for (const {concept} of new ConceptRegistry(this.controller.graph.snapshot).search(this.query, 8)) {
   synopsisNote(matches,{id:concept.id,title:concept.title,path:concept.exists?concept.id:undefined,linktext:concept.id,sourcePath:this.focus(),exists:concept.exists},{activate:(_note,event)=>{if(event.button===1){this.explore(concept.id,event);return;}this.target=concept.id;this.query='';this.render();},inspect:()=>this.explore(concept.id)});
  }
 }
}

function stepLabel(roles: {field: string; reverse: boolean}[]): string {
 const fields = [...new Set(roles.map(r => r.field))];
 return fields.map(field => {const directions = new Set(roles.filter(r => r.field === field).map(r => r.reverse)); return `${directions.size > 1 ? '↔' : directions.has(true) ? '←' : '→'} ${field}`;}).join(' · ');
}
