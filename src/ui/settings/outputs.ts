import {t as tr} from '../../i18n';
import {Setting} from 'obsidian';
import type {Profile} from '../../types';
import {button, select} from '../helpers';
import {disclosure} from '../panel';
import type {SettingsContext} from './context';

export function outputSettings(ctx: SettingsContext, profile: Profile, selected: string, choose: (id: string) => void): void {
 const {host} = ctx, outputs = profile.outputs.filter(o => o.kind === 'relations'), output = outputs.find(o => o.id === selected) ?? outputs[0];
 host.createDiv({text: tr("settings.note_analysis_returns_a_shared_list_of_associated_concepts_you_then"), cls: 'em-muted em-caption'});
 if (!output) {
  button(host, tr("settings.enable_relation_module"), () => {
   profile.outputs.push({id: 'relations', kind: 'relations', enabled: true, maxSuggestions: 5, eligibleNodeTypes: [], allowedEdgeTypes: [], targetProperty: '', dataType: 'wikilink-list', writeMode: 'review', language: profile.language, minEvidence: 'medium', promptTemplate: '', visibility: true, requiresManualReview: true});
   ctx.changed(); choose('relations');
  }); return;
 }
 if (outputs.length > 1) select(host, tr("settings.relation_module"), Object.fromEntries(outputs.map(o => [o.id, o.id])), output.id, choose);
 new Setting(host).setName(tr("settings.suggest_assignments")).addToggle(t => t.setValue(output.enabled).onChange(v => {output.enabled = v; ctx.changed();}));
 new Setting(host).setName(tr("settings.maximum_suggestions")).setDesc(tr("settings.an_upper_limit_not_a_minimum_analysis_shows_at_most_eight")).addText(t => {t.inputEl.type = 'number'; t.setValue(String(output.maxSuggestions)).onChange(v => {output.maxSuggestions = Number(v); ctx.changed();});});
 const instructions = new Setting(host).setName(tr("settings.additional_assignment_criteria")); instructions.settingEl.addClass('em-setting-stack');
 instructions.addTextArea(t => {t.inputEl.rows = 4; t.setValue(output.promptTemplate).onChange(v => {output.promptTemplate = v; ctx.changed();});});
 const fields = disclosure(host, tr("settings.restrict_fields_for_this_profile"));
 fields.createDiv({text: tr("settings.without_a_selection_the_fields_selected_before_analysis_apply_each_field"), cls: 'em-muted'});
 for (const field of ctx.controller.graph.snapshot.fields) {
  const row = fields.createEl('label', {cls: 'em-check-row'}), checkbox = row.createEl('input', {type: 'checkbox'}); checkbox.checked = output.allowedEdgeTypes.includes(field); row.appendText(field);
  checkbox.onchange = () => {output.allowedEdgeTypes = checkbox.checked ? [...output.allowedEdgeTypes, field] : output.allowedEdgeTypes.filter(v => v !== field); ctx.changed();};
 }
}
