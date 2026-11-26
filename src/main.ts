import {GraphRefresh} from './graph/refresh';
import {CompanionService} from './companion/service';
import {registerCompanionLive} from './companion/live';
import {registerCompanionCommands} from './companion/register';
import {TetradStore} from './tetrad/patterns';
import {registerTetrad} from './tetrad/register';
import {defaultTetradFormat} from './tetrad/preferences';
import type {TetradProcessor} from './tetrad/processor';
import {t as tr} from './i18n';
import {getLanguage, Notice, Plugin, setTooltip, type Command} from 'obsidian';
import type {JournalEntry, Settings} from './types';
import {migrateSettings} from './config';
import {renamedPath} from './graph/rename';
import {EmergenceController} from './controller';
import {EmergenceSettingsTab} from './settings';
import {EmergenceView, VIEW_TYPE} from './ui/view';
import {registerMermaidNoteControls,refreshDiagramControls} from './mermaid/note-controls';
import {registerArgdown} from './argdown/note-controls';
import {ARGDOWN_EXAMPLES} from './argdown/blocks';
import {MermaidLibrary} from './mermaid/library';
import {initializeLanguage,type TranslationKey} from './i18n';
import {TemplateFolders} from './diagrams/template-folders';
import {featureEnabled,anyFeatureEnabled,knowledgeFeaturesEnabled,type Feature} from './features';
import {localizedCommand,refreshCommandLanguage} from './i18n/commands';

