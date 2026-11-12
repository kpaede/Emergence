import {t as tr} from '../i18n';
import type {ISection} from '@argdown/core';
import type {Document} from 'yaml';
import type {ArgdownModel} from './model';
import type {PresentationChange} from './presentation';
/** Native filters are applied only by the presentation dialog's shared Apply action. */
export function selectionControls(host: HTMLElement, config: Document, model: ArgdownModel | undefined, set: (change: PresentationChange) => void): void {
 const titles = (sections: ISection[]): string[] => sections.flatMap(section => [section.title ?? '', ...titles(section.children)]).filter(Boolean);
 for (const [field, label, available, missing, missingLabel] of [
  ['selectedSections', tr("argdown.filter_sections"), titles(model?.response.sections ?? []), 'selectElementsWithoutSection', tr("argdown.include_elements_without_a_section")],
  ['selectedTags', tr("labels.filter_tags"), Object.keys(model?.response.tags ?? {}), 'selectElementsWithoutTag', tr("labels.include_elements_without_tags")],
 ] as const) {
  const path = ['selection', field], original: unknown = config.getIn(path), selected = new Set(Array.isArray(original) ? original.filter((value): value is string => typeof value === 'string') : []);
  const row = host.createDiv({cls: 'em-ad-filter'}), toggle = row.createEl('label', {cls: 'em-ad-presentation-field'}); toggle.createSpan({text: label});
  const enabled = toggle.createEl('input', {type: 'checkbox', attr: {'aria-label': label}}); enabled.checked = Array.isArray(original);
  const choices = row.createDiv({cls: 'em-ad-filter-options'});
  const update = (): void => {choices.hidden = !enabled.checked; set({path, value: enabled.checked ? [...selected] : undefined});};
  enabled.onchange = update; choices.hidden = !enabled.checked;
  for (const value of new Set([...available, ...selected])) {
   const option = choices.createEl('label'), input = option.createEl('input', {type: 'checkbox', attr: {'aria-label': (field === 'selectedTags' ? 'Tag ' : tr("argdown.section")) + value}}); option.createSpan({text: (field === 'selectedTags' ? '#' : '') + value}); input.checked = selected.has(value);
   input.onchange = () => {if (input.checked) selected.add(value); else selected.delete(value); update();};
  }
  if (!available.length && !selected.size) choices.createDiv({text: field === 'selectedTags' ? tr("argdown.no_tags_in_the_source_yet") : tr("argdown.no_sections_in_the_source_yet"), cls: 'em-muted'});
  const include = choices.createEl('label'), input = include.createEl('input', {type: 'checkbox', attr: {'aria-label': missingLabel}}); include.createSpan({text: missingLabel}); input.checked = config.getIn(['selection', missing]) === true; input.onchange = () => set({path: ['selection', missing], value: input.checked});
 }
 host.createDiv({text: tr("argdown.for_multiple_tags_or_sections_one_match_in_each_is_sufficient"), cls: 'em-muted'});
}
