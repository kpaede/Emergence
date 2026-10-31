import {Setting} from 'obsidian';
import type {Profile, PromptKey} from '../../types';
import {clone, errorMessage} from '../../util';
import {placeholders, renderTemplate} from '../../llm/context';
import {button, input, select} from '../helpers';
import {disclosure} from '../panel';
import {outputSettings} from './outputs';
import type {SettingsContext} from './context';
export interface ProfileEditorState {section: string; prompt: PromptKey; output: string; inquiry: number}
export const defaultProfileEditor = (): ProfileEditorState => ({section: 'general', prompt: 'system', output: 'relations', inquiry: 0});
export function profileSettings(ctx: SettingsContext, state: ProfileEditorState): void {
 const {host, draft: s} = ctx;
 new Setting(host).setName('Profile und Vorlagen').setHeading();
 const profile = s.profiles.find(p => p.id === s.activeProfile)!;
 new Setting(host).setName('Analyseprofil').addDropdown(d => d.addOptions(Object.fromEntries(s.profiles.map(p => [p.id, p.name]))).setValue(profile.id).onChange(id => {s.activeProfile = id; ctx.changed(); ctx.refresh();}))
  .addExtraButton(b => b.setIcon('copy').setTooltip('Profil duplizieren').onClick(() => {const copy = clone(profile); copy.id = crypto.randomUUID(); copy.name += ' (Kopie)'; s.profiles.push(copy); s.activeProfile = copy.id; ctx.changed(); ctx.refresh();}))
  .addExtraButton(b => b.setIcon('trash-2').setTooltip('Dieses Profil löschen').setDisabled(s.profiles.length <= 1).onClick(() => {s.profiles = s.profiles.filter(p => p.id !== profile.id); s.activeProfile = s.profiles[0]!.id; ctx.changed(); ctx.refresh();}));
 select(host, 'Bearbeiten', {general: 'Profil und Anweisungen', prompts: 'Promptvorlagen', outputs: 'Ergebnismodule', inquiry: 'Vorlagen für freie Recherche'}, state.section, value => {state.section = value; ctx.refresh();});
 if (state.section === 'general') {
  new Setting(host).setName('Profilname').addText(t => t.setValue(profile.name).onChange(v => {profile.name = v; ctx.changed();}));
  new Setting(host).setName('Ausgabesprache').addDropdown(d => d.addOptions({de: 'Deutsch', en: 'Englisch', note: 'Sprache der Notiz'}).setValue(profile.language).onChange(v => {profile.language = v as Profile['language']; ctx.changed();}));
  const instructions = new Setting(host).setName('Anweisungen an die KI').setDesc('Was soll dieses Profil bei Beziehungsideen berücksichtigen?'); instructions.settingEl.addClass('em-setting-stack');
  instructions.addTextArea(t => {t.inputEl.rows = 5; t.setValue(profile.instructions).onChange(v => {profile.instructions = v; ctx.changed();});});
  const parameters = disclosure(host, 'Modellparameter für dieses Profil');
  for (const [key, label, description] of [['temperature', 'Temperatur', '0 bis 2. Niedrigere Werte liefern meist gleichmäßigere Ergebnisse.'], ['maxTokens', 'Maximale Ausgabetokens', 'Muss innerhalb des konfigurierten Kontextfensters liegen.']] as const)
   new Setting(parameters).setName(label).setDesc(description).addText(t => {t.inputEl.type = 'number'; t.setValue(String(profile[key])).onChange(v => {profile[key] = Number(v); ctx.changed();});});
 }
 if (state.section === 'prompts') prompts(ctx, profile, state);
 if (state.section === 'outputs') outputSettings(ctx, profile, state.output, id => {state.output = id; ctx.refresh();});
 if (state.section === 'inquiry') inquiries(ctx, state);
}
function prompts(ctx: SettingsContext, profile: Profile, state: ProfileEditorState): void {
 const names: Partial<Record<PromptKey, string>> = {relations: 'Breadcrumbs-Zuordnung'};
 state.prompt = 'relations';
 select(ctx.host, 'Promptvorlage', names, state.prompt, key => {state.prompt = key as PromptKey; ctx.refresh();});
 const editor = input(ctx.host, names[state.prompt]!, profile.templates[state.prompt], value => {profile.templates[state.prompt] = value; ctx.changed();}, true) as HTMLTextAreaElement;
 editor.rows = 12; editor.addClass('em-prompt-editor'); editor.spellcheck = false;
 const vars = disclosure(ctx.host, 'Verfügbare Platzhalter einfügen');
 const chips = vars.createDiv({cls: 'em-placeholder-list'});
 for (const key of placeholders) button(chips, '{{' + key + '}}', () => {
  const position = editor.selectionStart; editor.setRangeText('{{' + key + '}}', position, editor.selectionEnd, 'end');
  profile.templates[state.prompt] = editor.value; ctx.changed(); editor.focus();
 });
 const feedback = ctx.host.createDiv({cls: 'em-muted', attr: {role: 'status'}});
 button(ctx.host.createDiv({cls: 'em-actions'}), 'Vorlage prüfen', () => {
  try {renderTemplate(editor.value, Object.fromEntries(placeholders.map(k => [k, `[${k}]`]))); feedback.setText('Alle Platzhalter sind gültig.'); feedback.removeClass('em-error');}
  catch (error) {feedback.setText(errorMessage(error)); feedback.addClass('em-error');}
 });
 ctx.host.createDiv({text: 'Notizinhalte bleiben Daten. Schema, lokale Validierung und beide Freigabeschritte lassen sich durch Prompts nicht abschalten.', cls: 'em-muted em-caption'});
}
function inquiries(ctx: SettingsContext, state: ProfileEditorState): void {
 const templates = ctx.draft.inquiryTemplates;
 state.inquiry = Math.min(state.inquiry, Math.max(0, templates.length - 1));
 select(ctx.host, 'Recherchevorlage', Object.fromEntries(templates.map((t, i) => [String(i), t.name])), String(state.inquiry), id => {state.inquiry = Number(id); ctx.refresh();});
 const selected = templates[state.inquiry], actions = ctx.host.createDiv({cls: 'em-actions'});
 button(actions, 'Vorlage hinzufügen', () => {templates.push({name: 'Neue Recherchevorlage', prompt: ''}); state.inquiry = templates.length - 1; ctx.changed(); ctx.refresh();});
 if (!selected) return;
 button(actions, 'Vorlage löschen', () => {templates.splice(state.inquiry, 1); ctx.changed(); ctx.refresh();});
 input(ctx.host, 'Name', selected.name, value => {selected.name = value; ctx.changed();});
 const editor = input(ctx.host, 'Frage oder Arbeitsauftrag', selected.prompt, value => {selected.prompt = value; ctx.changed();}, true) as HTMLTextAreaElement; editor.rows = 8;
}