export default class EmergencePlugin extends Plugin {
 settings!: Settings;
 controller!: EmergenceController;
 mermaidLibrary!: MermaidLibrary;
 argdownLibrary!: MermaidLibrary;
 tetradStore!:TetradStore;
 companionService!:CompanionService;
 private saves:Promise<void>=Promise.resolve();
 private tetradProcessor?:TetradProcessor;
 templateFolders!:TemplateFolders;
 private journal: JournalEntry[] = [];
 private ribbon?:HTMLElement;
 private knowledgeActive?:boolean;
 async onload(): Promise<void> {
  const loaded: unknown = await this.loadData();
  const data = loaded && typeof loaded === 'object' ? loaded as {settings?: unknown; journal?: JournalEntry[]; mermaidLibrary?: unknown; argdownLibrary?: unknown; tetrader?:unknown;companion?:unknown} : {};
  this.settings = migrateSettings(data.settings);
  initializeLanguage(this.settings.uiLanguage ?? 'auto', getLanguage());
  this.journal = Array.isArray(data.journal) ? data.journal : [];
  this.mermaidLibrary = new MermaidLibrary(data.mermaidLibrary, () => this.saveSettings());
  this.argdownLibrary = new MermaidLibrary(data.argdownLibrary, () => this.saveSettings(), ARGDOWN_EXAMPLES);
  this.tetradStore=new TetradStore(data.tetrader,()=>this.saveSettings());
  this.companionService=this.addChild(new CompanionService(this.app,data.companion,()=>this.settings,()=>this.saveSettings()));
  registerCompanionLive(this,this.companionService);
  registerCompanionCommands(this,this.companionService,()=>this.open());
  this.templateFolders=this.addChild(new TemplateFolders(this.app,()=>this.settings,{mermaid:this.mermaidLibrary,argdown:this.argdownLibrary}));
  this.controller = new EmergenceController(this.app, () => this.settings, async entries => {this.journal = entries; await this.saveSettings();}, this.journal, () => this.saveSettings());
  const c = this.controller;
  this.registerHoverLinkSource('emergence-synopsis',{display:tr("common.emergence_context"),defaultMod:true});
  this.registerView(VIEW_TYPE, leaf => new EmergenceView(leaf, c, this.mermaidLibrary, this.argdownLibrary,this.tetradStore,this.companionService));
  registerMermaidNoteControls(this, async (file, index) => {if(!featureEnabled(this.settings,'mermaid'))return;const view = await this.open(); if (view) {view.switchTab('mermaid'); await view.mermaidPanel?.openBlock(file, index);}}, error => new Notice(error instanceof Error ? error.message : String(error)),()=>featureEnabled(this.settings,'mermaid'));
  registerArgdown(this, async (file, index) => {if(!featureEnabled(this.settings,'argdown'))return;const view = await this.open(); if (view) {view.switchTab('argdown'); await view.argdownPanel?.openBlock(file, index);}}, error => new Notice(error instanceof Error ? error.message : String(error)),()=>featureEnabled(this.settings,'argdown'));
  this.tetradProcessor=registerTetrad(this,this.tetradStore,()=>featureEnabled(this.settings,'tetrad'),async(file,index)=>{const view=await this.open();if(view){view.switchTab('tetrad');await view.tetradPanel?.openBlock(file,index);}},()=>this.open(),()=>defaultTetradFormat(this.settings));
  this.addSettingTab(new EmergenceSettingsTab(this.app, this));
  this.ribbon=this.addRibbonIcon('network', tr("common.open_emergence"), () => {void c.run(() => this.open());});
  this.ribbon.addClass('em-ribbon');
  this.localizedCommand("common.open_knowledge_graph_and_analysis",{id: 'open-workspace', callback: () => {c.captureActive(); void c.run(() => this.open());}});
  this.localizedCommand("common.open_argdown_editor",{id: 'open-argdown-editor', callback: () => {void c.run(async () => {(await this.open())?.switchTab('argdown');});}});
  this.localizedCommand("common.open_mermaid_editor",{id: 'open-mermaid-editor', callback: () => {void c.run(async () => {(await this.open())?.switchTab('mermaid');});}});
  this.localizedCommand("common.classify_current_note_locally",{id: 'analyze-current-note', editorCallback: (editor, view) => {
   if (!view.file) return; c.activePath = view.file.path; c.selection = editor.getSelection();
   void c.run(async () => {const panel = await this.open(); panel?.switchTab('analysis'); await c.analyze();});
  }});
  this.localizedCommand("common.cancel_running_model_request",{id: 'cancel-analysis', callback: () => c.cancel()});
  this.localizedCommand("common.refresh_breadcrumbs_and_graph",{id: 'refresh-graph', callback: () => {void c.run(async () => {await c.refreshKnowledgeGraph(true);});}});
  this.applyFeatures();
  const views=()=>this.app.workspace.getLeavesOfType(VIEW_TYPE).map(leaf=>leaf.view).filter((view):view is EmergenceView=>view instanceof EmergenceView);
  const refresh=new GraphRefresh({enabled:()=>knowledgeFeaturesEnabled(this.settings),visible:()=>views().some(view=>view.usesKnowledgeGraph),interacting:()=>views().some(view=>view.companionPanel?.draggingEntries),rebuild:()=>c.graph.rebuild(),refresh:()=>c.graph.refreshBreadcrumbs(),changed:()=>c.notify(),error:reason=>{void c.run(()=>{throw reason;});}});
  this.register(()=>refresh.dispose());c.knowledgeViewOpened=()=>refresh.show();c.refreshKnowledgeGraph=force=>refresh.flush(force);
  const schedule=()=>refresh.invalidate();
  this.registerEvent(this.app.metadataCache.on('changed',()=>refresh.invalidate(true)));
  this.registerEvent(this.app.metadataCache.on('resolve',schedule));
  this.registerEvent(this.app.metadataCache.on('resolved',()=>{c.graph.resolved=true;schedule();}));
  this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
   c.activePath=renamedPath(c.activePath,oldPath,file.path);
   for(const view of views())view.onNoteRename(oldPath,file.path);
   refresh.invalidate(true);
  }));
  this.registerEvent(this.app.vault.on('delete',schedule));
  this.registerEvent(this.app.vault.on('create',schedule));
  this.registerEvent(this.app.workspace.on('file-open', file => {if (file?.extension === 'md') c.activePath = file.path; c.captureActive(); c.notify();}));
  this.registerEvent(this.app.workspace.on('css-change', () => {
   for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) if (leaf.view instanceof EmergenceView) leaf.view.refreshTheme();
  }));
  this.app.workspace.onLayoutReady(() => {this.companionService.start();c.captureActive();if(knowledgeFeaturesEnabled(this.settings)){c.rebuild();refresh.invalidate(true);}void this.templateFolders.refresh('mermaid');void this.templateFolders.refresh('argdown');});
  this.registerInterval(window.setInterval(schedule, 30000));
 }
 private localizedCommand(key:TranslationKey,definition:Omit<Command,'name'>):void{
  const gated:Record<string,Feature>={'open-mermaid-editor':'mermaid','open-argdown-editor':'argdown','analyze-current-note':'fieldIdeas','refresh-graph':'graph'},feature=gated[definition.id];
  const available=()=>feature?featureEnabled(this.settings,feature):definition.id==='open-workspace'?anyFeatureEnabled(this.settings):definition.id==='cancel-analysis'?!!this.controller.abort:true;
  if(definition.callback){const callback=definition.callback;definition={...definition,callback:undefined,checkCallback:checking=>{if(!available())return false;if(!checking)callback();return true;}};}
  else if(definition.editorCallback){const callback=definition.editorCallback;definition={...definition,editorCallback:undefined,editorCheckCallback:(checking,editor,view)=>{if(!available())return false;if(!checking)callback(editor,view);return true;}};}
  localizedCommand(this,key,definition);
 }
 async flushFeature(feature:Feature):Promise<void>{if(feature==='companion')await this.companionService.flush();for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE))if(leaf.view instanceof EmergenceView){if(feature==='mermaid')await leaf.view.mermaidPanel?.flush();if(feature==='argdown')await leaf.view.argdownPanel?.flush();if(feature==='tetrad')await leaf.view.tetradPanel?.flush();if(feature==='companion')await leaf.view.companionPanel?.flush();}if(feature==='companion')await this.companionService.flush();}
 applyFeatures():void{
  const knowledge=knowledgeFeaturesEnabled(this.settings);if(this.knowledgeActive===false&&knowledge)void this.controller.run(async()=>{await this.controller.graph.refreshBreadcrumbs();this.controller.rebuild();});this.knowledgeActive=knowledge;
  if(this.ribbon)this.ribbon.hidden=!anyFeatureEnabled(this.settings);
  for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE))if(leaf.view instanceof EmergenceView)leaf.view.applyFeatures();
  if(featureEnabled(this.settings,'companion'))this.app.workspace.onLayoutReady(()=>this.companionService.resume());
  refreshDiagramControls(this);this.tetradProcessor?.update();
  for(const kind of ['mermaid','argdown'] as const)if(!featureEnabled(this.settings,kind))this.templateFolders.pause(kind);
 }
 applyLanguage():void{
  initializeLanguage(this.settings.uiLanguage??'auto',getLanguage());
  refreshCommandLanguage(this);this.tetradProcessor?.update();
  if(this.ribbon)setTooltip(this.ribbon,tr('common.open_emergence'));
  for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE))if(leaf.view instanceof EmergenceView)leaf.view.refreshLanguage();
  for(const leaf of this.app.workspace.getLeavesOfType('markdown'))for(const button of leaf.view.containerEl.querySelectorAll<HTMLElement>('.em-mm-open')){const label=button.dataset.emDiagramKind==='argdown'?tr('argdown.edit_in_argdown'):button.dataset.emDiagramKind==='tetrad'?tr('tetrad.edit'):tr('mermaid.edit_in_mermaid');button.setAttribute('aria-label',label);button.removeAttribute('title');}
 }
 async open(): Promise<EmergenceView | undefined> {
  this.controller.captureActive();
  let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
  if (leaf && leaf.getRoot() !== this.app.workspace.rightSplit) {leaf.detach(); leaf = undefined;}
  if (!leaf) {
   const sidebar = this.app.workspace.getRightLeaf(false); if (!sidebar) return;
   leaf = sidebar; await leaf.setViewState({type: VIEW_TYPE, active: false});
  }
  await leaf.loadIfDeferred();
  await this.app.workspace.revealLeaf(leaf);
  return leaf.view instanceof EmergenceView ? leaf.view : undefined;
 }
 async saveSettings(): Promise<void> {const save=this.saves.then(()=>this.saveData({settings: this.settings, journal: this.journal, mermaidLibrary: this.mermaidLibrary.snapshot(), argdownLibrary: this.argdownLibrary.snapshot(), tetrader:this.tetradStore.snapshot(),companion:this.companionService.snapshot()}));this.saves=save.catch(()=>{});await save;}
 onunload(): void {this.controller?.dispose();}
}
