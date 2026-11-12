import {t as tr} from '../../i18n';
import {Setting} from 'obsidian';
import type {Profile, PromptKey} from '../../types';
import {clone, errorMessage} from '../../util';
import {placeholders, renderTemplate} from '../../llm/context';
import {button, input, select} from '../helpers';
import {disclosure} from '../panel';
import {outputSettings} from './outputs';
import type {SettingsContext} from './context';
export interface ProfileEditorState {section: string; prompt: PromptKey; output: string}
export const defaultProfileEditor = (): ProfileEditorState => ({section: 'general', prompt: 'system', output: 'relations'});
export function profileSettings(ctx: SettingsContext, state: ProfileEditorState): void {
 const {host, draft: s} = ctx;
 new Setting(host).setName(tr("settings.profiles_and_templates")).setHeading();
 const profile = s.profiles.find(p => p.id === s.activeProfile)!;
 new Setting(host).setName(tr("settings.analysis_profile")).addDropdown(d => d.addOptions(Object.fromEntries(s.profiles.map(p => [p.id, p.name]))).setValue(profile.id).onChange(id => {s.activeProfile = id; ctx.changed(); ctx.refresh();}))
  .addExtraButton(b => b.setIcon('copy').setTooltip(tr("settings.duplicate_profile")).onClick(() => {const copy = clone(profile); copy.id = crypto.randomUUID(); copy.name += tr("labels.copy"); s.profiles.push(copy); s.activeProfile = copy.id; ctx.changed(); ctx.refresh();}))
  .addExtraButton(b => b.setIcon('trash-2').setTooltip(tr("settings.delete_this_profile")).setDisabled(s.profiles.length <= 1).onClick(() => {s.profiles = s.profiles.filter(p => p.id !== profile.id); s.activeProfile = s.profiles[0]!.id; ctx.changed(); ctx.refresh();}));
 select(host, tr("settings.edit"), {general: tr("settings.profile_and_instructions"), prompts: tr("settings.prompt_templates"), outputs: tr("labels.output_modules")}, state.section, value => {state.section = value; ctx.refresh();});
 if (state.section === 'general') {
  new Setting(host).setName(tr("settings.profile_name")).addText(t => t.setValue(profile.name).onChange(v => {profile.name = v; ctx.changed();}));
  new Setting(host).setName(tr("settings.output_language")).addDropdown(d => d.addOptions({de: 'Deutsch', en: tr("labels.english"), note: tr("labels.note_language")}).setValue(profile.language).onChange(v => {profile.language = v as Profile['language']; ctx.changed();}));
  const instructions = new Setting(host).setName(tr("fieldIdeas.ai_instructions")).setDesc(tr("settings.what_should_this_profile_consider_when_suggesting_relations")); instructions.settingEl.addClass('em-setting-stack');
  instructions.addTextArea(t => {t.inputEl.rows = 5; t.setValue(profile.instructions).onChange(v => {profile.instructions = v; ctx.changed();});});
  const parameters = disclosure(host, tr("settings.model_parameters_for_this_profile"));
  for (const [key, label, description] of [['temperature', tr("labels.temperature"), tr("settings.0_to_2_lower_values_usually_produce_more_consistent_results")], ['maxTokens', tr("labels.maximum_output_tokens"), tr("labels.must_fit_within_the_configured_context_window")]] as const)
   new Setting(parameters).setName(label).setDesc(description).addText(t => {t.inputEl.type = 'number'; t.setValue(String(profile[key])).onChange(v => {profile[key] = Number(v); ctx.changed();});});
 }
 if (state.section === 'prompts') prompts(ctx, profile, state);
 if (state.section === 'outputs') outputSettings(ctx, profile, state.output, id => {state.output = id; ctx.refresh();});
}
function prompts(ctx: SettingsContext, profile: Profile, state: ProfileEditorState): void {
 const names: Partial<Record<PromptKey, string>> = {relations: tr("labels.breadcrumbs_assignment")};
 state.prompt = 'relations';
 select(ctx.host, tr("labels.prompt_template"), names, state.prompt, key => {state.prompt = key as PromptKey; ctx.refresh();});
 const editor = input(ctx.host, names[state.prompt]!, profile.templates[state.prompt], value => {profile.templates[state.prompt] = value; ctx.changed();}, true) as HTMLTextAreaElement;
 editor.rows = 12; editor.addClass('em-prompt-editor'); editor.spellcheck = false;
 const vars = disclosure(ctx.host, tr("settings.insert_available_placeholders"));
 const chips = vars.createDiv({cls: 'em-placeholder-list'});
 for (const key of placeholders) button(chips, '{{' + key + '}}', () => {
  const position = editor.selectionStart; editor.setRangeText('{{' + key + '}}', position, editor.selectionEnd, 'end');
  profile.templates[state.prompt] = editor.value; ctx.changed(); editor.focus();
 });
 const feedback = ctx.host.createDiv({cls: 'em-muted', attr: {role: 'status'}});
 button(ctx.host.createDiv({cls: 'em-actions'}), tr("settings.validate_template"), () => {
  try {renderTemplate(editor.value, Object.fromEntries(placeholders.map(k => [k, `[${k}]`]))); feedback.setText(tr("settings.all_placeholders_are_valid")); feedback.removeClass('em-error');}
  catch (error) {feedback.setText(errorMessage(error)); feedback.addClass('em-error');}
 });
 ctx.host.createDiv({text: tr("settings.note_contents_remain_data_prompts_cannot_disable_the_schema_local_validation"), cls: 'em-muted em-caption'});
}
