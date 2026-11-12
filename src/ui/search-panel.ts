import {t as tr} from '../i18n';
import {literatureActions} from '../graph/zotlit-actions';
import {formatZotlitReference} from '../graph/zotlit-bibliography';
import {literatureReference} from './literature-reference';
import {Keymap} from 'obsidian';
import type {EmergenceController} from '../controller';
import {ConceptRegistry} from '../graph/registry';
import {openZotlitLibrary, searchZotlitLibrary} from '../graph/zotlit';
import {errorMessage} from '../util';
import {openSynopsisNote} from './graph-navigation';
import {input, button} from './helpers';
import type {PanelState} from './panel';
import {synopsisNote} from './synopsis-note';
import {featureEnabled} from '../features';

export class SearchPanel {
 private results!: HTMLElement; private library!: HTMLElement; private version = -1; private limit = 30;
 private timer?: number; private request?: AbortController; private generation = 0; private lastQuery = ''; private sourcePath = '';
 private enabled=true;
 constructor(private controller: EmergenceController, private host: HTMLElement, private state: () => PanelState['search'], private explore: (path: string) => void) {}
 mount(): void {
  const search = input(this.host, tr("common.search_notes_and_zotero"), this.state().query, value => {this.state().query = value; this.limit = 30; this.draw();}) as HTMLInputElement;
  search.type = 'search'; search.placeholder = tr("common.term_title_alias_or_citekey");
  const choices = this.host.createDiv({cls: 'em-search-modes', attr: {role: 'radiogroup', 'aria-label': tr("common.action_when_selecting_a_note")}}), name = crypto.randomUUID();
  for (const [mode, text] of [['open', tr("common.open")], ['explore', tr("common.explore")]] as const) {
   const row = choices.createEl('label', {cls: 'em-check-row'}), box = row.createEl('input', {type: 'radio', attr: {name, value: mode}});
   box.checked = this.state().mode === mode; row.appendText(text); box.onchange = () => {if (box.checked) this.state().mode = mode;};
  }
  this.results = this.host.createDiv({cls: 'em-search-results'});
  this.library = this.host.createDiv({cls: 'em-library-results', attr: {'aria-live': 'polite'}});
  search.onkeydown = event => {if (event.key === 'Enter') {event.preventDefault(); (this.results.querySelector<HTMLAnchorElement>('a') ?? this.library.querySelector<HTMLButtonElement>('[data-literature-action=library]'))?.click();}};
  this.update();
 }
 update(): void {
  if(!this.enabled)return;
  const state = this.state(), search = this.host.querySelector<HTMLInputElement>('input[type=search]');
  if(search && search.value !== state.query) search.value = state.query;
  const canExplore=featureEnabled(this.controller.settings(),'graph');for(const box of this.host.querySelectorAll<HTMLInputElement>('input[type=radio]')){box.disabled=box.value==='explore'&&!canExplore;box.checked=box.value===(canExplore?state.mode:'open');}
  if (this.version !== this.controller.graph.snapshot.version || this.lastQuery !== state.query || this.sourcePath !== this.controller.activePath) {this.version = this.controller.graph.snapshot.version; this.draw();}
 }
 private draw(): void {
  this.results.empty(); const query = this.state().query.trim(),sourceChanged=this.sourcePath!==this.controller.activePath;this.sourcePath=this.controller.activePath;
  if (!query) {this.cancel(); this.library.empty(); this.lastQuery = this.state().query; return;}
  const c = this.controller, graph = c.graph.snapshot;
  const hits = new ConceptRegistry(graph).search(query, graph.nodes.length).map(h => h.concept);
  this.results.createEl('h3', {text: tr("common.notes", {value1: hits.length}), cls: 'em-search-heading'});
  for (const concept of hits.slice(0, this.limit)) {
   const row = this.results.createDiv({cls: 'em-search-hit'});
   const note = {id: concept.id, path: concept.exists ? concept.id : undefined, title: concept.title, linktext: concept.id, exists: concept.exists, sourcePath: c.activePath};
   const isLiterature = graph.edges.some(e => e.layer === 'zotlit' && e.target === concept.id);
   synopsisNote(row, note, {
    activate: (_note, event) => {
     if (featureEnabled(c.settings(),'graph')&&this.state().mode === 'explore' && event.button !== 1 && !Keymap.isModEvent(event)) {this.explore(concept.id); return;}
     if (event.button === 1 && isLiterature) return;
     void c.run(() => isLiterature ? openZotlitLibrary(c.app, {path: concept.id}) : openSynopsisNote(c, note, event.button === 1 ? 'tab' : Keymap.isModEvent(event)));
    }, inspect: () => this.explore(concept.id),
   });
   row.createDiv({text: concept.exists ? concept.id : tr("common.not_created_yet"), cls: 'em-path'});
  }
  if (hits.length > this.limit) button(this.results, tr("common.more_notes"), () => {this.limit += 30; this.draw();});
  if (this.lastQuery !== this.state().query || sourceChanged || !this.library.childElementCount) {this.lastQuery = this.state().query; this.findLibrary(query, 30);}
 }
 private cancel(): void {this.request?.abort(); this.request = undefined; if(this.timer !== undefined)(this.host.ownerDocument.defaultView ?? window).clearTimeout(this.timer);this.timer = undefined;this.generation++;}
 private findLibrary(query: string, limit: number): void {
  this.cancel(); const generation = this.generation,source=this.controller.activePath;
  this.library.empty(); this.library.createEl('h3', {text: tr("common.zotero_all_libraries"), cls: 'em-search-heading'});
  const status = this.library.createDiv({text: tr("common.searching_literature"), cls: 'em-muted em-caption', attr: {role: 'status'}});
  const win = this.host.ownerDocument.defaultView ?? window;
  this.timer = win.setTimeout(() => {
   this.timer = undefined; const request = this.request = new AbortController();
   void searchZotlitLibrary(this.controller.app, query, limit, request.signal).then(hits => {
    if (generation !== this.generation || request.signal.aborted) return;
    status.setText(hits.length ? tr("messages.searchHits",{count:hits.length,suffix:hits.length===limit?'+':''}) : tr("common.no_matching_references"));
    for (const item of hits) {
     const row = this.library.createDiv({cls:'em-search-hit'});
     literatureReference(row,item,{run:action=>{void this.controller.run(action);},load:()=>literatureActions(this.controller.app,item,source),open:()=>{void this.controller.run(()=>openZotlitLibrary(this.controller.app,{indexedKey:item.indexedKey}));},format:()=>this.controller.settings().citekeyFormat??'brackets',bibliography:reference=>formatZotlitReference(this.controller.app,source,reference)});
    }
    if(hits.length === limit)button(this.library,tr("common.more_literature"),()=>this.findLibrary(query,limit + 30));
   }).catch(error => {if (generation === this.generation && !request.signal.aborted) status.setText(errorMessage(error));});
  }, 180);
 }
 destroy(): void {this.cancel();}
 refreshLanguage():void{this.cancel();const scroll=this.host.scrollTop;this.host.empty();this.version=-1;this.mount();this.host.scrollTop=scroll;}
 setEnabled(value:boolean):void{if(this.enabled===value)return;this.enabled=value;if(value){this.version=-1;this.library.empty();this.update();}else this.cancel();}
}
