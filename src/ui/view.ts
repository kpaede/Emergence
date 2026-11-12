import {t as tr} from '../i18n';
import {ItemView, setIcon, type WorkspaceLeaf} from 'obsidian';
import type {EmergenceController} from '../controller';
import {GraphPanel} from './graph-panel';
import {initialPanelState, type PanelContext, type Tab} from './panel';
import {renderAnalysis} from './panels/analysis';
import {SearchPanel} from './search-panel';
import {errorMessage} from '../util';
import {DisclosureState} from './disclosure-state';
import {ArgdownPanel} from '../argdown/panel';
import {MermaidPanel} from '../mermaid/panel';
import type {MermaidLibrary} from '../mermaid/library';
import {featureEnabled,featureForTab} from '../features';

export const VIEW_TYPE = 'emergence-workspace';
const tabs: {id: Tab; label: string; full: string; icon: string}[] = [
 {id:'graph',get label() {return tr("common.graph");},get full() {return tr("common.context_and_native_views");},icon:'network'},
 {id:'analysis',get label() {return tr("common.field_ideas");},get full() {return tr("common.breadcrumbs_field_ideas");},icon:'text-search'},
 {id:'mermaid',get label() {return tr("mermaid.mermaid");},get full() {return tr("common.edit_mermaid_diagrams_visually_and_in_source");},icon:'workflow'},
 {id:'argdown',get label() {return tr("argdown.argdown");},get full() {return tr("common.edit_argument_maps_visually_and_in_source");},icon:'git-fork'},
 {id:'search',get label() {return tr("common.search");},get full() {return tr("common.search_notes_and_zotero_2");},icon:'search'},
];
export class EmergenceView extends ItemView {
 private tab: Tab = 'graph';
 private empty?:HTMLElement;
 private searchPanel?: SearchPanel;
 private graphPanel?: GraphPanel;
 mermaidPanel?: MermaidPanel;
 argdownPanel?: ArgdownPanel;
 private panels = new Map<Tab, HTMLElement>();
 private nav = new Map<Tab, HTMLButtonElement>();
 private status!: HTMLElement;
 private statusDetails!: HTMLElement;
 private unsubscribe?: () => void;
 private state = initialPanelState();
 private errors = new Map<Tab, string>();
 private renderGeneration = 0;
 private fingerprint = '';
 private tabId = crypto.randomUUID();
 private disclosures = new Map<Tab, DisclosureState>();
 private interactionHeld = false; private dragging = false; private updatePending = false; private forcePending = false; private updateFrame?: number;
 constructor(leaf: WorkspaceLeaf, readonly controller: EmergenceController, private mermaidLibrary: MermaidLibrary, private argdownLibrary: MermaidLibrary) {super(leaf);}
 onNoteRename(oldPath:string,newPath:string):void{this.graphPanel?.onNoteRename(oldPath,newPath);this.fingerprint='';}
 getViewType(): string {return VIEW_TYPE;}
 getDisplayText(): string {return tr("common.emergence");}
 getIcon(): string {return 'network';}
 async onOpen(): Promise<void> {
  this.contentEl.empty(); this.contentEl.addClass('em-workspace');
  const header = this.contentEl.createDiv({cls: 'em-header'});
  const line = header.createDiv({cls: 'em-heading-line'}); line.createSpan({text: tr("common.emergence"), cls: 'em-brand'});
  const statusBox = header.createEl('details', {cls: 'em-status-disclosure'});
  this.status = statusBox.createEl('summary', {text: tr("common.ready"), attr: {'aria-label': tr("common.show_operational_status")}});
  this.statusDetails = statusBox.createDiv({cls: 'em-status-details'});
  line.append(statusBox);
  const nav = header.createDiv({cls: 'em-tabs', attr: {role: 'tablist', 'aria-label': tr("common.emergence_views")}});
  const body = this.contentEl.createDiv({cls: 'em-body'});
  for (const {id, label, full, icon} of tabs) {
   const button = nav.createEl('button', {text: label, attr: {role: 'tab', id: `${this.tabId}-${id}`, 'aria-controls': `${this.tabId}-panel-${id}`, title: full, 'aria-label':id==='search'?tr("common.search"):label, type: 'button'}});
   setIcon(button.createSpan({cls: 'em-tab-icon', attr: {'aria-hidden': 'true'}}), icon);
   button.onclick = () => this.switchTab(id);
   button.onkeydown = event => {
    const visible=tabs.filter(tab=>featureEnabled(this.controller.settings(),featureForTab(tab.id))),index = visible.findIndex(t => t.id === id);
    const next = event.key === 'ArrowRight' ? (index + 1) % visible.length : event.key === 'ArrowLeft' ? (index + visible.length - 1) % visible.length : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : -1;
    if (next >= 0) {event.preventDefault(); const target = visible[next]!.id; this.switchTab(target); this.nav.get(target)?.focus();}
   };
   this.nav.set(id, button);
   this.panels.set(id, body.createDiv({cls: `em-panel em-panel-${id}`, attr: {role: 'tabpanel', id: `${this.tabId}-panel-${id}`, 'aria-labelledby': `${this.tabId}-${id}`, tabindex: '0'}}));
  }
  this.empty=body.createDiv({cls:'em-message',text:tr('settings.noFeatures')});this.applyFeatures();
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.graphPanel?.update()));
  const doc = this.contentEl.ownerDocument, win = doc.defaultView ?? window;
  this.registerDomEvent(this.contentEl, 'pointerdown', () => {this.interactionHeld = true;}, {capture: true});
  this.registerDomEvent(this.contentEl, 'keydown', event => {
   if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && event.target.closest('button, summary, select, input[type=checkbox]')) this.interactionHeld = true;
  }, {capture: true});
  const release = () => {
   if (this.dragging) return;
   this.interactionHeld = false;
   if (!this.updatePending || this.updateFrame !== undefined) return;
   this.updateFrame = win.requestAnimationFrame(() => {this.updateFrame = undefined; const force = this.forcePending; this.updatePending = this.forcePending = false; this.update(force);});
  };
  this.registerDomEvent(this.contentEl, 'dragstart', event => {
   this.dragging = true; this.interactionHeld = true;
   queueMicrotask(() => {if (event.defaultPrevented) {this.dragging = false; release();}});
  }, {capture: true});
  const endDrag = () => {this.dragging = false; release();};
  this.registerDomEvent(doc, 'dragend', endDrag);
  this.registerDomEvent(doc, 'drop', endDrag);
  this.registerDomEvent(doc, 'pointerup', release, {capture: true});
  this.registerDomEvent(doc, 'pointercancel', release, {capture: true});
  this.registerDomEvent(doc, 'keyup', release, {capture: true});
  this.registerDomEvent(this.contentEl, 'change', release, {capture: true});
  this.registerDomEvent(win, 'blur', endDrag);
  this.register(() => {if (this.updateFrame !== undefined) win.cancelAnimationFrame(this.updateFrame);});
  this.unsubscribe = this.controller.subscribe(() => this.update()); this.switchTab('graph');
 }
 switchTab(tab: Tab): void {
  const visible=tabs.filter(tab=>featureEnabled(this.controller.settings(),featureForTab(tab.id)));if(!visible.length)return;
  if (!this.panels.has(tab)||!featureEnabled(this.controller.settings(),featureForTab(tab))) tab = visible[0]!.id;
  const previous = this.panels.get(this.tab); if (previous) this.disclosures.get(this.tab)?.capture(previous);
  this.tab = tab; this.fingerprint = '';
  for (const [id, panel] of this.panels) panel.hidden = id !== tab;
  for (const [id, button] of this.nav) {button.setAttribute('aria-selected', String(id === tab)); button.tabIndex = id === tab ? 0 : -1;}
  this.update(); if (tab === 'graph') this.graphPanel?.resize(); if (tab === 'mermaid') void this.mermaidPanel?.activate(); if (tab === 'argdown') void this.argdownPanel?.activate();
 }
 applyFeatures():void{
  if(!this.empty)return;const settings=this.controller.settings();
  if(featureEnabled(settings,'graph')&&!this.graphPanel){this.graphPanel=new GraphPanel(this.controller,this.panels.get('graph')!,this.leaf);this.graphPanel.mount();}
  if(featureEnabled(settings,'search')&&!this.searchPanel){this.searchPanel=new SearchPanel(this.controller,this.panels.get('search')!,()=>this.state.search,path=>{if(featureEnabled(this.controller.settings(),'graph')){this.switchTab('graph');this.graphPanel?.exploreNote(path);}});this.searchPanel.mount();}
  if(featureEnabled(settings,'mermaid')&&!this.mermaidPanel)this.mermaidPanel=this.addChild(new MermaidPanel(this.app,this.panels.get('mermaid')!,()=>this.app.vault.getFileByPath(this.controller.activePath)??undefined,this.mermaidLibrary));
  if(featureEnabled(settings,'argdown')&&!this.argdownPanel)this.argdownPanel=this.addChild(new ArgdownPanel(this.app,this.panels.get('argdown')!,()=>this.app.vault.getFileByPath(this.controller.activePath)??undefined,this.argdownLibrary));
  this.graphPanel?.setEnabled(featureEnabled(settings,'graph'));this.searchPanel?.setEnabled(featureEnabled(settings,'search'));this.mermaidPanel?.setEnabled(featureEnabled(settings,'mermaid'));this.argdownPanel?.setEnabled(featureEnabled(settings,'argdown'));
  for(const {id}of tabs)this.nav.get(id)!.hidden=!featureEnabled(settings,featureForTab(id));
  const visible=tabs.filter(tab=>featureEnabled(settings,featureForTab(tab.id)));this.empty.hidden=visible.length>0;
  const navigation=this.contentEl.querySelector<HTMLElement>('.em-tabs');if(navigation){navigation.hidden=!visible.length;navigation.style.gridTemplateColumns=visible.map(tab=>`minmax(0, ${tab.id==='analysis'?1.3:tab.id==='graph'||tab.id==='search'?.85:1.15}fr)`).join(' ');}
  if(visible.length)this.switchTab(this.tab);else{for(const panel of this.panels.values())panel.hidden=true;for(const button of this.nav.values()){button.tabIndex=-1;button.setAttribute('aria-selected','false');}}
 }
 private update(force = false): void {
  // Never replace a pressed control between pointer/key down and its click.
  if (this.interactionHeld) {this.updatePending = true; this.forcePending ||= force; return;}
  const c = this.controller, g = c.graph.snapshot, a = c.review.analysis;
  const pending = (a?.source===c.activePath?a.suggestions.filter(s => s.status === 'pending').length:0) ?? 0;
  this.status.setText(c.abort ? tr("common.request_running") : pending ? tr("common.unreviewed_2", {value1: pending}) : tr("labels.local"));
  this.statusDetails.empty();
  const list = this.statusDetails.createEl('dl');
  for (const [name, value] of [['Breadcrumbs', g.breadcrumbsVersion], [tr("labels.graph_index"), g.partial ? tr("common.still_incomplete") : tr("labels.current")], ['Ollama', c.ollamaStatus], [tr("common.model"), c.settings().model], [tr("labels.context_window"), String(c.settings().numCtx)], [tr("common.activity"), c.status]]) {
   list.createEl('dt', {text: name}); list.createEl('dd', {text: value});
  }
  this.graphPanel?.update(); this.searchPanel?.update(); if (this.tab === 'argdown') {this.argdownPanel?.context(); return;} if (this.tab === 'mermaid') {void this.mermaidPanel?.context(); return;} if (this.tab === 'graph' || this.tab === 'search') return;
  if(!featureEnabled(c.settings(),featureForTab(this.tab)))return;
  const fingerprint = JSON.stringify([this.tab, g.version, c.review.revision, c.activePath, c.status, !!c.abort, c.applyingIdea, !!c.profilePromptSave, c.settings().activeProfile]);
  if (!force && fingerprint === this.fingerprint) return; this.fingerprint = fingerprint;
  const panel = this.panels.get(this.tab)!, focused = panel.ownerDocument.activeElement;
  const editable = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || focused instanceof HTMLSelectElement ? focused : undefined;
  const key = focused instanceof HTMLElement && panel.contains(focused) ? focused.dataset.emFocus : undefined;
  const selection = editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement ? [editable.selectionStart, editable.selectionEnd] : undefined;
  const expanded = this.disclosures.get(this.tab) ?? new DisclosureState(); this.disclosures.set(this.tab, expanded); expanded.capture(panel);
  const scroll = panel.scrollTop; panel.empty(); const generation = ++this.renderGeneration, tab = this.tab;
  const context: PanelContext = {host: panel, controller: c, state: this.state, navigate: next => this.switchTab(next), repaint: () => this.update(true),
   isCurrent: () => this.tab === tab && this.renderGeneration === generation,
   run: async action => {try {this.errors.delete(tab); await action();} catch (error) {this.errors.set(tab, errorMessage(error));} if (this.tab === tab) this.update(true);},
  };
  const error = this.errors.get(tab); if (error) panel.createDiv({text: error, cls: 'em-message em-error', attr: {role: 'alert'}});
  if (tab === 'analysis') renderAnalysis(context);
  const restore = () => {
   if (!context.isCurrent()) return;
   expanded.restore(panel);
   if (key) {
    let replacement = Array.from(panel.querySelectorAll<HTMLElement>('[data-em-focus]')).find(el => el.dataset.emFocus === key);
    if (!replacement && key.startsWith('idea-')) replacement = panel.querySelector<HTMLElement>('.em-idea-accept:not(:disabled), .em-idea-undo button:not(:disabled)') ?? undefined;
    if (replacement instanceof HTMLButtonElement && replacement.disabled) replacement = panel.querySelector<HTMLElement>('.em-suggestion[data-decision="pending"] button:not(:disabled), .em-finalize button:not(:disabled)') ?? undefined;
    replacement?.focus({preventScroll: true});
    if (selection && (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement)) try {replacement.setSelectionRange(selection[0] ?? 0, selection[1] ?? 0);} catch { /* Non-text input. */ }
   }
   panel.scrollTop = scroll;
  };
  restore();
 }
 onResize(): void {this.graphPanel?.resize();}
 refreshTheme(): void {this.graphPanel?.refreshTheme();}
 refreshLanguage():void{
  this.empty?.setText(tr('settings.noFeatures'));
  this.status.setAttribute('aria-label',tr('common.show_operational_status'));this.contentEl.querySelector('[role=tablist]')?.setAttribute('aria-label',tr('common.emergence_views'));
  for(const {id,label,full}of tabs){const button=this.nav.get(id);if(button){button.firstChild!.textContent=label;button.setAttribute('aria-label',label);button.title=full;}}
  this.graphPanel?.refreshLanguage();this.searchPanel?.refreshLanguage();this.mermaidPanel?.refreshLanguage();this.argdownPanel?.refreshLanguage();this.fingerprint='';this.update(true);
 }
 async onClose(): Promise<void> {await this.mermaidPanel?.run(() => this.mermaidPanel?.flush()); await this.argdownPanel?.run(() => this.argdownPanel?.flush()); this.unsubscribe?.(); this.searchPanel?.destroy(); await this.graphPanel?.destroy(); this.controller.writer.invalidate(); this.contentEl.empty();}
}
