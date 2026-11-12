import {t as tr} from '../i18n';
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
  const search = input(host, tr("labels.connection_to"), this.query, value => {this.query = value; this.find(matches);}) as HTMLInputElement;
  search.type = 'search'; search.placeholder = tr("labels.search_target_concept");
  const matches = host.createDiv({cls: 'em-path-matches'});
  this.find(matches);
  select(host, tr("graph.maximum_steps"), {'2': '2', '4': '4', '6': '6', '10': '10'}, String(this.depth), value => {this.depth = Number(value); this.render();});
  host.createDiv({text: tr("graph.shortest_breadcrumbs_paths_both_directions"), cls: 'em-muted'});
  if (!this.target) return;
  const target = graph.nodes.find(n => n.id === this.target);
  host.createEl('h4', {text: target?.title ?? this.target});
  const result = connectionPaths(graph, this.focus(), this.target, this.depth);
  if (!result.paths.length) host.createDiv({text: result.limited ? tr("graph.search_limit_reached_the_search_could_not_be_completed") : result.depthLimited ? tr("graph.no_path_found_within_steps", {value1: this.depth}) : tr("graph.no_breadcrumbs_path_found"), cls: 'em-muted'});
  for (const path of result.paths) {
   const list = host.createEl('ol', {cls: 'em-connection-path'});
   path.nodes.forEach((id, index) => {
    const step = list.createEl('li');
    if (index) step.createDiv({text: stepLabel(path.steps[index - 1]!), cls: 'em-muted'});
    const concept = graph.nodes.find(n => n.id === id);
    synopsisNote(step, {id,title:concept?.title ?? id,path:concept?.exists?id:undefined,linktext:id,sourcePath:this.focus(),exists:!!concept?.exists}, {activate:(_note,event)=>this.explore(id,event),inspect:()=>this.explore(id)});
   });
  }
  if (result.more || result.limited && result.paths.length) host.createDiv({text: tr("graph.showing_up_to_five_shortest_paths_more_connections_may_exist"), cls: 'em-muted'});
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
