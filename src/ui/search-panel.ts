import {Keymap} from 'obsidian';
import type {EmergenceController} from '../controller';
import {ConceptRegistry} from '../graph/registry';
import {openZotlitLibrary, searchZotlitLibrary, type ZotlitSearchHit} from '../graph/zotlit';
import {errorMessage} from '../util';
import {openSynopsisNote} from './graph-navigation';
import {input, button} from './helpers';
import type {PanelState} from './panel';
import {synopsisNote} from './synopsis-note';

export class SearchPanel {
 private results!: HTMLElement; private library!: HTMLElement; private version = -1; private limit = 30;
 private timer?: number; private request?: AbortController; private generation = 0; private lastQuery = '';
 constructor(private controller: EmergenceController, private host: HTMLElement, private state: () => PanelState['search'], private explore: (path: string) => void, private exploreItem: (item: ZotlitSearchHit) => void) {}
 mount(): void {
  const search = input(this.host, 'Notizen und Zotero suchen', this.state().query, value => {this.state().query = value; this.limit = 30; this.draw();}) as HTMLInputElement;
  search.type = 'search'; search.placeholder = 'Begriff, Titel, Alias oder Citekey …';
  const choices = this.host.createDiv({cls: 'em-search-modes', attr: {role: 'radiogroup', 'aria-label': 'Aktion bei Auswahl'}}), name = crypto.randomUUID();
  for (const [mode, text] of [['open', 'Öffnen'], ['explore', 'Erkunden']] as const) {
   const row = choices.createEl('label', {cls: 'em-check-row'}), box = row.createEl('input', {type: 'radio', attr: {name, value: mode}});
   box.checked = this.state().mode === mode; row.appendText(text); box.onchange = () => {if (box.checked) this.state().mode = mode;};
  }
  this.results = this.host.createDiv({cls: 'em-search-results'});
  this.library = this.host.createDiv({cls: 'em-library-results', attr: {'aria-live': 'polite'}});
  search.onkeydown = event => {if (event.key === 'Enter') {event.preventDefault(); (this.results.querySelector<HTMLAnchorElement>('a') ?? this.library.querySelector<HTMLAnchorElement>('a'))?.click();}};
  this.update();
 }
 update(): void {
  const state = this.state(), search = this.host.querySelector<HTMLInputElement>('input[type=search]');
  if(search && search.value !== state.query) search.value = state.query;
  for(const box of this.host.querySelectorAll<HTMLInputElement>('input[type=radio]')) box.checked = box.value === state.mode;
  if (this.version !== this.controller.graph.snapshot.version || this.lastQuery !== state.query) {this.version = this.controller.graph.snapshot.version; this.draw();}
 }
 private draw(): void {
  this.results.empty(); const query = this.state().query.trim();
  if (!query) {this.cancel(); this.library.empty(); this.lastQuery = this.state().query; return;}
  const c = this.controller, graph = c.graph.snapshot;
  const hits = new ConceptRegistry(graph).search(query, graph.nodes.length).map(h => h.concept);
  this.results.createEl('h3', {text: `Notizen · ${hits.length}`, cls: 'em-search-heading'});
  for (const concept of hits.slice(0, this.limit)) {
   const row = this.results.createDiv({cls: 'em-search-hit'});
   const note = {id: concept.id, path: concept.exists ? concept.id : undefined, title: concept.title, linktext: concept.id, exists: concept.exists, sourcePath: c.activePath};
   const isLiterature = graph.edges.some(e => e.layer === 'zotlit' && e.target === concept.id);
   synopsisNote(row, note, {
    activate: (_note, event) => {
     if (this.state().mode === 'explore' && event.button !== 1 && !Keymap.isModEvent(event)) {this.explore(concept.id); return;}
     if (event.button === 1 && isLiterature) return;
     void c.run(() => isLiterature ? openZotlitLibrary(c.app, {path: concept.id}) : openSynopsisNote(c, note, event.button === 1 ? 'tab' : Keymap.isModEvent(event)));
    }, inspect: () => this.explore(concept.id),
   });
   row.createDiv({text: concept.exists ? concept.id : 'Noch nicht angelegt', cls: 'em-path'});
  }
  if (hits.length > this.limit) button(this.results, 'Weitere Notizen', () => {this.limit += 30; this.draw();});
  if (this.lastQuery !== this.state().query || !this.library.childElementCount) {this.lastQuery = this.state().query; this.findLibrary(query, 30);}
 }
 private cancel(): void {this.request?.abort(); this.request = undefined; if(this.timer !== undefined)(this.host.ownerDocument.defaultView ?? window).clearTimeout(this.timer);this.timer = undefined;this.generation++;}
 private findLibrary(query: string, limit: number): void {
  this.cancel(); const generation = this.generation;
  this.library.empty(); this.library.createEl('h3', {text: 'Zotero · alle Libraries', cls: 'em-search-heading'});
  const status = this.library.createDiv({text: 'Literatur wird gesucht …', cls: 'em-muted em-caption', attr: {role: 'status'}});
  const win = this.host.ownerDocument.defaultView ?? window;
  this.timer = win.setTimeout(() => {
   this.timer = undefined; const request = this.request = new AbortController();
   void searchZotlitLibrary(this.controller.app, query, limit, request.signal).then(hits => {
    if (generation !== this.generation || request.signal.aborted) return;
    status.setText(hits.length ? `${hits.length}${hits.length === limit ? '+' : ''} Treffer` : 'Keine passenden Literaturangaben.');
    for (const item of hits) {
     const row = this.library.createDiv({cls: 'em-search-hit'}), link = row.createEl('a', {text: item.title, cls: 'internal-link', attr: {href:'#', 'data-zotlit-item':item.indexedKey}});
     link.onclick = event => {event.preventDefault(); if(this.state().mode === 'explore')this.exploreItem(item);else void this.controller.run(() => openZotlitLibrary(this.controller.app, {indexedKey:item.indexedKey}));};
     link.onauxclick = event => {if(event.button === 1)event.preventDefault();};
     row.createDiv({text: [item.detail, item.citekey ? '@' + item.citekey : ''].filter(Boolean).join(' · '), cls:'em-path'});
    }
    if(hits.length === limit)button(this.library,'Weitere Literatur',()=>this.findLibrary(query,limit + 30));
   }).catch(error => {if (generation === this.generation && !request.signal.aborted) status.setText(errorMessage(error));});
  }, 180);
 }
 destroy(): void {this.cancel();}
}
