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
  private confirm: () => Promise<void>, private cancel: () => void = () => {}, private caption = 'Bestätigen und übernehmen') {super(app);}
 onOpen(): void {
  this.setTitle(this.title);
  this.modalEl.addClass('em-confirm-modal');
  this.contentEl.createEl('p', {text: `Prüfe den vollständigen Vergleich. Erst „${this.caption}“ führt die angezeigten Änderungen aus.`});
  const diff = this.contentEl.createDiv({cls: 'em-diff'});
  const left = diff.createDiv(); left.createEl('h4', {text: 'Vorher'}); left.createEl('pre', {text: this.before || '(kein Frontmatter)'});
  const right = diff.createDiv(); right.createEl('h4', {text: 'Nachher'}); right.createEl('pre', {text: this.after || '(kein Frontmatter)'});
  this.contentEl.createDiv({text: 'Auch YAML-Umformatierungen sind sichtbar. Der übrige Notizinhalt bleibt unverändert.', cls: 'em-muted em-caption'});
  const error = this.contentEl.createDiv({cls: 'em-error', attr: {role: 'alert'}});
  const actions = this.contentEl.createDiv({cls: 'modal-button-container'});
  const cancel = button(actions, 'Abbrechen', () => this.close());
  const apply = button(actions, this.caption, () => {
   if (this.submitting) return; this.submitting = true; apply.disabled = true;
   cancel.disabled = true;
   apply.setText('Wird übernommen …');
   void this.confirm().then(() => this.close()).catch(e => {error.setText(errorMessage(e) + '\nSchließe den Dialog und prüfe den aktuellen Stand.'); this.submitting = false; apply.disabled = true; apply.setText('Bestätigung gesperrt'); cancel.disabled = false;});
  }); apply.addClass('mod-cta');
 }
 onClose(): void {this.cancel(); this.contentEl.empty();}
}
