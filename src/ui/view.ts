import {ItemView, setIcon, type WorkspaceLeaf} from 'obsidian';
import type {EmergenceController} from '../controller';
import {GraphPanel} from './graph-panel';
import {initialPanelState, type PanelContext, type Tab} from './panel';
import {renderAnalysis} from './panels/analysis';
import {renderInquiry} from './panels/inquiry';
import {SearchPanel} from './search-panel';
import {errorMessage} from '../util';
import {DisclosureState} from './disclosure-state';

export const VIEW_TYPE = 'emergence-workspace';
const tabs: {id: Tab; label: string; full: string; icon: string}[] = [
 {id:'graph',label:'Graph',full:'Relationssynopse und native Ansichten',icon:'network'},
 {id:'analysis',label:'Feldideen',full:'Breadcrumbs-Feldideen',icon:'text-search'},
 {id:'inquiry',label:'Recherche',full:'Beispiele und Kunstwerke recherchieren',icon:'list-plus'},
 {id:'search',label:'Suche',full:'Notizen und Zotero durchsuchen',icon:'search'},
];
export class EmergenceView extends ItemView {
 private tab: Tab = 'graph';
 private searchPanel?: SearchPanel;
 private graphPanel?: GraphPanel;
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
 private interactionHeld = false; private updatePending = false; private forcePending = false; private updateFrame?: number;
 constructor(leaf: WorkspaceLeaf, readonly controller: EmergenceController) {super(leaf);}
 getViewType(): string {return VIEW_TYPE;}
 getDisplayText(): string {return 'Emergence';}
 getIcon(): string {return 'network';}
 async onOpen(): Promise<void> {
  this.contentEl.empty(); this.contentEl.addClass('em-workspace');
  const header = this.contentEl.createDiv({cls: 'em-header'});
  const line = header.createDiv({cls: 'em-heading-line'}); line.createSpan({text: 'Emergence', cls: 'em-brand'});
  const statusBox = header.createEl('details', {cls: 'em-status-disclosure'});
  this.status = statusBox.createEl('summary', {text: 'Bereit', attr: {'aria-label': 'Betriebsstatus anzeigen'}});
  this.statusDetails = statusBox.createDiv({cls: 'em-status-details'});
  line.append(statusBox);
  const nav = header.createDiv({cls: 'em-tabs', attr: {role: 'tablist', 'aria-label': 'Emergence-Ansichten'}});
  const body = this.contentEl.createDiv({cls: 'em-body'});
  for (const {id, label, full, icon} of tabs) {
   const button = nav.createEl('button', {text: label, attr: {role: 'tab', id: `${this.tabId}-${id}`, 'aria-controls': `${this.tabId}-panel-${id}`, title: full, 'aria-label':id==='search'?'Suche':label, type: 'button'}});
   setIcon(button.createSpan({cls: 'em-tab-icon', attr: {'aria-hidden': 'true'}}), icon);
   button.onclick = () => this.switchTab(id);
   button.onkeydown = event => {
    const index = tabs.findIndex(t => t.id === id);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next >= 0) {event.preventDefault(); const target = tabs[next]!.id; this.switchTab(target); this.nav.get(target)?.focus();}
   };
   this.nav.set(id, button);
   this.panels.set(id, body.createDiv({cls: `em-panel em-panel-${id}`, attr: {role: 'tabpanel', id: `${this.tabId}-panel-${id}`, 'aria-labelledby': `${this.tabId}-${id}`, tabindex: '0'}}));
  }
  this.graphPanel = new GraphPanel(this.controller, this.panels.get('graph')!, this.leaf); this.graphPanel.mount();
  this.searchPanel = new SearchPanel(this.controller, this.panels.get('search')!, () => this.state.search, path => {this.switchTab('graph'); this.graphPanel?.exploreNote(path);}); this.searchPanel.mount();
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.graphPanel?.update()));
  const doc = this.contentEl.ownerDocument, win = doc.defaultView ?? window;
  this.registerDomEvent(this.contentEl, 'pointerdown', () => {this.interactionHeld = true;}, {capture: true});
  this.registerDomEvent(this.contentEl, 'keydown', event => {
   if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && event.target.closest('button, summary, select, input[type=checkbox]')) this.interactionHeld = true;
  }, {capture: true});
  const release = () => {
   this.interactionHeld = false;
   if (!this.updatePending || this.updateFrame !== undefined) return;
   this.updateFrame = win.requestAnimationFrame(() => {this.updateFrame = undefined; const force = this.forcePending; this.updatePending = this.forcePending = false; this.update(force);});
  };
  this.registerDomEvent(doc, 'pointerup', release, {capture: true});
  this.registerDomEvent(doc, 'pointercancel', release, {capture: true});
  this.registerDomEvent(doc, 'keyup', release, {capture: true});
  this.registerDomEvent(this.contentEl, 'change', release, {capture: true});
  this.registerDomEvent(win, 'blur', release);
  this.register(() => {if (this.updateFrame !== undefined) win.cancelAnimationFrame(this.updateFrame);});
  this.unsubscribe = this.controller.subscribe(() => this.update()); this.switchTab('graph');
 }
 switchTab(tab: Tab): void {
  if (!this.panels.has(tab)) tab = 'analysis';
  const previous = this.panels.get(this.tab); if (previous) this.disclosures.get(this.tab)?.capture(previous);
  this.tab = tab; this.fingerprint = '';
  for (const [id, panel] of this.panels) panel.hidden = id !== tab;
  for (const [id, button] of this.nav) {button.setAttribute('aria-selected', String(id === tab)); button.tabIndex = id === tab ? 0 : -1;}
  this.update(); if (tab === 'graph') this.graphPanel?.resize();
 }
 private update(force = false): void {
  // Never replace a pressed control between pointer/key down and its click.
  if (this.interactionHeld) {this.updatePending = true; this.forcePending ||= force; return;}
  const c = this.controller, g = c.graph.snapshot, a = c.review.analysis;
  const pending = (a?.source===c.activePath?a.suggestions.filter(s => s.status === 'pending').length:0) ?? 0;
  this.status.setText(c.abort ? 'Anfrage läuft' : pending ? `${pending} ungeprüft` : 'Lokal');
  this.statusDetails.empty();
  const list = this.statusDetails.createEl('dl');
  for (const [name, value] of [['Breadcrumbs', g.breadcrumbsVersion], ['Graphindex', g.partial ? 'Noch unvollständig' : 'Aktuell'], ['Ollama', c.ollamaStatus], ['Modell', c.settings().model], ['Kontextfenster', String(c.settings().numCtx)], ['Aktivität', c.status]]) {
   list.createEl('dt', {text: name}); list.createEl('dd', {text: value});
  }
  this.graphPanel?.update(); this.searchPanel?.update(); if (this.tab === 'graph' || this.tab === 'search') return;
  const fingerprint = JSON.stringify([this.tab, g.version, c.review.revision, c.activePath, c.status, !!c.abort, c.applyingIdea, !!c.profilePromptSave, c.settings().activeProfile, c.inquiryHistory.length,c.currentResearch?.prompt,c.currentResearch?.answer]);
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
  if (tab === 'inquiry') renderInquiry(context);
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
 async onClose(): Promise<void> {this.unsubscribe?.(); this.searchPanel?.destroy(); await this.graphPanel?.destroy(); this.controller.writer.invalidate(); this.contentEl.empty();}
}
