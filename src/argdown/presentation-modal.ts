import {t as tr} from '../i18n';
import {Modal, type App} from 'obsidian';
import {MermaidColorModal} from '../mermaid/dialogs';
import {derivationMode} from './derivation';
import {selectionControls} from './selection-controls';
import type {ArgdownModel} from './model';
import {argdownColor} from './color';
import {presentationSettings, type PresentationChange} from './presentation';
export class ArgdownPresentationModal extends Modal {
 private changes = new Map<string, PresentationChange>(); private children = new Set<Modal>();
 constructor(app: App, private source: string, private apply: (changes: PresentationChange[]) => Promise<void>, private model?: ArgdownModel) {super(app); this.setTitle(tr("argdown.argument_map_appearance"));}
 onOpen(): void {
  this.modalEl.addClass('em-ad-presentation-modal'); const config = presentationSettings(this.source);
  this.contentEl.createDiv({text: tr("argdown.these_settings_apply_to_the_entire_map_and_are_stored_as"), cls: 'em-muted'});
  const set = (path: string[], value: unknown): void => {this.changes.set(path.join('.'), {path, value});};
  const select = (host: HTMLElement, label: string, path: string[], fallback: string, options: [string, string][]): void => {
   const row = host.createEl('label', {cls: 'em-ad-presentation-field'}); row.createSpan({text: label}); const input = row.createEl('select', {attr: {'aria-label': label}}), current: unknown = config.getIn(path), value = typeof current === 'string' ? current : current === undefined ? fallback : '__custom';
   for (const [id, text] of options) input.createEl('option', {value: id, text}); if (!options.some(([id]) => id === value)) input.createEl('option', {value, text: value === '__custom' ? tr("argdown.custom_configuration_from_source") : tr("labels.custom_value") + value}); input.value = value; input.onchange = () => {if (input.value !== '__custom') set(path, input.value);};
  };
  const number = (host: HTMLElement, label: string, path: string[], fallback: number, min: number, max: number): void => {
   const row = host.createEl('label', {cls: 'em-ad-presentation-field'}); row.createSpan({text: label}); const value: unknown = config.getIn(path), input = row.createEl('input', {type: 'number', value: String(typeof value === 'number' ? value : fallback), attr: {min: String(min), max: String(max), step: min < 1 ? '0.1' : '1', 'aria-label': label}});
   input.oninput = () => {input.dataset.edited = 'true'; input.setCustomValidity(''); if (input.value === '') {set(path, undefined); return;} const next = Number(input.value); if (!Number.isFinite(next) || next < min || next > max) input.setCustomValidity(tr("argdown.enter_a_value_between_and", {value1: min, value2: max})); else set(path, next);};
  };
  const section = (title: string, open = false): HTMLElement => {const details = this.contentEl.createEl('details', {cls: 'em-ad-presentation-section'}); details.open = open; details.createEl('summary', {text: title}); return details.createDiv();};
  const derivation = this.contentEl.createEl('label', {cls: 'em-ad-presentation-field'}); derivation.createSpan({text: tr("argdown.show_all_reconstructions_in_main_map")}); const expand = derivation.createEl('input', {type: 'checkbox', attr: {'aria-label': tr("argdown.show_all_reconstructions_in_main_map")}}); expand.checked = this.model ? derivationMode(this.model) === 'all' : config.getIn(['model', 'explodeArguments']) === true; expand.indeterminate = !!this.model && derivationMode(this.model) === 'mixed'; expand.onchange = () => set(['model', 'explodeArguments'], expand.checked);
  const labels = section(tr("labels.labels"), true), modes: [string, string][] = [['hide-untitled', tr("argdown.title_and_text")], ['title', tr("argdown.title_only")], ['text', tr("argdown.text_only")], ['none', tr("argdown.no_label")]];
  select(labels, tr("argdown.statement_labels"), ['map', 'statementLabelMode'], 'hide-untitled', modes); select(labels, tr("argdown.argument_labels"), ['map', 'argumentLabelMode'], 'hide-untitled', modes);
  const colors = section(tr("argdown.colors"));
  select(colors, tr("argdown.element_color_scheme"), ['color', 'colorScheme'], 'default', [['default', tr("labels.argdown_default")], ['colorbrewer-set2', 'Color Brewer · Set 2'], ['colorbrewer-dark2', 'Color Brewer · Dark 2'], ['colorbrewer-category10', 'Color Brewer · Category 10'], ['iwanthue-colorblind-friendly', tr("labels.i_want_hue_colorblind_friendly")], ['iwanthue-fancy', 'I want hue · Fancy']]);
  for (const [key, label] of [['statementFontColor', tr("argdown.font_color_of_all_statements")], ['argumentFontColor', tr("argdown.font_color_of_all_arguments")], ['groupFontColor', tr("argdown.font_color_of_all_groups")]] as const) {
   const button = colors.createEl('button', {text: label, attr: {'aria-label': label}}); button.onclick = () => {const picker = new MermaidColorModal(this.app, color => {set(['color', key], color ? argdownColor(color) : undefined); button.setText(label + (color ? ' · ' + color : tr("labels.default")));}, {title: label, hint: tr("argdown.applies_to_all_elements_of_this_type_in_the_current_map")}); this.child(picker);};
  }
  const shapes = section(tr("argdown.shapes_and_size")), options: [string, string][] = [['box', tr("labels.rectangle")], ['ellipse', 'Ellipse'], ['circle', tr("argdown.circle")], ['diamond', tr("labels.diamond")], ['hexagon', tr("labels.hexagon")], ['parallelogram', tr("labels.parallelogram")], ['note', tr("labels.note")]];
  for (const [type, label] of [['statement', tr("argdown.statements")], ['argument', tr("argdown.arguments")]] as const) {
   select(shapes, tr("argdown.shape_of_all", {value1: label}), ['dot', type, 'shape'], 'box', options);
   number(shapes, tr("labels.minimum_width_of") + label, ['dot', type, 'minWidth'], 180, 0, 2000);
   number(shapes, tr("argdown.text_size_of", {value1: label}), ['dot', type, 'text', 'fontSize'], 10, 6, 48);
   number(shapes, tr("argdown.title_size_of", {value1: label}), ['dot', type, 'title', 'fontSize'], 10, 6, 48);
  }
  const layout = section('Layout'); select(layout, tr("labels.layout_engine"), ['vizJs', 'engine'], 'dot', [['dot', tr("labels.hierarchical")], ['circo', tr("argdown.circular")], ['neato', tr("labels.network")], ['fdp', tr("argdown.force_directed")], ['osage', tr("labels.grouped")], ['twopi', 'Radial']]); number(layout, tr("argdown.spacing_between_ranks"), ['dot', 'graphVizSettings', 'ranksep'], 0.5, 0.1, 5); number(layout, tr("argdown.spacing_between_nodes"), ['dot', 'graphVizSettings', 'nodesep'], 0.25, 0.1, 5);
  const selection = section(tr("argdown.visibility_and_interpretation")); select(selection, tr("argdown.statements_in_map"), ['selection', 'statementSelectionMode'], 'with-title', [['with-title', tr("argdown.named_statements")], ['all', tr("argdown.all_statements")], ['top-level', tr("argdown.statements_outside_arguments")], ['with-relations', tr("argdown.statements_with_relations")], ['not-used-in-argument', tr("argdown.not_used_as_premise_or_conclusion")], ['with-more-than-one-relation', tr("argdown.statements_with_multiple_relations")]]);
  selectionControls(selection, config, this.model, change => this.changes.set(change.path.join('.'), change));
  select(selection, tr("argdown.relations_between_statements"), ['model', 'mode'], 'loose', [['loose', tr("argdown.support_and_attack")], ['strict', tr("argdown.entailment_and_contrariness")]]);
  const error = this.contentEl.createDiv({cls: 'em-error', attr: {role: 'status'}}), save = this.contentEl.createEl('button', {text: tr("argdown.apply"), cls: 'mod-cta'});
  save.onclick = () => {const invalid = [...this.contentEl.querySelectorAll('input')].find(input => input.dataset.edited === 'true' && !input.checkValidity()); if (invalid) {invalid.reportValidity(); return;} save.disabled = true; void this.apply([...this.changes.values()]).then(() => this.close()).catch((issue: unknown) => error.setText(String(issue))).finally(() => {save.disabled = false;});};
 }
 private child(modal: Modal): void {const close = modal.onClose.bind(modal); modal.onClose = () => {this.children.delete(modal); close();}; this.children.add(modal); modal.open();}
 onClose(): void {for (const modal of this.children) modal.close(); this.children.clear(); this.contentEl.empty();}
}
