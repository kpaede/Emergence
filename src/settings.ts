import {Notice, PluginSettingTab, type App, type Setting, type SettingDefinitionItem} from 'obsidian';
import type EmergencePlugin from './main';
import type {Settings} from './types';
import {t as tr, type InterfaceLanguage} from './i18n';
import {graphSettings} from './ui/settings/features';
import {validateSettings} from './config';
import {clone, errorMessage} from './util';
import {button} from './ui/helpers';
import {modelSettings} from './ui/settings/model';
import {relationSettings} from './ui/settings/relations';
import {profileSettings, defaultProfileEditor} from './ui/settings/profiles';
import {dataSettings} from './ui/settings/data';
import type {SettingsContext} from './ui/settings/context';
import {settingsDefinitions, type SettingsSection} from './ui/settings/definitions';
import {validTemplateFolder,type TemplateKind} from './diagrams/template-notes';
import {features,featureEnabled,type Feature} from './features';
interface EditorMount {section:SettingsSection;body:HTMLElement;message:HTMLElement;saveButton:HTMLButtonElement;discardButton:HTMLButtonElement;cleanups:(()=>void)[]}
export class EmergenceSettingsTab extends PluginSettingTab {
 private draft?: Settings; private field = '';
 private profileEditor = defaultProfileEditor();
 private dirty = false; private saving = false; private revision = 0; private mounts = new Set<EditorMount>();
 constructor(app: App, private plugin: EmergencePlugin) {super(app, plugin);}
 getSettingDefinitions(): SettingDefinitionItem[] {
  // Called for search indexing before the tab opens: no draft changes, I/O or model requests.
  return settingsDefinitions((setting, section) => this.renderEditor(setting, section),
   this.plugin.controller.graph.snapshot.fields, this.plugin.settings.profiles.map(profile => profile.name), {
    language: {name:tr('settings.language'),desc:tr('settings.languageDescription'),aliases:['Sprache','Language','Deutsch','English'],control:{type:'dropdown',key:'uiLanguage',defaultValue:'auto',options:{auto:tr('settings.languageAutomatic'),de:'Deutsch',en:'English'},disabled:()=>this.saving}},
    graph:[this.enableDefinition('graph'),{name:tr('settings.graphEditor'),aliases:[...this.plugin.controller.graph.snapshot.fields,tr('settings.graphLabel'),tr('settings.graphPosition'),tr('settings.graphDepth')],render:setting=>this.renderEditor(setting,'graph')}],
    fieldIdeas:[this.enableDefinition('fieldIdeas')],
    mermaid:this.diagramDefinitions('mermaid'),
    argdown:this.diagramDefinitions('argdown'),
    search:[this.enableDefinition('search'),{name:tr('settings.search'),desc:tr('settings.searchPreferences')}],
   });
 }
 private enableDefinition(feature:Feature):SettingDefinitionItem{return {name:tr('settings.featureEnabled'),desc:tr('settings.featureEnabledHelp'),control:{type:'toggle',key:'feature_'+feature,defaultValue:true,disabled:()=>this.saving}};}
 private diagramDefinitions(kind:TemplateKind):SettingDefinitionItem[]{
  const library=kind==='mermaid'?this.plugin.mermaidLibrary:this.plugin.argdownLibrary;
  return [this.enableDefinition(kind),{name:tr(`settings.${kind}`),desc:tr('settings.diagramPreferences')},{name:tr('labels.templates'),desc:tr('settings.templates',{count:library.list().length})},
   {name:tr('settings.templateFolder'),desc:tr('settings.templateFolderHelp'),control:{type:'folder',key:kind+'TemplateFolder',defaultValue:'',includeRoot:false,filter:folder=>validTemplateFolder(folder.path,this.app.vault.configDir),disabled:()=>this.saving}},
   {name:tr('settings.templateFolderRefresh'),desc:library.folderStatus||tr('settings.templateFolderCount',{count:library.list().filter(item=>item.path).length}),render:setting=>{setting.addButton(button=>button.setButtonText(tr('settings.templateFolderRefresh')).onClick(()=>{void this.plugin.controller.run(async()=>{await library.refresh();this.update();});}));}}];
 }
 override getControlValue(key:string):unknown{const feature=features.find(feature=>key==='feature_'+feature);if(feature)return featureEnabled(this.plugin.settings,feature);if(key==='mermaidTemplateFolder'||key==='argdownTemplateFolder')return this.plugin.settings.templateFolders?.[key==='mermaidTemplateFolder'?'mermaid':'argdown']??'';return super.getControlValue(key);}
 private async setTemplateFolder(kind:TemplateKind,path:string):Promise<void>{
  path=path.trim().replace(/\/+$/u,'');if(!validTemplateFolder(path,this.app.vault.configDir))throw new Error(tr('settings.invalidTemplateFolder'));
  const previous=this.plugin.settings.templateFolders;this.saving=true;this.updateSave();this.refreshDomState();
  try{this.plugin.settings.templateFolders={...previous,[kind]:path};await this.plugin.saveSettings();if(this.draft)this.draft.templateFolders={...this.draft.templateFolders,[kind]:path};}
  catch(error){this.plugin.settings.templateFolders=previous;throw error;}
  finally{this.saving=false;this.updateSave();this.refreshDomState();}
  await this.plugin.templateFolders.refresh(kind);
 }
 override async setControlValue(key:string,value:unknown):Promise<void> {
  const feature=features.find(feature=>key==='feature_'+feature);
  if(feature&&typeof value==='boolean'&&!this.saving){
   this.saving=true;this.updateSave();this.refreshDomState();const previous=this.plugin.settings.features;
   try{if(!value)await this.plugin.flushFeature(feature);this.plugin.settings.features={...previous,[feature]:value};await this.plugin.saveSettings();if(this.draft)this.draft.features={...this.draft.features,[feature]:value};}
   catch(error){this.plugin.settings.features=previous;throw error;}
   finally{this.saving=false;this.updateSave();this.refreshDomState();}
   this.plugin.applyFeatures();if(feature==='mermaid'||feature==='argdown')await this.plugin.templateFolders.refresh(feature);this.update();return;
  }
  if((key==='mermaidTemplateFolder'||key==='argdownTemplateFolder')&&typeof value==='string'&&!this.saving){await this.setTemplateFolder(key==='mermaidTemplateFolder'?'mermaid':'argdown',value);return;}
  if(key!=='uiLanguage'||typeof value!=='string'||!['auto','de','en'].includes(value)||this.saving)return;
  const previous=this.plugin.settings.uiLanguage;this.saving=true;this.updateSave();this.refreshDomState();
  try {this.plugin.settings.uiLanguage=value as InterfaceLanguage;await this.plugin.saveSettings();if(this.draft)this.draft.uiLanguage=this.plugin.settings.uiLanguage;}
  catch(error){this.plugin.settings.uiLanguage=previous;throw error;}
  finally{this.saving=false;this.updateSave();this.refreshDomState();}
  this.plugin.applyLanguage();this.update();new Notice(tr('settings.languageSaved'));
 }
 // Obsidian also hides the tab during native sub-page navigation. Only explicit Save/Discard ends the draft.
 hide(): void {for(const mount of this.mounts)this.cleanup(mount);this.mounts.clear();}
 private cleanup(mount:EditorMount):void{for(const dispose of mount.cleanups)dispose();mount.cleanups=[];}
 private renderEditor(setting: Setting, section: SettingsSection): () => void {
  this.draft ??= clone(this.plugin.settings);
  // Children are native Setting rows; the composite editor must not add another row frame.
  const host = setting.settingEl; host.empty(); host.removeClass('setting-item'); host.addClass('em-settings', 'em-settings-editor');
  const body = host.createDiv({cls: 'em-settings-body'}),footer = host.createDiv({cls: 'em-settings-footer'});
  const message = footer.createDiv({cls: 'em-muted', attr: {role: 'status', 'aria-live': 'polite'}}),actions = footer.createDiv({cls: 'em-actions'});
  const discardButton=button(actions, tr("settings.discard_draft"), () => {if(this.saving)return;this.draft = clone(this.plugin.settings);this.revision++;this.dirty = false; this.refreshEditors(); this.report(tr("settings.draft_discarded")); this.updateSave();},this.saving);
  const saveButton = button(actions, tr("settings.save_changes"), () => {void this.save();}, this.saving||!this.dirty); saveButton.addClass('mod-cta');
  const mount:EditorMount={section,body,message,saveButton,discardButton,cleanups:[]};this.mounts.add(mount);this.renderBody(mount);
  // Search can mount several editors together. Each owns its body and lifecycle.
  return () => {this.cleanup(mount);this.mounts.delete(mount);};
 }
 private refreshEditors():void {for(const mount of this.mounts)this.renderBody(mount);}
 private renderBody(mount:EditorMount): void {
  if (!this.draft || !this.mounts.has(mount)) return;
  this.cleanup(mount);mount.body.empty(); mount.body.scrollTop = 0;
  const context: SettingsContext = {host: mount.body, draft: this.draft, controller: this.plugin.controller,
   changed: () => {if(!this.mounts.has(mount))return;this.dirty = true;this.revision++; this.updateSave(); this.report(tr("settings.unsaved_changes"));},
   refresh: () => this.refreshEditors(),report: (message, error = false) => {if(this.mounts.has(mount))this.report(message,error,mount);},
   register:cleanup=>mount.cleanups.push(cleanup),
  };
  if (mount.section === 'graph') graphSettings(context);
  if (mount.section === 'model') modelSettings(context);
  if (mount.section === 'relations') relationSettings(context, this.field, field => {this.field = field; this.renderBody(mount);});
  if (mount.section === 'profiles') profileSettings(context, this.profileEditor);
  if (mount.section === 'data') dataSettings(context);
 }
 private report(message:string,error=false,only?:EditorMount):void {
  for(const mount of only?[only]:this.mounts){mount.message.setText(message);mount.message.toggleClass('em-error',error);mount.message.setAttribute('role',error?'alert':'status');}
 }
 private updateSave():void {for(const mount of this.mounts){mount.saveButton.disabled=this.saving||!this.dirty;mount.discardButton.disabled=this.saving;}}
 private async save(): Promise<void> {
  if (!this.draft||this.saving) return;
  try {
   const currentDraft=this.draft,revision=this.revision;
   validateSettings(this.draft);
   const next = clone(this.draft);
   // This editor does not edit per-note checkbox choices; keep choices made since it opened.
   next.assignment.fieldsByNote = {...next.assignment.fieldsByNote, ...this.plugin.settings.assignment.fieldsByNote};
   for (const profile of next.profiles) {const old = this.plugin.settings.profiles.find(p => p.id === profile.id); if (old && JSON.stringify(old) !== JSON.stringify(profile)) profile.version = Math.max(old.version, profile.version) + 1;}
   this.saving=true;this.updateSave();
   const previous = this.plugin.settings; this.plugin.settings = next;
   try {await this.plugin.saveSettings();} catch (error) {this.plugin.settings = previous; throw error;}
   if(this.draft===currentDraft&&this.revision===revision){this.draft=clone(next);this.dirty=false;}
   if (JSON.stringify([previous.assignment, previous.conceptFolders, previous.fieldDescriptions, previous.rules, previous.profiles,previous.endpoint,previous.model,previous.numCtx,previous.think]) !== JSON.stringify([next.assignment, next.conceptFolders, next.fieldDescriptions, next.rules, next.profiles,next.endpoint,next.model,next.numCtx,next.think])) this.plugin.controller.invalidateAssignments();
   this.plugin.controller.writer.invalidate(); this.plugin.controller.rebuild(); this.refreshEditors(); this.report(this.dirty?tr("settings.saved_further_changes_are_still_unsaved"):tr("settings.changes_saved"));
  } catch (error) {this.report(errorMessage(error), true);} finally {this.saving=false;this.updateSave();}
 }
}
