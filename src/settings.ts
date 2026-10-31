import {PluginSettingTab, type App} from 'obsidian';
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

type Section = 'model' | 'relations' | 'profiles' | 'data';
export class EmergenceSettingsTab extends PluginSettingTab {
 private draft!: Settings; private section: Section = 'model'; private field = '';
 private profileEditor = defaultProfileEditor();
 private body!: HTMLElement; private message!: HTMLElement; private saveButton!: HTMLButtonElement;
 private dirty = false; private navigation = new Map<Section, HTMLButtonElement>();
 constructor(app: App, private plugin: EmergencePlugin) {super(app, plugin);}
 display(): void {
  const host = this.containerEl; host.empty(); host.addClass('em-settings');
  this.draft = clone(this.plugin.settings); this.dirty = false; this.navigation.clear();
  const nav = host.createDiv({cls: 'em-settings-nav', attr: {role: 'tablist', 'aria-label': 'Einstellungsbereiche'}});
  for (const [id, label] of [['model', 'Modell'], ['relations', 'Beziehungen'], ['profiles', 'Profile'], ['data', 'Daten']] as const) {
   const b = button(nav, label, () => {this.section = id; this.renderBody();}); b.setAttribute('role', 'tab');
   b.id = `em-settings-${id}`; b.setAttribute('aria-controls', 'em-settings-body');
   b.onkeydown = event => {
    const sections = Array.from(this.navigation.keys()), index = sections.indexOf(id);
    const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : -1;
    if (next >= 0) {event.preventDefault(); this.section = sections[next]!; this.renderBody(); this.navigation.get(this.section)?.focus();}
   }; this.navigation.set(id, b);
  }
  this.body = host.createDiv({cls: 'em-settings-body', attr: {id: 'em-settings-body', role: 'tabpanel'}});
  const footer = host.createDiv({cls: 'em-settings-footer'});
  this.message = footer.createDiv({cls: 'em-muted', attr: {role: 'status', 'aria-live': 'polite'}});
  const actions = footer.createDiv({cls: 'em-actions'});
  button(actions, 'Entwurf verwerfen', () => {this.draft = clone(this.plugin.settings); this.dirty = false; this.renderBody(); this.report('Entwurf verworfen.'); this.updateSave();});
  this.saveButton = button(actions, 'Änderungen speichern', () => {void this.save();}, true); this.saveButton.addClass('mod-cta');
  this.renderBody();
 }
 private renderBody(): void {
  this.body.empty(); this.body.scrollTop = 0; this.body.setAttribute('aria-labelledby', `em-settings-${this.section}`);
  for (const [id, b] of this.navigation) {b.setAttribute('aria-selected', String(id === this.section)); b.tabIndex = id === this.section ? 0 : -1;}
  const context: SettingsContext = {host: this.body, draft: this.draft, controller: this.plugin.controller,
   changed: () => {this.dirty = true; this.updateSave(); this.report('Ungespeicherte Änderungen.');},
   refresh: () => this.renderBody(), report: (message, error = false) => this.report(message, error),
  };
  if (this.section === 'model') modelSettings(context);
  if (this.section === 'relations') relationSettings(context, this.field, field => {this.field = field; this.renderBody();});
  if (this.section === 'profiles') profileSettings(context, this.profileEditor);
  if (this.section === 'data') dataSettings(context);
 }
 private report(message: string, error = false): void {this.message.setText(message); this.message.toggleClass('em-error', error); this.message.setAttribute('role', error ? 'alert' : 'status');}
 private updateSave(): void {this.saveButton.disabled = !this.dirty;}
 private async save(): Promise<void> {
  try {
   validateSettings(this.draft);
   const next = clone(this.draft);
   // This editor does not edit per-note checkbox choices; keep choices made since it opened.
   next.assignment.fieldsByNote = {...next.assignment.fieldsByNote, ...this.plugin.settings.assignment.fieldsByNote};
   for (const profile of next.profiles) {const old = this.plugin.settings.profiles.find(p => p.id === profile.id); if (old && JSON.stringify(old) !== JSON.stringify(profile)) profile.version = Math.max(old.version, profile.version) + 1;}
   this.saveButton.disabled = true;
   const previous = this.plugin.settings; this.plugin.settings = next;
   try {await this.plugin.saveSettings();} catch (error) {this.plugin.settings = previous; throw error;}
   this.draft = clone(next); this.dirty = false;
   if (JSON.stringify([previous.assignment, previous.conceptFolders, previous.fieldDescriptions, previous.rules, previous.profiles,previous.endpoint,previous.model,previous.numCtx,previous.think]) !== JSON.stringify([next.assignment, next.conceptFolders, next.fieldDescriptions, next.rules, next.profiles,next.endpoint,next.model,next.numCtx,next.think])) this.plugin.controller.invalidateAssignments();
   this.plugin.controller.writer.invalidate(); this.plugin.controller.rebuild(); this.renderBody(); this.report('Änderungen gespeichert.');
  } catch (error) {this.report(errorMessage(error), true);} finally {this.updateSave();}
 }
}
