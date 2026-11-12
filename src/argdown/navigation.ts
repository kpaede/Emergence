import {t as tr} from '../i18n';
import {Component} from 'obsidian';
export interface ArgdownNavigationState {focus?: string; visible: boolean; mode: 'all' | 'none' | 'mixed'; hasDerivations: boolean; valid?: boolean}
/** View navigation never modifies the diagram source. Visibility is an independent action. */
export class ArgdownNavigation extends Component {
 readonly root: HTMLElement;
 private back: HTMLButtonElement; private title: HTMLElement; private visibility: HTMLLabelElement; private check: HTMLInputElement; private globalControl: HTMLLabelElement; private select: HTMLSelectElement;
 constructor(host: HTMLElement, actions: {back(): void; visible(value: boolean): void; all(value: boolean): void}) {
  super(); this.root = host.createEl('nav', {cls: 'em-ad-navigation', attr: {'aria-label': tr("argdown.argument_map_and_reconstruction")}});
  this.back = this.root.createEl('button', {text: tr("argdown.main_map"), attr: {'aria-label': tr("argdown.back_to_main_map")}}); this.back.onclick = () => actions.back();
  this.title = this.root.createEl('strong', {text: tr("argdown.main_map_2"), cls: 'em-ad-view-title'});
  this.visibility = this.root.createEl('label', {cls: 'em-ad-view-option'}); this.check = this.visibility.createEl('input', {type: 'checkbox', attr: {'aria-label': tr("argdown.show_this_reconstruction_in_the_main_map")}}); this.visibility.createSpan({text: tr("argdown.show_in_main_map")}); this.check.onchange = () => actions.visible(this.check.checked);
  this.globalControl = this.root.createEl('label', {cls: 'em-ad-view-option'}); this.globalControl.createSpan({text: tr("argdown.reconstructions")}); this.select = this.globalControl.createEl('select', {attr: {'aria-label': tr("argdown.reconstructions_in_main_map")}});
  for (const [value, text] of [['empty', tr("argdown.no_reconstructions_yet")], ['none', tr("argdown.hide_all")], ['all', tr("argdown.show_all")], ['mixed', tr("labels.individual")]]) this.select.createEl('option', {value, text});
  for (const value of ['empty', 'mixed']) this.select.querySelector<HTMLOptionElement>('[value="' + value + '"]')!.disabled = true; this.select.onchange = () => actions.all(this.select.value === 'all');
  this.update({visible: false, mode: 'none', hasDerivations: false}); this.register(() => this.root.remove());
 }
 update(state: ArgdownNavigationState): void {
  this.root.setAttribute('aria-label',tr('argdown.argument_map_and_reconstruction'));this.back.setText(tr('argdown.main_map'));this.back.setAttribute('aria-label',tr('argdown.back_to_main_map'));
  this.check.setAttribute('aria-label',tr('argdown.show_this_reconstruction_in_the_main_map'));this.visibility.querySelector('span')?.setText(tr('argdown.show_in_main_map'));this.globalControl.querySelector('span')?.setText(tr('argdown.reconstructions'));this.select.setAttribute('aria-label',tr('argdown.reconstructions_in_main_map'));
  for(const [value,text]of [['empty',tr('argdown.no_reconstructions_yet')],['none',tr('argdown.hide_all')],['all',tr('argdown.show_all')],['mixed',tr('labels.individual')]])this.select.querySelector(`[value="${value}"]`)?.setText(text!);
  this.back.hidden = !state.focus; this.title.setText(state.focus ? tr("argdown.reconstruction", {value1: state.focus}) : tr("argdown.main_map_2")); this.visibility.hidden = !state.focus; this.check.disabled = state.valid === false; if (state.valid !== false) this.check.checked = state.visible;
  this.globalControl.hidden = !!state.focus; this.select.value = state.hasDerivations ? state.mode : 'empty'; this.select.disabled = !state.hasDerivations;
 }
}
