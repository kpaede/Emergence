import {Setting} from 'obsidian';
import type {Profile} from '../../types';
import {button, select} from '../helpers';
import {disclosure} from '../panel';
import type {SettingsContext} from './context';

export function outputSettings(ctx: SettingsContext, profile: Profile, selected: string, choose: (id: string) => void): void {
 const {host} = ctx, outputs = profile.outputs.filter(o => o.kind === 'relations'), output = outputs.find(o => o.id === selected) ?? outputs[0];
 host.createDiv({text: 'Die Notizanalyse liefert ausschließlich Breadcrumbs-Feld → Zielnotiz. Neue Zielbegriffe sind Teil dieser Zuordnungen; es gibt keine zusätzlichen Text- oder Begriffsausgaben.', cls: 'em-muted em-caption'});
 if (!output) {
  button(host, 'Beziehungsmodul aktivieren', () => {
   profile.outputs.push({id: 'relations', kind: 'relations', enabled: true, maxSuggestions: 5, eligibleNodeTypes: [], allowedEdgeTypes: [], targetProperty: '', dataType: 'wikilink-list', writeMode: 'review', language: profile.language, minEvidence: 'medium', promptTemplate: '', visibility: true, requiresManualReview: true});
   ctx.changed(); choose('relations');
  }); return;
 }
 if (outputs.length > 1) select(host, 'Beziehungsmodul', Object.fromEntries(outputs.map(o => [o.id, o.id])), output.id, choose);
 new Setting(host).setName('Zuordnungen vorschlagen').addToggle(t => t.setValue(output.enabled).onChange(v => {output.enabled = v; ctx.changed();}));
 new Setting(host).setName('Maximale Vorschläge').setDesc('Obergrenze, keine Mindestmenge. Die Analyse zeigt höchstens acht passende Zuordnungen.').addText(t => {t.inputEl.type = 'number'; t.setValue(String(output.maxSuggestions)).onChange(v => {output.maxSuggestions = Number(v); ctx.changed();});});
 const instructions = new Setting(host).setName('Zusätzliche Zuordnungskriterien'); instructions.settingEl.addClass('em-setting-stack');
 instructions.addTextArea(t => {t.inputEl.rows = 4; t.setValue(output.promptTemplate).onChange(v => {output.promptTemplate = v; ctx.changed();});});
 const fields = disclosure(host, 'Felder für dieses Profil einschränken');
 fields.createDiv({text: 'Ohne Auswahl gelten die vor der Analyse ausgewählten Felder. Jedes verwendete Feld benötigt deine Beschreibung.', cls: 'em-muted'});
 for (const field of ctx.controller.graph.snapshot.fields) {
  const row = fields.createEl('label', {cls: 'em-check-row'}), checkbox = row.createEl('input', {type: 'checkbox'}); checkbox.checked = output.allowedEdgeTypes.includes(field); row.appendText(field);
  checkbox.onchange = () => {output.allowedEdgeTypes = checkbox.checked ? [...output.allowedEdgeTypes, field] : output.allowedEdgeTypes.filter(v => v !== field); ctx.changed();};
 }
}
