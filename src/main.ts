import {Plugin} from 'obsidian';
import type {JournalEntry, Settings} from './types';
import {migrateSettings} from './config';
import {EmergenceController} from './controller';
import {EmergenceSettingsTab} from './settings';
import {EmergenceView, VIEW_TYPE} from './ui/view';

export default class EmergencePlugin extends Plugin {
 settings!: Settings;
 controller!: EmergenceController;
 private journal: JournalEntry[] = [];
 async onload(): Promise<void> {
  const loaded: unknown = await this.loadData();
  const data = loaded && typeof loaded === 'object' ? loaded as {settings?: unknown; journal?: JournalEntry[]} : {};
  this.settings = migrateSettings(data.settings);
  this.journal = Array.isArray(data.journal) ? data.journal : [];
  this.controller = new EmergenceController(this.app, () => this.settings, async entries => {this.journal = entries; await this.saveSettings();}, this.journal, () => this.saveSettings());
  const c = this.controller;
  this.registerHoverLinkSource('emergence-synopsis',{display:'Emergence Relationssynopse',defaultMod:true});
  this.registerView(VIEW_TYPE, leaf => new EmergenceView(leaf, c));
  this.addSettingTab(new EmergenceSettingsTab(this.app, this));
  this.addRibbonIcon('network', 'Emergence öffnen', () => {void c.run(() => this.open());});
  this.addCommand({id: 'open-workspace', name: 'Wissensgraph und Analyse öffnen', callback: () => {c.captureActive(); void c.run(() => this.open());}});
  this.addCommand({id: 'analyze-current-note', name: 'Aktuelle Notiz lokal klassifizieren', editorCallback: (editor, view) => {
   if (!view.file) return; c.activePath = view.file.path; c.selection = editor.getSelection();
   void c.run(async () => {const panel = await this.open(); panel?.switchTab('analysis'); await c.analyze();});
  }});
  this.addCommand({id: 'cancel-analysis', name: 'Laufende Modellanfrage abbrechen', callback: () => c.cancel()});
  this.addCommand({id: 'refresh-graph', name: 'Breadcrumbs und Graph aktualisieren', callback: () => {void c.run(async () => {await c.graph.refreshBreadcrumbs(); c.notify();});}});
  let breadcrumbDirty = false;
  const schedule = this.debounce(() => {if (breadcrumbDirty) {breadcrumbDirty = false; void c.run(async () => {await c.graph.refreshBreadcrumbs(); c.notify();});} else c.rebuild();}, 600);
  this.registerEvent(this.app.metadataCache.on('changed', () => {breadcrumbDirty = true; schedule();}));
  this.registerEvent(this.app.metadataCache.on('resolve', schedule));
  this.registerEvent(this.app.metadataCache.on('resolved', () => {c.graph.resolved = true; schedule();}));
  this.registerEvent(this.app.vault.on('rename', schedule));
  this.registerEvent(this.app.vault.on('delete', schedule));
  this.registerEvent(this.app.vault.on('create', schedule));
  this.registerEvent(this.app.workspace.on('file-open', file => {if (file?.extension === 'md') c.activePath = file.path; c.captureActive(); c.notify();}));
  this.registerEvent(this.app.workspace.on('css-change', () => {
   for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) if (leaf.view instanceof EmergenceView) leaf.view.refreshTheme();
  }));
  this.app.workspace.onLayoutReady(() => {c.captureActive(); c.rebuild(); void c.run(async () => {await c.graph.refreshBreadcrumbs(); c.notify();});});
  this.registerInterval(window.setInterval(schedule, 30000));
 }
 private debounce(callback: () => void, delay: number): () => void {
  let timer: number | undefined;
  this.register(() => {if (timer) window.clearTimeout(timer);});
  return () => {if (timer) window.clearTimeout(timer); timer = window.setTimeout(callback, delay);};
 }
 async open(): Promise<EmergenceView | undefined> {
  this.controller.captureActive();
  let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
  if (leaf && leaf.getRoot() !== this.app.workspace.rightSplit) {leaf.detach(); leaf = undefined;}
  if (!leaf) {
   const sidebar = this.app.workspace.getRightLeaf(false); if (!sidebar) return;
   leaf = sidebar; await leaf.setViewState({type: VIEW_TYPE, active: false});
  }
  await this.app.workspace.revealLeaf(leaf);
  return leaf.view instanceof EmergenceView ? leaf.view : undefined;
 }
 async saveSettings(): Promise<void> {await this.saveData({settings: this.settings, journal: this.journal});}
 onunload(): void {this.controller?.dispose();}
}
