import {t as tr} from '../i18n';
import {Modal, type App} from 'obsidian';
import {errorMessage} from '../util';

export function button(parent: HTMLElement, text: string, action: () => void, disabled = false): HTMLButtonElement {
 const b = parent.createEl('button', {text, attr: {type: 'button'}}); b.dataset.emFocus = text; b.disabled = disabled; b.onclick = action; return b;
}
export function input(parent: HTMLElement, label: string, value: string, change: (value: string) => void, multiline = false): HTMLInputElement | HTMLTextAreaElement {
 const wrapper = parent.createEl('label', {cls: 'em-field'}); wrapper.createSpan({text: label});
 const el = multiline ? wrapper.createEl('textarea') : wrapper.createEl('input', {type: 'text'});
 el.value = value; el.dataset.emFocus = label; el.oninput = () => change(el.value); return el;
}
export function select(parent: HTMLElement, label: string, values: Record<string, string>, value: string, change: (value: string) => void): HTMLSelectElement {
 const wrapper = parent.createEl('label', {cls: 'em-field'}); wrapper.createSpan({text: label});
 const el = wrapper.createEl('select'); for (const [key, text] of Object.entries(values)) el.createEl('option', {value: key, text});
 el.value = value; el.dataset.emFocus = label; el.onchange = () => change(el.value); return el;
}
export class ConfirmModal extends Modal {
 private submitting = false;
 constructor(app: App, private title: string, private before: string, private after: string,
  private confirm: () => Promise<void>, private cancel: () => void = () => {}, private caption = tr("common.confirm_and_apply")) {super(app);}
 onOpen(): void {
  this.setTitle(this.title);
  this.modalEl.addClass('em-confirm-modal');
  this.contentEl.createEl('p', {text: tr("common.review_the_complete_comparison_only_applies_the_displayed_changes", {value1: this.caption})});
  const diff = this.contentEl.createDiv({cls: 'em-diff'});
  const left = diff.createDiv(); left.createEl('h4', {text: tr("common.before")}); left.createEl('pre', {text: this.before || tr("labels.no_frontmatter")});
  const right = diff.createDiv(); right.createEl('h4', {text: tr("common.after")}); right.createEl('pre', {text: this.after || tr("labels.no_frontmatter")});
  this.contentEl.createDiv({text: tr("common.yaml_reformatting_is_also_shown_the_rest_of_the_note_remains"), cls: 'em-muted em-caption'});
  const error = this.contentEl.createDiv({cls: 'em-error', attr: {role: 'alert'}});
  const actions = this.contentEl.createDiv({cls: 'modal-button-container'});
  const cancel = button(actions, tr("common.cancel"), () => this.close());
  const apply = button(actions, this.caption, () => {
   if (this.submitting) return; this.submitting = true; apply.disabled = true;
   cancel.disabled = true;
   apply.setText(tr("common.applying"));
   void this.confirm().then(() => this.close()).catch(e => {error.setText(tr("common.close_the_dialog_and_check_the_current_state", {value1: errorMessage(e)})); this.submitting = false; apply.disabled = true; apply.setText(tr("common.confirmation_blocked")); cancel.disabled = false;});
  }); apply.addClass('mod-cta');
 }
 onClose(): void {this.cancel(); this.contentEl.empty();}
}
