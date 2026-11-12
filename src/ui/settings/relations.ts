import {t as tr} from '../../i18n';
import {Setting, type ToggleComponent} from 'obsidian';
import {unknownRule} from '../../config';
import {badge, disclosure, emptyState} from '../panel';
import {csv, type SettingsContext} from './context';
export function relationSettings(ctx: SettingsContext, selected: string, selectField: (field: string) => void): void {
 const {host, draft: s, controller: c} = ctx, fields = c.graph.snapshot.fields;
 new Setting(host).setName(tr("settings.relations_and_write_permissions")).setHeading();
 host.createDiv({text: tr("settings.describe_the_meaning_of_your_own_breadcrumbs_fields_these_descriptions_are"), cls: 'em-muted'});
 if (!fields.length) {emptyState(host, 'unplug', tr("settings.no_breadcrumbs_fields_detected"), tr("settings.enable_breadcrumbs_and_refresh_the_graph_index")); return;}
 const label = fields.includes(selected) ? selected : fields[0]!;
 new Setting(host).setName(tr("settings.relation_field")).addDropdown(d => d.addOptions(Object.fromEntries(fields.map(f => [f, f]))).setValue(label).onChange(selectField));
 const rule = s.rules[label] ?? unknownRule(label);
 rule.description = s.fieldDescriptions[label] ?? rule.description;
 if (!s.rules[label]) {rule.writable = !!rule.description.trim(); rule.targetProperty = label;}
 if (!rule.description.trim()) {rule.writable = false; rule.targetProperty = '';}
 const mark = () => {rule.provenance = 'user'; s.rules[label] = rule; ctx.changed(); updateWrite();};
 const groupNames = c.graph.snapshot.groups.filter(g => g.fields.includes(label)).map(g => g.label);
 const status = host.createDiv({cls: 'em-setting-summary'}); badge(status, rule.writable ? tr("settings.additions_allowed_after_review") : tr("settings.read_only"));
 if (groupNames.length) status.createDiv({text: tr("messages.fieldGroups",{fields:groupNames.join(', ')}), cls: 'em-muted'});
 let writeToggle: ToggleComponent | undefined;
 const updateWrite = () => writeToggle?.setDisabled(!rule.description.trim());
 const meaning = new Setting(host).setName(tr("settings.meaning_and_assignment_criteria")).setDesc(tr("settings.when_does_this_relation_fit_direction_and_examples_help_classification")); meaning.settingEl.addClass('em-setting-stack');
 meaning.addTextArea(t => {t.inputEl.rows = 4; t.setValue(rule.description).onChange(v => {rule.description = v; s.fieldDescriptions[label] = v; if (!v.trim()) rule.writable = false; else if (!s.rules[label]) rule.writable = true; mark();});});
 new Setting(disclosure(host, tr("labels.optional_formal_relation_class"))).setName(tr("settings.relation_class")).addDropdown(d => d.addOptions({unknown: tr("settings.not_defined_yet"), taxonomic: tr("labels.broader_concept_narrower_concept"), mereological: tr("labels.part_whole"), causal: tr("labels.cause_effect"), associative: tr("labels.associative"), sequential: tr("labels.sequence")}).setValue(rule.class).onChange(v => {rule.class = v as typeof rule.class; mark();}));
 new Setting(host).setName(tr("settings.show_as_hierarchy")).setDesc(tr("settings.places_this_relation_in_the_hierarchical_layout")).addToggle(t => t.setValue(rule.hierarchical).onChange(v => {rule.hierarchical = v; mark();}));
 new Setting(host).setName(tr("settings.allow_reviewed_additions")).setDesc(tr("settings.write_target_a_field_description_is_sufficient_the_review_checks_whether", {value1: label})).addToggle(t => {
  writeToggle = t; t.setValue(rule.writable).onChange(v => {rule.writable = v; rule.targetProperty = v ? label : ''; mark();}); updateWrite();
 });
 const advanced = disclosure(host, tr("settings.direction_and_validation_rules"));
 new Setting(advanced).setName(tr("settings.direction_in_hierarchical_layout")).addDropdown(d => d.addOptions({forward: tr("settings.source_target_downward"), reverse: tr("settings.target_source_downward")}).setValue(rule.direction).onChange(v => {rule.direction = v as typeof rule.direction; mark();}));
 new Setting(advanced).setName(tr("settings.inverse_field")).addDropdown(d => d.addOptions({'': tr("graph.no_assignment"), ...Object.fromEntries(fields.map(f => [f, f]))}).setValue(rule.inverse).onChange(v => {rule.inverse = v; mark();}));
 for (const [key, name, description] of [['acyclic', tr("labels.prevent_cycles"), tr("settings.only_for_relations_explicitly_defined_as_acyclic")], ['transitive', tr("labels.transitive"), tr("settings.the_assignment_can_hold_across_several_steps")], ['symmetric', tr("labels.symmetric"), tr("settings.the_relation_holds_in_both_directions")], ['allowSelf', tr("labels.allow_self_references"), tr("settings.a_note_can_link_to_itself")]] as const)
  new Setting(advanced).setName(name).setDesc(description).addToggle(t => t.setValue(rule[key]).onChange(v => {rule[key] = v; mark();}));
 new Setting(advanced).setName(tr("settings.allowed_target_types")).setDesc(tr("settings.comma_separated_empty_allows_all_types")).addText(t => t.setValue(rule.eligibleNodeTypes.join(', ')).onChange(v => {rule.eligibleNodeTypes = csv(v); mark();}));
}
