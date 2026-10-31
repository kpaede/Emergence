import {validateSettings} from '../../config';
import {button, input, select} from '../helpers';
import {disclosure, type PanelContext} from '../panel';
import {trackDisclosure} from '../disclosure-state';

export function renderAnalysisScope(ctx: PanelContext): boolean {
 const {controller: c, host} = ctx, s = c.settings(), fields = c.analysisFields, state = ctx.state.analysis;
 const fieldBox = disclosure(host, `Felder · ${fields.length}`, state.fieldsOpen ?? !fields.length, 'analysis-fields');
 trackDisclosure(fieldBox, open => {state.fieldsOpen = open;});
 const list = fieldBox.createDiv({cls: 'em-analysis-field-list', attr: {role: 'list', 'aria-label': 'Breadcrumbs-Felder aus dem Frontmatter'}});
 for (const field of fields) {
  list.createSpan({text: field, attr: {role: 'listitem', 'data-em-field': field}});
 }
 fieldBox.createDiv({text: 'Aus dem Frontmatter, auch leere Felder.', cls: 'em-muted em-caption'});
 if (!c.graph.snapshot.fields.length) fieldBox.createDiv({text: 'Keine Breadcrumbs-Felder erkannt.', cls: 'em-muted'});
 const missing = fields.filter(field => !c.graph.snapshot.rules[field]?.description.trim());
 const descriptions = disclosure(host, missing.length ? `Feldbeschreibungen · ${missing.length} fehlen` : 'Feldbeschreibungen', state.descriptionsOpen ?? missing.length > 0, 'analysis-descriptions');
 trackDisclosure(descriptions, open => {state.descriptionsOpen = open;});
 if (c.graph.snapshot.fields.length) {
  const field = state.descriptionField ?? missing[0] ?? fields[0] ?? c.graph.snapshot.fields[0]!;
  select(descriptions, 'Feld', Object.fromEntries(c.graph.snapshot.fields.map(f => [f, f])), field, value => {state.descriptionField = value; ctx.repaint();});
  state.descriptions ??= {};
  const editor = input(descriptions, 'Bedeutung', state.descriptions[field] ?? s.fieldDescriptions[field] ?? c.graph.snapshot.rules[field]?.description ?? '', value => {state.descriptions![field] = value;}, true) as HTMLTextAreaElement;
  editor.rows = 4; editor.placeholder = 'Was soll ein Begriff in diesem Feld mit der analysierten Notiz zu tun haben?';
  button(descriptions.createDiv({cls: 'em-actions'}), 'Speichern', () => {void ctx.run(async () => {
   const previous = {...s.fieldDescriptions}; s.fieldDescriptions[field] = editor.value.trim();
   try {validateSettings(s); await c.persist(); delete state.descriptions![field]; c.invalidateAssignments(); c.rebuild();}
   catch (error) {s.fieldDescriptions = previous; throw error;}
  });});
 }
 const scopeName = s.assignment.allFolders || !s.conceptFolders.length ? 'alle Ordner' : `${s.conceptFolders.length} Ordner`;
 const scope = disclosure(host, `Vorhandene Notizen für Vorschläge · ${scopeName}`, state.scopeOpen ?? false, 'analysis-scope');
 trackDisclosure(scope, open => {state.scopeOpen = open;});
 scope.createDiv({text: 'Diese Auswahl begrenzt die Titelliste für die KI.', cls: 'em-muted em-caption'});
 scope.createDiv({text: `Übernommene Links werden in „${c.activePath.split('/').at(-1)?.replace(/\.md$/u, '') || 'der aktuellen Notiz'}“ ergänzt.`, cls: 'em-muted em-caption'});
 const folders = input(scope, 'Ordner für die Suche', state.folders ?? s.conceptFolders.join('\n'), value => {state.folders = value;}, true) as HTMLTextAreaElement;
 folders.rows = 3; folders.placeholder = 'Alle Ordner · ein Pfad pro Zeile';
 const filter = state.filter ?? s.assignment.propertyFilter;
 select(scope, 'Frontmatter', {none: 'Alle Notizen', breadcrumbs: 'Mit Breadcrumbs-Feld', custom: 'Mit bestimmten Schlüsseln'}, filter, value => {state.filter = value as typeof filter; ctx.repaint();});
 if (filter === 'custom') input(scope, 'Frontmatter-Schlüssel (kommagetrennt)', state.properties ?? s.assignment.properties.join(', '), value => {state.properties = value;});
 if (filter !== 'none') scope.createDiv({text: 'Mindestens ein Schlüssel muss vorhanden sein, auch ohne Wert.', cls: 'em-muted em-caption'});
 const save = async (all: boolean) => {
  const chosen = all ? [] : folders.value.split('\n').map(f => f.trim() === '/' ? '/' : f.trim().replace(/\/$/u, '')).filter(Boolean);
  const properties = (state.properties ?? s.assignment.properties.join(', ')).split(',').map(p => p.trim()).filter(Boolean);
  if (filter === 'custom' && !properties.length) throw new Error('Mindestens einen Frontmatter-Schlüssel eintragen.');
  const previousFolders = s.conceptFolders, previousAssignment = {...s.assignment};
  s.conceptFolders = chosen; s.assignment = {...s.assignment, allFolders: !chosen.length, propertyFilter: filter, properties};
  try {validateSettings(s); await c.persist(); state.folders = undefined; state.properties = undefined; state.filter = undefined; c.invalidateAssignments();}
  catch (error) {s.conceptFolders = previousFolders; s.assignment = previousAssignment; throw error;}
 };
 const actions = scope.createDiv({cls: 'em-actions'});
 button(actions, 'Übernehmen', () => {void ctx.run(() => save(false));});
 button(actions, 'Alle Ordner', () => {void ctx.run(() => save(true));});
 scope.createDiv({text: 'Vorhandene Namen werden zusätzlich im ganzen Vault erkannt.', cls: 'em-muted em-caption'});
 const newRow = scope.createEl('label', {cls: 'em-check-row'}), newBox = newRow.createEl('input', {type: 'checkbox'});
 newBox.checked = s.assignment.allowNewTargets; newRow.appendText('Neue Zielbegriffe erlauben'); newRow.title = 'Ergänzt bei Übernahme nur einen Wikilink. Keine neue Notizdatei.';
 newBox.onchange = () => {void ctx.run(async () => {const previous = s.assignment.allowNewTargets; s.assignment.allowNewTargets = newBox.checked; try {await c.persist(); c.invalidateAssignments();} catch (error) {s.assignment.allowNewTargets = previous; throw error;}});};
 const existingRow = scope.createEl('label', {cls: 'em-check-row'}), existingBox = existingRow.createEl('input', {type: 'checkbox'});
 existingBox.checked = s.assignment.excludeExistingTargets; existingRow.appendText('Bereits verbundene Ziele auslassen'); existingRow.title = 'Berücksichtigt Breadcrumbs-Verbindungen in beiden Richtungen. Bestehende Links bleiben erhalten.';
 existingBox.onchange = () => {void ctx.run(async () => {
  const previous = s.assignment.excludeExistingTargets; s.assignment.excludeExistingTargets = existingBox.checked;
  try {await c.persist(); c.invalidateAssignments();} catch (error) {s.assignment.excludeExistingTargets = previous; throw error;}
 });};
 return fields.length > 0 && !missing.length && (s.assignment.propertyFilter !== 'custom' || s.assignment.properties.length > 0);
}
