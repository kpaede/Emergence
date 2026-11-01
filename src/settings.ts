import {PluginSettingTab, type App, type Setting, type SettingDefinitionItem} from 'obsidian';
import type EmergencePlugin from './main';
import type {Settings} from './types';
import {validateSettings} from './config';
import {clone, errorMessage} from './util';
import {button} from './ui/helpers';
import {modelSettings} from './ui/settings/model';
import {relationSettings} from './ui/settings/relations';
import {profileSettings, defaultProfileEditor} from './ui/settings/profiles';
import {dataSettings} from './ui/settings/data';
import type {SettingsContext} from './ui/settings/context';
import {settingsDefinitions, type SettingsSection} from './ui/settings/definitions';
interface EditorMount {section:SettingsSection;body:HTMLElement;message:HTMLElement;saveButton:HTMLButtonElement;discardButton:HTMLButtonElement}
export class EmergenceSettingsTab extends PluginSettingTab {
 private draft?: Settings; private field = '';
 private profileEditor = defaultProfileEditor();
 private dirty = false; private saving = false; private revision = 0; private mounts = new Set<EditorMount>();
 constructor(app: App, private plugin: EmergencePlugin) {super(app, plugin);}
 getSettingDefinitions(): SettingDefinitionItem[] {
  // Called for search indexing before the tab opens: no draft changes, I/O or model requests.
  return settingsDefinitions((setting, section) => this.renderEditor(setting, section),
   this.plugin.controller.graph.snapshot.fields, this.plugin.settings.profiles.map(profile => profile.name));
 }
 // Obsidian also hides the tab during native sub-page navigation. Only explicit Save/Discard ends the draft.
 hide(): void {this.mounts.clear();}
 private renderEditor(setting: Setting, section: SettingsSection): () => void {
  this.draft ??= clone(this.plugin.settings);
  // Children are native Setting rows; the composite editor must not add another row frame.
  const host = setting.settingEl; host.empty(); host.removeClass('setting-item'); host.addClass('em-settings', 'em-settings-editor');
  const body = host.createDiv({cls: 'em-settings-body'}),footer = host.createDiv({cls: 'em-settings-footer'});
  const message = footer.createDiv({cls: 'em-muted', attr: {role: 'status', 'aria-live': 'polite'}}),actions = footer.createDiv({cls: 'em-actions'});
  const discardButton=button(actions, 'Entwurf verwerfen', () => {if(this.saving)return;this.draft = clone(this.plugin.settings);this.revision++;this.dirty = false; this.refreshEditors(); this.report('Entwurf verworfen.'); this.updateSave();},this.saving);
  const saveButton = button(actions, 'Änderungen speichern', () => {void this.save();}, this.saving||!this.dirty); saveButton.addClass('mod-cta');
  const mount:EditorMount={section,body,message,saveButton,discardButton};this.mounts.add(mount);this.renderBody(mount);
  // Search can mount several editors together. Each owns its body and lifecycle.
  return () => {this.mounts.delete(mount);};
 }
 private refreshEditors():void {for(const mount of this.mounts)this.renderBody(mount);}
 private renderBody(mount:EditorMount): void {
  if (!this.draft || !this.mounts.has(mount)) return;
  mount.body.empty(); mount.body.scrollTop = 0;
  const context: SettingsContext = {host: mount.body, draft: this.draft, controller: this.plugin.controller,
   changed: () => {if(!this.mounts.has(mount))return;this.dirty = true;this.revision++; this.updateSave(); this.report('Ungespeicherte Änderungen.');},
   refresh: () => this.refreshEditors(),report: (message, error = false) => {if(this.mounts.has(mount))this.report(message,error,mount);},
  };
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
   this.plugin.controller.writer.invalidate(); this.plugin.controller.rebuild(); this.refreshEditors(); this.report(this.dirty?'Gespeichert. Weitere Änderungen sind noch ungespeichert.':'Änderungen gespeichert.');
  } catch (error) {this.report(errorMessage(error), true);} finally {this.saving=false;this.updateSave();}
 }
}
