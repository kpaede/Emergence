import {t as tr} from '../../i18n';
import {validateSettings} from '../../config';
import {button, input, select} from '../helpers';
import {disclosure, type PanelContext} from '../panel';
import {trackDisclosure} from '../disclosure-state';

export function renderAnalysisScope(ctx: PanelContext): boolean {
 const {controller: c, host} = ctx, s = c.settings(), fields = c.analysisFields, state = ctx.state.analysis;
 const fieldBox = disclosure(host, tr("fieldIdeas.fields", {value1: fields.length}), state.fieldsOpen ?? !fields.length, 'analysis-fields');
 trackDisclosure(fieldBox, open => {state.fieldsOpen = open;});
 const list = fieldBox.createDiv({cls: 'em-analysis-field-list', attr: {role: 'list', 'aria-label': tr("fieldIdeas.breadcrumbs_fields_from_frontmatter")}});
 for (const field of fields) {
  list.createSpan({text: field, attr: {role: 'listitem', 'data-em-field': field}});
 }
 fieldBox.createDiv({text: tr("fieldIdeas.from_the_frontmatter_including_empty_fields"), cls: 'em-muted em-caption'});
 if (!c.graph.snapshot.fields.length) fieldBox.createDiv({text: tr("fieldIdeas.no_breadcrumbs_fields_detected"), cls: 'em-muted'});
 const missing = fields.filter(field => !c.graph.snapshot.rules[field]?.description.trim());
 const descriptions = disclosure(host, missing.length ? tr("messages.missingDescriptions",{count:missing.length}) : tr("labels.field_descriptions"), state.descriptionsOpen ?? missing.length > 0, 'analysis-descriptions');
 trackDisclosure(descriptions, open => {state.descriptionsOpen = open;});
 if (c.graph.snapshot.fields.length) {
  const field = state.descriptionField ?? missing[0] ?? fields[0] ?? c.graph.snapshot.fields[0]!;
  select(descriptions, tr("fieldIdeas.field"), Object.fromEntries(c.graph.snapshot.fields.map(f => [f, f])), field, value => {state.descriptionField = value; ctx.repaint();});
  state.descriptions ??= {};
  const editor = input(descriptions, tr("labels.meaning"), state.descriptions[field] ?? s.fieldDescriptions[field] ?? c.graph.snapshot.rules[field]?.description ?? '', value => {state.descriptions![field] = value;}, true) as HTMLTextAreaElement;
  editor.rows = 4; editor.placeholder = tr("fieldIdeas.how_should_a_concept_in_this_field_relate_to_the_analyzed");
  button(descriptions.createDiv({cls: 'em-actions'}), tr("mermaid.save"), () => {void ctx.run(async () => {
   const previous = {...s.fieldDescriptions}; s.fieldDescriptions[field] = editor.value.trim();
   try {validateSettings(s); await c.persist(); delete state.descriptions![field]; c.invalidateAssignments(); c.rebuild();}
   catch (error) {s.fieldDescriptions = previous; throw error;}
  });});
 }
 const scopeName = s.assignment.allFolders || !s.conceptFolders.length ? tr("labels.all_folders") : tr("messages.folders",{count:s.conceptFolders.length});
 const scope = disclosure(host, tr("fieldIdeas.existing_notes_for_suggestions", {value1: scopeName}), state.scopeOpen ?? false, 'analysis-scope');
 trackDisclosure(scope, open => {state.scopeOpen = open;});
 scope.createDiv({text: tr("fieldIdeas.this_selection_limits_the_title_list_sent_to_the_ai"), cls: 'em-muted em-caption'});
 scope.createDiv({text: tr("fieldIdeas.applied_links_are_added_to", {value1: c.activePath.split('/').at(-1)?.replace(/\.md$/u, '') || 'der aktuellen Notiz'}), cls: 'em-muted em-caption'});
 const folders = input(scope, tr("fieldIdeas.folders_to_search"), state.folders ?? s.conceptFolders.join('\n'), value => {state.folders = value;}, true) as HTMLTextAreaElement;
 folders.rows = 3; folders.placeholder = tr("fieldIdeas.all_folders_one_path_per_line");
 const filter = state.filter ?? s.assignment.propertyFilter;
 select(scope, 'Frontmatter', {none: tr("fieldIdeas.all_notes"), breadcrumbs: tr("fieldIdeas.with_a_breadcrumbs_field"), custom: tr("fieldIdeas.with_specific_keys")}, filter, value => {state.filter = value as typeof filter; ctx.repaint();});
 if (filter === 'custom') input(scope, tr("fieldIdeas.frontmatter_keys_comma_separated"), state.properties ?? s.assignment.properties.join(', '), value => {state.properties = value;});
 if (filter !== 'none') scope.createDiv({text: tr("fieldIdeas.at_least_one_key_must_exist_even_with_an_empty_value"), cls: 'em-muted em-caption'});
 const save = async (all: boolean) => {
  const chosen = all ? [] : folders.value.split('\n').map(f => f.trim() === '/' ? '/' : f.trim().replace(/\/$/u, '')).filter(Boolean);
  const properties = (state.properties ?? s.assignment.properties.join(', ')).split(',').map(p => p.trim()).filter(Boolean);
  if (filter === 'custom' && !properties.length) throw new Error(tr("fieldIdeas.enter_at_least_one_frontmatter_key"));
  const previousFolders = s.conceptFolders, previousAssignment = {...s.assignment};
  s.conceptFolders = chosen; s.assignment = {...s.assignment, allFolders: !chosen.length, propertyFilter: filter, properties};
  try {validateSettings(s); await c.persist(); state.folders = undefined; state.properties = undefined; state.filter = undefined; c.invalidateAssignments();}
  catch (error) {s.conceptFolders = previousFolders; s.assignment = previousAssignment; throw error;}
 };
 const actions = scope.createDiv({cls: 'em-actions'});
 button(actions, tr("argdown.apply"), () => {void ctx.run(() => save(false));});
 button(actions, tr("fieldIdeas.all_folders"), () => {void ctx.run(() => save(true));});
 scope.createDiv({text: tr("fieldIdeas.existing_names_are_also_recognized_throughout_the_vault"), cls: 'em-muted em-caption'});
 const newRow = scope.createEl('label', {cls: 'em-check-row'}), newBox = newRow.createEl('input', {type: 'checkbox'});
 newBox.checked = s.assignment.allowNewTargets; newRow.appendText(tr("fieldIdeas.allow_new_target_concepts")); newRow.title = tr("fieldIdeas.applying_only_adds_a_wiki_link_no_new_note_file");
 newBox.onchange = () => {void ctx.run(async () => {const previous = s.assignment.allowNewTargets; s.assignment.allowNewTargets = newBox.checked; try {await c.persist(); c.invalidateAssignments();} catch (error) {s.assignment.allowNewTargets = previous; throw error;}});};
 const existingRow = scope.createEl('label', {cls: 'em-check-row'}), existingBox = existingRow.createEl('input', {type: 'checkbox'});
 existingBox.checked = s.assignment.excludeExistingTargets; existingRow.appendText(tr("fieldIdeas.exclude_already_connected_targets")); existingRow.title = tr("fieldIdeas.checks_breadcrumbs_connections_in_both_directions_existing_links_are_retained");
 existingBox.onchange = () => {void ctx.run(async () => {
  const previous = s.assignment.excludeExistingTargets; s.assignment.excludeExistingTargets = existingBox.checked;
  try {await c.persist(); c.invalidateAssignments();} catch (error) {s.assignment.excludeExistingTargets = previous; throw error;}
 });};
 return fields.length > 0 && !missing.length && (s.assignment.propertyFilter !== 'custom' || s.assignment.properties.length > 0);
}
