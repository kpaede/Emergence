import {Keymap} from 'obsidian';
import type {Core, NodeSingular, EdgeSingular} from 'cytoscape';
import type {EmergenceController} from '../controller';
import {applyLayers, createGraph, defaultFilters, highlightActive, runLayout, themeColor, themeFont} from '../graph/render';
import {arrangeContext, graphContext} from '../graph/context';
import {button, select} from './helpers';
import {badge, disclosure, iconButton} from './panel';
import type {Concept, Edge, GraphSnapshot} from '../types';
import {boundedPaths} from '../graph/paths';
import {cardLabel} from './graph-label';
import {GraphPaths} from './graph-paths';
import {SynopsisAddModal} from './synopsis-add';
import {RelationsSynopsis} from './relations-synopsis';
import {synopsisSourceSettings} from './synopsis-settings';
import type {SynopsisDepth, SynopsisNote, SynopsisRelation} from '../graph/synopsis-types';
import {openGraphNote, openSynopsisNote} from './graph-navigation';
import {openZotlitLibrary, type ZotlitSearchHit} from '../graph/zotlit';

export class GraphPanel {
 private searchItem?: Concept;
 private snapshot(): GraphSnapshot {const g=this.controller.graph.snapshot; return this.searchItem && !g.nodes.some(n=>n.id===this.searchItem!.id)?{...g,nodes:[...g.nodes,this.searchItem]}:g;}
 private cy?: Core; private addModal?:SynopsisAddModal;
 private layoutGeneration = 0;
 private semantic!: RelationsSynopsis; private depthSave = Promise.resolve(); private semanticHost!: HTMLElement; private networkHost!: HTMLElement;
 private explore = false; private exploreBox!: HTMLInputElement;
 private mode: 'structure' | 'paths' | 'network' = 'structure';
 private pathHost!: HTMLElement; private refreshSources?:()=>void;
 private paths!: GraphPaths; private controls!: HTMLDetailsElement;
 private modeSelect!: HTMLSelectElement; private networkControls!: HTMLElement;
 private filters = defaultFilters();
 private version = -1;
 private summary!: HTMLElement; private details!: HTMLElement; private canvas!: HTMLElement;
 private split!: HTMLElement;
 private manuallyExplored = false; private preview = false;
 private fieldSelect?: HTMLSelectElement;
 private arrangementSelect?: HTMLSelectElement;
 private focusPath = ''; private lastActive = ''; private follow = true; private followBox!: HTMLInputElement;
 private page = 0; private pageSize = 4; private crossEdges = false;
 private arrangement: 'context' | 'elk' | 'fcose' | 'concentric' = 'context';
 private context?: ReturnType<typeof graphContext>;
 private contextHeading!: HTMLElement; private contextStatus!: HTMLElement; private pager!: HTMLElement;
 private proposals!: HTMLElement; private proposalRevision = '';
 private viewportWidth = 0; private viewportHeight = 0;
 private resizeObserver?: ResizeObserver;
 private contextLabelId = `em-graph-title-${crypto.randomUUID()}`;
 constructor(private controller: EmergenceController, private host: HTMLElement, private reviewProposals: () => void) {}
 mount(): void {
  const c = this.controller, searchBar = this.host.createDiv({cls: 'em-graph-toolbar'});
  iconButton(searchBar, 'locate-fixed', 'Zur aktuellen Notiz und ihrem Kontext', () => {this.follow = true; this.followBox.checked = true; this.focus(c.activePath);});
  iconButton(searchBar, 'scan', 'Fokus zentrieren / Netz einpassen', () => {this.manuallyExplored = false; this.fitContext(true);});
  const heading = this.host.createDiv({cls: 'em-graph-context'});
  this.contextHeading = heading.createDiv({cls: 'em-note-title', attr: {id: this.contextLabelId}});
  this.contextStatus = heading.createDiv({cls: 'em-muted', attr: {id: `${this.contextLabelId}-status`}});
  this.modeSelect = select(heading, 'Ansicht', {structure: 'Relationssynopse', paths: 'Verbindungspfade', network: 'Nachbarschaft und Links'}, this.mode, value => {this.mode = value as typeof this.mode; this.closeDetails(); this.renderContext();});
  this.modeSelect.setAttribute('aria-label','Graphansicht');
  const exploreRow = this.host.createEl('label', {cls: 'em-check-row em-graph-explore'});
  this.exploreBox = exploreRow.createEl('input', {type: 'checkbox'}); exploreRow.appendText('Im Graphen erkunden');
  exploreRow.title = 'An: Klick verschiebt nur den Graphfokus. Aus: Klick öffnet die Notiz im Hauptbereich.';
  this.exploreBox.onchange = () => {this.explore = this.exploreBox.checked; if (!this.explore) {this.follow = true; this.followBox.checked = true; this.focus(c.activePath);} };
  const controls = disclosure(this.host, 'Ansicht und Filter'); this.controls = controls; controls.addClass('em-graph-controls');
  this.refreshSources=synopsisSourceSettings(controls,c,()=>{this.semantic.invalidate();this.renderContext();});
  this.networkControls = controls.createDiv();
  this.arrangementSelect = select(this.networkControls, 'Anordnung im freien Netz', {context: 'Nachbarn als Liste', elk: 'Hierarchie', fcose: 'Kräfteverteilung', concentric: 'Konzentrisch'}, this.arrangement, name => {
   this.arrangement = name as typeof this.arrangement; this.manuallyExplored = false; void c.run(() => this.layout());
  });

  const followRow = controls.createEl('label', {cls: 'em-check-row'});
  this.followBox = followRow.createEl('input', {type: 'checkbox'}); this.followBox.checked = this.follow; followRow.appendText('Aktueller Notiz folgen');
  this.followBox.onchange = () => {this.follow = this.followBox.checked; if (this.follow) this.focus(c.activePath); this.describeContext();};
  const layers = this.networkControls.createDiv({cls: 'em-layer-options'});
  for (const [key, label] of [['hierarchy', 'Hierarchische Beziehungen'], ['cross', 'Weitere typisierte Beziehungen'], ['links', 'Gewöhnliche Obsidian-Links'], ['citations', 'ZotLit-Zitate'], ['implied', 'Abgeleitete Beziehungen']] as const) {
   const row = layers.createEl('label'), box = row.createEl('input', {type: 'checkbox'}); box.checked = this.filters[key] !== false; row.appendText(label);
   box.onchange = () => {this.filters[key] = box.checked; this.applyFilters();};
  }
  const citationStatus = controls.createDiv({cls: 'em-muted em-caption', attr: {'data-em-zotlit-status': ''}});
  citationStatus.setText(c.graph.snapshot.zotlit?.message ?? 'ZotLit-Zitatindex nicht verfügbar.');
  this.fieldSelect = select(this.networkControls, 'Beziehungsfeld', {'': 'Alle Felder'}, '', value => {this.filters.field = value; this.applyFilters();});
  const crossRow = this.networkControls.createEl('label', {cls: 'em-check-row'}), crossBox = crossRow.createEl('input', {type: 'checkbox'}); crossRow.appendText('Auch Verbindungen zwischen Nachbarn');
  crossBox.onchange = () => {this.crossEdges = crossBox.checked; this.renderContext();};
  const row = controls.createEl('label', {cls: 'em-check-row'}), box = row.createEl('input', {type: 'checkbox'}); row.appendText('Vorschläge separat unter dem Graphen anzeigen');
  box.onchange = () => {this.preview = box.checked; this.showProposals(); this.labelDensity();};
  const actions = controls.createDiv({cls: 'em-actions'});
  button(actions, 'Neu anordnen', () => {void c.run(() => this.layout());});
  button(actions, 'Index aktualisieren', () => {void c.run(async () => {await c.graph.refreshBreadcrumbs(); c.notify();});});
  const legend = disclosure(this.networkControls, 'Zeichen und Feldsemantik');
  const list = legend.createEl('dl', {cls: 'em-legend'});
  for (const [name, meaning] of [['Pfeil', 'Typisierte Beziehung oder Zitat'], ['Gepunktete Linie', 'Gewöhnlicher Link'], ['Gestrichelte Linie', 'ZotLit-Zitat, abgeleitete Beziehung oder beschrifteter Vorschlag; die Beschriftung nennt die Art'], ['@citekey', 'Zitierter Titel ohne eindeutige Literaturnotiz'], ['Hohler Knoten', 'Noch nicht angelegtes Ziel']]) {list.createEl('dt', {text: name}); list.createEl('dd', {text: meaning});}
  legend.createEl('p', {text: 'Unbekannte Feldsemantik wird nicht als Hierarchie interpretiert. Bedeutung und Richtung lassen sich in den Emergence-Einstellungen bestätigen.', cls: 'em-muted'});
  this.pathHost = this.host.createDiv({cls: 'em-graph-paths'}); this.pathHost.hidden = true;
  this.paths = new GraphPaths(this.pathHost, c, () => this.focusPath, (id, event) => {if (event?.button !== 1) this.mode = 'structure'; this.activateNode(id, event);});
  this.split = this.host.createDiv({cls: 'em-graph-split'});
  this.canvas = this.split.createDiv({cls: 'em-graph', attr: {role: 'region', 'aria-labelledby': this.contextLabelId, 'aria-describedby': `${this.contextLabelId}-status`}});
  this.canvas.style.setProperty('--em-graph-height', c.settings().graphHeight + 'px');
  this.details = this.split.createDiv({cls: 'em-details'}); this.details.hidden = true;
  this.pager = this.host.createDiv({cls: 'em-context-pager'});
  this.summary = this.host.createDiv({cls: 'em-graph-summary'});
  this.proposals = this.host.createDiv({cls: 'em-graph-proposals'}); this.proposals.hidden = true;
  this.semanticHost = this.canvas.createDiv(); this.networkHost = this.canvas.createDiv({cls: 'em-network-canvas'});
  this.semantic = new RelationsSynopsis(this.semanticHost,c.settings,(relation,depth)=>this.setDepth(relation,depth),{
   activate:(note,event)=>this.activateSynopsisNote(note,event),inspect:note=>this.inspectSynopsisNote(note),
   literature:target=>{void c.run(()=>openZotlitLibrary(c.app,target));},
   hover:(note,event,anchor)=>c.app.workspace.trigger('hover-link',{event,source:'emergence-synopsis',hoverParent:{hoverPopover:null},targetEl:anchor,linktext:note.linktext,sourcePath:note.sourcePath}),
  },(relation,source)=>{this.addModal?.close();this.addModal=new SynopsisAddModal(c,relation,source);this.addModal.open();},(field,source)=>{this.addModal?.close();this.addModal=new SynopsisAddModal(c,'examples',source,field);this.addModal.open();});
  this.cy = createGraph(this.networkHost);
  this.cy.on('dragpan scrollzoom grab', () => {this.manuallyExplored = true;});
  this.cy.on('zoom', () => this.labelDensity());
  this.cy.on('mouseover', 'node, edge', event => {const element = event.target as NodeSingular | EdgeSingular; element.addClass('em-hover'); this.canvas.title = String(element.data('title') ?? element.data('label') ?? '');});
  this.cy.on('mouseout', 'node, edge', event => {(event.target as NodeSingular | EdgeSingular).removeClass('em-hover'); this.canvas.removeAttribute('title');});
  this.cy.on('tap', 'node', event => {const node = event.target as NodeSingular; if (!node.data('caption') && event.originalEvent.button !== 1) this.activateNode(node.id(), event.originalEvent);});
  this.networkHost.onauxclick = event => {if(event.button !== 1 || !this.cy) return; event.preventDefault(); const bounds = this.networkHost.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top; const node = this.cy.nodes().filter(n => {const b=n.renderedBoundingBox(); return !n.data('caption') && x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;})[0]; if(node) this.activateNode(node.id(), event);};
  this.cy.on('cxttap', 'node', event => {const node = event.target as NodeSingular; if (!node.data('caption')) this.showNode(node.id());});
  this.cy.on('tap', 'edge', event => this.showEdge(event.target as EdgeSingular));
  this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.canvas);
  this.update();
 }
 private applyFilters(): void {this.page = 0; this.manuallyExplored = false; this.closeDetails(); this.renderContext();}
 private labelDensity(): void { /* Context cards always retain their labels. */ }
 private fitContext(_overview = false): void {
  if (this.mode === 'structure') {this.semantic.center(); return;}
  const cy = this.cy; if (!cy || !cy.nodes().length || !this.canvas.clientWidth || !this.canvas.clientHeight) return;
  cy.resize();
  cy.fit(cy.elements(), 22);
 }
 private async layout(): Promise<void> {
  const cy = this.cy; if (!cy) return;
  if (this.mode === 'structure') {this.fitContext(); return;}
  if (!this.context || this.mode === 'paths') return;
  const generation = this.layoutGeneration, current = () => generation === this.layoutGeneration && this.mode === 'network';
  const hierarchical = this.context.graph.edges.some(e => e.explicit && e.layer === 'breadcrumbs' && this.context!.graph.rules[e.field]?.hierarchical);
  const route = this.arrangement === 'context' || (this.arrangement === 'elk' && !hierarchical);
  cy.elements().toggleClass('context-route', route);
  if (route) arrangeContext(cy, this.focusPath, this.context.shown);
  else await runLayout(cy, this.context.graph, this.arrangement as 'elk' | 'fcose' | 'concentric', false, current);
  if (!current()) return;
  if (!cy.destroyed()) {applyLayers(cy, this.snapshot(), this.filters); if (!this.manuallyExplored) this.fitContext();}
  this.describeContext();
 }
 update(): void {
  const cy = this.cy; if (!cy) return;
  const c = this.controller, g = this.snapshot();this.refreshSources?.();
  const changedNote = this.lastActive !== c.activePath; this.lastActive = c.activePath;
  if (!this.focusPath || changedNote && this.follow) {this.focusPath = c.activePath; this.page = 0; this.manuallyExplored = false; this.closeDetails(); this.version = -1;}
  if (this.version !== g.version) {
   this.version = g.version;
   this.host.querySelector<HTMLElement>('[data-em-zotlit-status]')?.setText(`${g.zotlit?.message ?? 'ZotLit-Zitatindex nicht verfügbar.'}${g.zotlit?.edges ? ` ${g.zotlit.edges} Zitatverbindungen.` : ''}`);
   if (this.fieldSelect) {this.fieldSelect.empty(); this.fieldSelect.createEl('option', {value: '', text: 'Alle Felder'}); for (const field of g.fields) this.fieldSelect.createEl('option', {value: field, text: field}); this.fieldSelect.value = this.filters.field;}
   this.renderContext();
  }
  // Do not insert an unrelated active node into a deliberately pinned context.
  if (!cy.getElementById(c.activePath).empty()) highlightActive(cy, g, c.activePath);
  else cy.nodes().removeClass('active-note');
  if (changedNote) this.updateLabels();
  this.showProposals();
 }
 private renderContext(): void {
  this.layoutGeneration++;
  const cy = this.cy; if (!cy) return;
  const c = this.controller;
  this.modeSelect.value = this.mode; this.networkControls.hidden = this.mode !== 'network';
  this.semanticHost.hidden = this.mode !== 'structure'; this.networkHost.hidden = this.mode === 'structure';
  this.pathHost.hidden = this.mode !== 'paths'; this.split.hidden = this.mode === 'paths';
  cy.userPanningEnabled(this.mode !== 'paths'); cy.userZoomingEnabled(this.mode !== 'paths'); cy.autoungrabify(this.mode !== 'network');
  if (this.mode === 'paths') {this.paths.render(); this.contextHeading.setText(c.graph.snapshot.nodes.find(n => n.id === this.focusPath)?.title ?? 'Notiz öffnen'); this.contextStatus.setText('Breadcrumbs-Verbindungspfade'); this.pager.hidden = true; this.summary.hidden = true; return;}
  this.summary.hidden = false;
  if (this.mode === 'structure') {this.renderStructure(); return;}
  this.context = graphContext(this.snapshot(), this.focusPath, c.settings(), this.filters, this.page, this.pageSize, this.crossEdges);
  this.page = this.context.page;
  cy.batch(() => {cy.elements().remove(); cy.add(this.context!.elements); this.updateLabels();});
  if (this.context.graph.nodes.some(n => n.id === c.activePath)) highlightActive(cy, this.context.graph, c.activePath);
  this.showProposals(); this.pager.empty();
  if (this.context.pages > 1) {
   button(this.pager, 'Zurück', () => {this.page--; this.manuallyExplored = false; this.renderContext();}, this.page === 0);
   this.pager.createSpan({text: `${this.page + 1} / ${this.context.pages}`});
   button(this.pager, 'Weitere Nachbarn', () => {this.page++; this.manuallyExplored = false; this.renderContext();}, this.page + 1 >= this.context.pages);
  }
  this.pager.hidden = this.context.pages <= 1;
  this.describeContext(); void c.run(() => this.layout());
 }
 private renderStructure(): void {
  this.semantic.render(this.snapshot(),this.focusPath);
  this.contextHeading.setText('Relationssynopse');this.contextStatus.setText(this.explore?'Erkundungsmodus':'');
  this.pager.empty();this.pager.hidden=true;this.summary.hidden=true;
 }
 private setDepth(relation:SynopsisRelation,depth:SynopsisDepth):void{
  const s=this.controller.settings();s.synopsis={...s.synopsis,depths:{...s.synopsis?.depths,[relation]:depth}};
  this.semantic.render(this.snapshot(),this.focusPath);
  this.depthSave=this.depthSave.catch(()=>{}).then(()=>this.controller.persist());void this.controller.run(()=>this.depthSave);
 }
 private inspectSynopsisNote(note:SynopsisNote):void{
  if(this.snapshot().nodes.some(n=>n.id===note.id)){this.showNode(note.id);return;}
  this.openDetails(note.title);this.details.createDiv({text:note.linktext,cls:'em-path'});badge(this.details,'Noch nicht angelegt');
  button(this.details,'Link in Obsidian öffnen',()=>{void this.controller.run(()=>openSynopsisNote(this.controller,note));});
 }
 private activateSynopsisNote(note:SynopsisNote,event?:MouseEvent):void{
  if(this.explore&&!event?.metaKey&&!event?.ctrlKey&&event?.button!==1){if(this.snapshot().nodes.some(n=>n.id===note.id))this.focus(note.id);else this.inspectSynopsisNote(note);return;}
  this.follow=true;this.followBox.checked=true;void this.controller.run(()=>openSynopsisNote(this.controller,note,event?.button===1?'tab':event?Keymap.isModEvent(event):false));
 }
 private describeContext(): void {
  if(this.mode==='structure'){this.renderStructure();return;}
  if (!this.context) return;
  const g = this.snapshot(), concept = g.nodes.find(n => n.id === this.focusPath);
  this.contextHeading.setText(concept?.title ?? 'Zuerst eine Notiz öffnen');
  this.contextHeading.title = this.focusPath;
  this.contextStatus.setText(`${this.follow ? 'Folgt der aktuellen Notiz' : 'Fokus fixiert'} · ${this.context.shown.length} von ${this.context.total} Nachbarn`);
  this.summary.setText(`${this.context.total ? 'Direkte Beziehungen' : 'Keine direkten Beziehungen in diesen Filtern'} · ${g.partial ? 'Index noch unvollständig' : 'Index aktuell'}`);
  this.summary.title = `${g.nodes.length} Begriffe im globalen Register. ${g.edges.length} Rohbeziehungen bleiben unverändert. Pfeile beschreiben die gespeicherte Richtung.`;
  if (this.arrangement === 'elk' && !this.context.graph.edges.some(e => e.explicit && this.context!.graph.rules[e.field]?.hierarchical)) this.summary.setText('Keine bestätigte Hierarchie im Ausschnitt · Kontextanordnung');
 }
 private updateLabels(): void {
  if(this.mode==='structure')return;
  if (!this.cy) return;
  const canvas = this.canvas.ownerDocument.createElement('canvas'), context = canvas.getContext('2d'); if (!context) return;
  const font = themeFont(this.canvas);
  for (const node of this.cy.nodes()) {
   if (node.data('caption')) continue;
   context.font = `${node.id() === this.focusPath || node.id() === this.controller.activePath ? 'bold' : 'normal'} 13px ${font}`;
   const kicker = node.id() === this.controller.activePath ? 'Aktuelle Notiz' : node.id() === this.focusPath ? 'Fokus' : String(node.data('relation') ?? '');
   node.data('label', cardLabel(kicker, String(node.data('title') ?? node.id()), text => context.measureText(text).width, 188));
  }
 }
 private showProposals(): void {
  const revision = `${this.preview}:${this.controller.review.revision}`; if (revision === this.proposalRevision) return; this.proposalRevision = revision;
  this.proposals.empty(); this.proposals.hidden = !this.preview; if (!this.preview) return;
  const suggestions = this.controller.review.analysis?.suggestions.filter(s => s.status !== 'rejected') ?? [];
  this.proposals.createEl('h4', {text: `Beziehungsvorschläge (${suggestions.length})`});
  if (!suggestions.length) this.proposals.createDiv({text: 'Noch keine Vorschläge. Starte unter „Analyse“ eine Notizanalyse.', cls: 'em-muted'});
  for (const s of suggestions.slice(0, 3)) {
   const row = this.proposals.createDiv({cls: 'em-proposal-row'}); badge(row, s.field); badge(row, s.status === 'pending' ? 'Ungeprüft' : 'Angenommen – noch nicht geschrieben');
   row.createDiv({text: `${s.source.replace(/\.md$/u, '')} → ${s.target.replace(/\.md$/u, '')}`, cls: 'em-path'});
  }
  if (suggestions.length) button(this.proposals.createDiv({cls: 'em-actions'}), suggestions.length > 3 ? 'Alle Vorschläge prüfen' : 'Vorschläge prüfen', this.reviewProposals);
 }
 exploreItem(item: ZotlitSearchHit): void {
  const g = this.controller.graph.snapshot, path = item.notes.find(path => g.nodes.some(n => n.id === path));
  if(path){this.searchItem=undefined;this.exploreNote(path);return;}
  const known = g.nodes.find(n => n.citation?.indexedKey === item.indexedKey);
  this.searchItem=known ?? {id:'zotlit:item:'+encodeURIComponent(item.indexedKey),title:item.title,aliases:[],tags:[],type:'cited-work',exists:false,mtime:0,size:0,citation:{citekey:item.citekey||item.indexedKey,indexedKey:item.indexedKey,state:'noteless'}};
  this.exploreNote(this.searchItem.id);this.showNode(this.searchItem.id);
 }
 exploreNote(path: string): void {
  if(this.searchItem?.id !== path)this.searchItem=undefined;
  this.explore = true; this.exploreBox.checked = true; this.follow = false; this.followBox.checked = false;
  const citation = this.snapshot().nodes.find(n => n.id === path)?.citation;
  if (citation) {this.mode = 'network'; this.modeSelect.value = this.mode;}
  this.focus(path);
 }
 private activateNode(path: string, event?: MouseEvent): void {
  const concept = this.snapshot().nodes.find(n => n.id === path);
  if (!concept) return;
  if (event?.button === 1 && (concept.citation || this.snapshot().edges.some(e => e.layer === 'zotlit' && e.target === path))) return;
  const newLeaf = event?.button === 1 ? 'tab' : event ? Keymap.isModEvent(event) : false;
  if (!this.explore && (concept.citation || this.snapshot().edges.some(e => e.layer === 'zotlit' && e.target === path))) {void this.controller.run(() => openZotlitLibrary(this.controller.app, concept.citation ? {citekey: concept.citation.citekey, indexedKey:concept.citation.indexedKey} : {path})); return;}
  if (this.explore && !newLeaf) {this.focus(path); return;}
  if (concept.citation) {this.showNode(path); return;}
  if (!concept.exists) {void this.controller.run(() => openSynopsisNote(this.controller, {id:path,title:concept.title,linktext:path,sourcePath:this.focusPath,exists:false},newLeaf)); return;}
  this.follow = true; this.followBox.checked = true;
  void this.controller.run(async () => {if (await openGraphNote(this.controller, path, newLeaf)) this.focus(path);});
 }
 private focus(path: string): void {
  if (!this.cy) return;
  if (!this.snapshot().nodes.some(n => n.id === path)) return;
  this.focusPath = path; this.page = 0; this.manuallyExplored = false;
  if (path !== this.controller.activePath) this.follow = false;
  this.followBox.checked = this.follow; this.closeDetails(); this.renderContext();
 }
 private closeDetails(): void {if (this.details) {this.details.hidden = true; this.split.removeClass('has-selection');}}
 private openDetails(heading: string): void {
  this.details.empty(); this.details.hidden = false; this.split.addClass('has-selection');
  const line = this.details.createDiv({cls: 'em-details-heading'}); line.createEl('h4', {text: heading});
  iconButton(line, 'arrow-left', 'Zurück zur Karte', () => {this.closeDetails(); this.resize();});
 }
 private showNode(path: string): void {
  const c = this.controller, g = this.snapshot(), concept = g.nodes.find(n => n.id === path);
  this.openDetails(concept?.title ?? path); this.details.createDiv({text: path, cls: 'em-path'});
  if (path !== this.focusPath) button(this.details.createDiv({cls: 'em-actions'}), 'Hier weiter erkunden', () => this.focus(path));
  if (concept?.exists) button(this.details.createDiv({cls: 'em-actions'}), 'Notiz öffnen', () => {void c.run(() => openGraphNote(c, path).then(() => {}));});
  else if (concept?.citation) {
   const meanings = {missing: 'Zitierter Titel · Citekey in Zotero nicht aufgelöst', ambiguous: 'Zitierter Titel · Citekey mehrdeutig', noteless: 'Zitierter Titel · keine Literaturnotiz'};
   badge(this.details, meanings[concept.citation.state]);
   button(this.details.createDiv({cls:'em-actions'}), 'In ZotLit Library öffnen', () => {void c.run(() => openZotlitLibrary(c.app, {citekey:concept.citation!.citekey,indexedKey:concept.citation!.indexedKey}));});
  } else badge(this.details, 'Noch nicht angelegt – nur Wiki-Link');
  if (concept?.aliases.length) this.details.createDiv({text: `Auch: ${concept.aliases.join(', ')}`, cls: 'em-muted'});
  const edges = g.edges.filter(e => e.source === path || e.target === path), groups = new Map<string, Edge[]>();
  for (const e of edges) {const neighbor = e.source === path ? e.target : e.source; groups.set(neighbor, [...groups.get(neighbor) ?? [], e]);}
  this.details.createDiv({text: `${groups.size} verbundene Begriffe`, cls: 'em-muted em-caption'});
  for (const [neighbor, relations] of [...groups].slice(0, 20)) {
   const row = disclosure(this.details, g.nodes.find(n => n.id === neighbor)?.title ?? neighbor);
   for (const edge of relations) this.edgeDescription(row, edge);
  }
  if (groups.size > 20) this.details.createDiv({text: 'Weitere Beziehungen findest du in der Ansicht „Nachbarschaft und Links“.', cls: 'em-muted'});
  const paths = disclosure(this.details, 'Pfade und Rückverweise'); let field = g.fields[0] ?? '';
  select(paths, 'Beziehungsfeld', Object.fromEntries(g.fields.map(f => [f, f])), field, v => {field = v;}); const results = paths.createDiv();
  button(paths, 'Begrenzte Pfade anzeigen', () => {results.empty(); for (const p of boundedPaths(g, path, field, true)) results.createDiv({text: `${p.nodes.join(' → ')}${p.stopped === 'cycle' ? ' ↩ Rückverweis' : p.stopped === 'depth' ? ' … Tiefenlimit' : p.stopped === 'budget' ? ' … Anzeigegrenze' : ''}`, cls: 'em-path'});});
 }
 private showEdge(edge: EdgeSingular): void {
  this.openDetails(edge.hasClass('proposal') ? 'Beziehungsvorschlag' : 'Verbindung');
  if (edge.hasClass('proposal')) this.details.createEl('p', {text: 'Reine Vorschau. Die individuelle Entscheidung erfolgt unter „Analyse“.'});
  const raw = (edge.data('raw') as Edge[] | undefined) ?? [];
  for (const relation of raw) this.edgeDescription(this.details, relation);
  if (raw.length) disclosure(this.details, 'Technische Herkunft').createEl('pre', {text: JSON.stringify(raw, null, 2), cls: 'em-code-preview'});
 }
 private edgeDescription(parent: HTMLElement, edge: Edge): void {
  const row = parent.createDiv({cls: 'em-edge-description'}); badge(row, edge.field || 'Obsidian-Link');
  row.createDiv({text: `${edge.source} → ${edge.target}`, cls: 'em-path'});
  row.createDiv({text: edge.layer === 'zotlit' ? 'Zitat aus dem ZotLit-Zitatindex' : edge.explicit ? 'Explizit vorhanden' : 'Von Breadcrumbs abgeleitet', cls: 'em-muted'});
 }
 resize(): void {
  this.cy?.resize();
  this.refreshTheme();
  const width = this.canvas?.clientWidth ?? 0, height = this.canvas?.clientHeight ?? 0;
  const resized = width > 0 && height > 0 && (width !== this.viewportWidth || height !== this.viewportHeight);
  if (width && height) {this.viewportWidth = width; this.viewportHeight = height;}
  if (this.mode === 'structure') {if (resized) this.semantic.refresh(); return;}
  if (this.mode === 'paths') return;
  const size = Math.max(1, Math.min(5, Math.floor((this.canvas?.clientHeight - 110) / 106)));
  if (this.canvas?.clientHeight && size !== this.pageSize) {this.pageSize = size; this.page = 0; this.renderContext();}
  else if (resized && !this.manuallyExplored) this.fitContext();
 }
 refreshTheme(): void {
  this.semantic?.refresh();
  if (!this.cy) return; const v = (key: string, fallback: string) => themeColor(this.canvas, key, fallback);
  this.cy.style().selector('node').style({'background-color': v('--interactive-accent', '#8876d4'), color: v('--text-normal', '#ddd')})
   .selector('edge').style({'line-color': v('--interactive-accent', '#8876d4'), 'source-arrow-color': v('--interactive-accent', '#8876d4'), 'target-arrow-color': v('--interactive-accent', '#8876d4'), color: v('--text-muted', '#aaa')})
   .selector('.ordinary-link').style({'line-color': v('--text-faint', '#777')}).selector('.active-note').style({'border-color': v('--text-accent', '#e6ba77')})
   .selector('.citation-edge').style({'line-color': v('--text-accent', '#8876d4')}).selector('.citation-node').style({'border-color': v('--text-accent', '#8876d4')})
   .selector('.proposal').style({'line-color': v('--text-accent', '#e6ba77'), 'target-arrow-color': v('--text-accent', '#e6ba77')})
   .selector('.unresolved-proposal').style({'border-color': v('--text-accent', '#e6ba77')}).selector('.unresolved-node').style({'border-color': v('--text-muted', '#aaa')})
   .selector('.context-node').style({'background-color': v('--background-secondary', '#222'), 'border-color': v('--interactive-accent', '#8876d4'), 'font-family': themeFont(this.canvas)})
   .selector(':selected').style({'border-color': v('--text-normal', '#fff')}).update();
  this.cy.style().selector('.structure-lateral').style({'line-color': v('--text-muted', '#aaa')}).update();
  this.updateLabels();
 }
 destroy(): void {this.addModal?.close();this.semantic?.destroy(); this.layoutGeneration++; this.resizeObserver?.disconnect(); this.cy?.destroy(); this.cy = undefined;}
}
