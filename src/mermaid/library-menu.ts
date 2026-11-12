import {t as tr} from '../i18n';
import {Component, setIcon} from 'obsidian';
import {MermaidLibrary, type MermaidTemplate} from './library';
import {LibraryPreview} from './library-preview';

export function libraryTrigger(host: HTMLElement): HTMLButtonElement {return host.createEl('button', {text: tr("mermaid.new"), cls: 'em-mm-new', attr: {type: 'button', 'aria-label': tr("mermaid.open_templates"), 'aria-haspopup': 'true', 'aria-expanded': 'false'}});}

interface LibraryActions {open(source: string): Promise<void>; insert(source: string): Promise<void>; source(): string; validate(source: string): void; preview(source: string): Promise<string>}
/** One searchable list directly below Neu; no modal or category submenus. */
export class MermaidLibraryMenu extends Component {
 readonly root: HTMLElement;
 private search: HTMLInputElement;
 private list: HTMLElement;
 private undo: HTMLButtonElement;
 private status: HTMLElement;
 private busy = false;
 private preview: LibraryPreview;
 private relabel:()=>void;
 constructor(host: HTMLElement, private trigger: HTMLButtonElement, readonly library: MermaidLibrary, private actions: LibraryActions) {
  super(); this.root = host.createDiv({cls: 'em-mm-library', attr: {role: 'region', 'aria-label': tr("mermaid.diagram_templates")}}); this.root.hidden = true;
  this.search = this.root.createEl('input', {type: 'search', placeholder: tr("mermaid.search_templates"), attr: {'aria-label': tr("mermaid.search_diagram_templates")}});
  this.list = this.root.createDiv({cls: 'em-mm-library-list', attr: {role: 'list'}});
  this.preview = this.addChild(new LibraryPreview(this.root, source => this.actions.preview(source)));
  const footer = this.root.createDiv({cls: 'em-mm-library-footer'}), save = footer.createEl('button', {text: tr("mermaid.save_current_diagram_as_template")});
  const form = this.root.createEl('form', {cls: 'em-mm-library-save'}); form.hidden = true;
  const name = form.createEl('input', {type: 'text', placeholder: tr("mermaid.template_name"), attr: {'aria-label': tr("mermaid.template_name_2"), required: 'true'}}), submit = form.createEl('button', {text: tr("mermaid.save"), attr: {type: 'submit'}});
  save.onclick = () => {form.hidden = !form.hidden; if (!form.hidden) name.focus();};
  form.onsubmit = event => {event.preventDefault(); void this.run(async () => {const source = actions.source(); actions.validate(source); submit.disabled = true; try {await library.add(name.value, source); name.value = ''; form.hidden = true;} finally {submit.disabled = false;}});};
  this.undo = footer.createEl('button', {text: tr("mermaid.undo"), attr: {'aria-label': tr("mermaid.undo_last_template_change")}}); this.undo.onclick = () => {void this.run(() => library.undo());};
  this.status = this.root.createDiv({cls: 'em-muted', attr: {role: 'status'}});
  this.relabel=()=>{this.trigger.setText(tr('mermaid.new'));this.trigger.setAttribute('aria-label',tr('mermaid.open_templates'));this.root.setAttribute('aria-label',tr('mermaid.diagram_templates'));this.search.placeholder=tr('mermaid.search_templates');this.search.setAttribute('aria-label',tr('mermaid.search_diagram_templates'));save.setText(tr('mermaid.save_current_diagram_as_template'));name.placeholder=tr('mermaid.template_name');name.setAttribute('aria-label',tr('mermaid.template_name_2'));submit.setText(tr('mermaid.save'));this.undo.setText(tr('mermaid.undo'));this.undo.setAttribute('aria-label',tr('mermaid.undo_last_template_change'));};
 }
 refreshLanguage():void{this.relabel();this.render();}
 onload(): void {
  this.register(this.library.subscribe(() => this.render()));
  this.registerDomEvent(this.search, 'input', () => this.render());
  this.registerDomEvent(this.root, 'keydown', event => {
   if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); this.hide(); this.trigger.focus();}
   if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const buttons = [...this.list.querySelectorAll<HTMLButtonElement>('[data-template-open]')], index = buttons.indexOf(event.target as HTMLButtonElement), next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next && (event.target === this.search || index >= 0)) {event.preventDefault(); next.focus();}
   }
  });
  this.registerDomEvent(this.root.ownerDocument, 'pointerdown', event => {if (!this.root.hidden && event.target instanceof Node && !this.root.contains(event.target) && !this.trigger.contains(event.target)) this.hide();}, {capture: true});
  this.register(() => {this.trigger.setAttribute('aria-expanded', 'false'); this.root.remove();});
  this.render();
 }
 toggle(): void {if (!this.root.hidden) this.hide(); else {this.root.hidden = false; this.trigger.setAttribute('aria-expanded', 'true'); this.render(); this.search.focus();void this.run(()=>this.library.refresh());}}
 hide(): void {this.preview.clear(); this.root.hidden = true; this.trigger.setAttribute('aria-expanded', 'false');}
 private row(item: MermaidTemplate): void {
  const row = this.list.createDiv({cls: 'em-mm-library-row', attr: {role: 'listitem', 'data-template-id': item.id}});
  row.onpointerenter = () => this.preview.show(item);
  const open = row.createEl('button', {text: item.name, cls: 'em-mm-template-open', attr: {type: 'button', 'data-template-open': item.id, title: tr("mermaid.open_in_editor")}}); open.onclick = () => {void this.run(async () => {await this.actions.open(item.source); this.hide();});};
  const icon = (name: string, label: string, run: () => Promise<void>): HTMLButtonElement => {const button = row.createEl('button', {cls: 'clickable-icon', attr: {type: 'button', 'aria-label': label, title: label}}); setIcon(button, name); button.onclick = () => {void this.run(run);}; return button;};
  const favorite = icon('star', this.library.isFavorite(item.id) ? tr("labels.remove_from_favorites") : tr("mermaid.add_to_favorites"), () => this.library.favorite(item.id));
  favorite.setAttribute('aria-pressed', String(this.library.isFavorite(item.id)));
  icon('file-plus', tr("mermaid.insert_template_into_current_note"), async () => {await this.actions.insert(item.source); this.hide();});
  if(item.path)icon('file-text',tr('settings.templateFolderReadOnly'),()=>this.library.openTemplate(item));
  if (item.id.startsWith('custom-')) icon('pencil', tr("mermaid.rename_template"), async () => {
   const input = row.createEl('input', {type: 'text', value: item.name, attr: {'aria-label': tr("mermaid.rename_template")}}); open.hidden = true; input.focus(); input.select();
   input.onkeydown = event => {if (event.key === 'Enter') {event.preventDefault(); event.stopPropagation(); void this.run(() => this.library.rename(item.id, input.value));} else if (event.key === 'Escape') {event.stopPropagation(); this.render();}};
   input.onblur = () => {if (!this.busy) this.render();};
  });
  icon('trash-2', item.path?tr('settings.templateHide'):tr("mermaid.delete_template"), () => this.library.remove(item.id));
  for (const button of row.querySelectorAll('button')) button.onfocus = () => this.preview.show(item);
 }
 private render(): void {
  const query = this.search.value.trim().toLocaleLowerCase(), items = this.library.list().filter(item => item.name.toLocaleLowerCase().includes(query));
  this.preview.clear(); this.list.empty();
  for (const [favorite, label] of [[true, tr("labels.favorites")], [false, tr("labels.templates")]] as const) {const section = items.filter(item => this.library.isFavorite(item.id) === favorite); if (section.length) {this.list.createDiv({text: label, cls: 'em-mm-library-heading'}); for (const item of section) this.row(item);}}
  if (!items.length) this.list.createDiv({text: tr("mermaid.no_templates_found"), cls: 'em-muted'});
  this.undo.disabled = !this.library.canUndo;
  this.status.setText(this.library.folderStatus);
 }
 private async run(action: () => Promise<void>): Promise<void> {
  if (this.busy) return; this.busy = true; this.root.setAttribute('aria-busy', 'true'); this.status.empty();
  for (const button of this.root.querySelectorAll('button')) button.disabled = true;
  try {await action();} catch (error) {this.status.setText(error instanceof Error ? error.message : String(error));}
  finally {this.busy = false; this.root.setAttribute('aria-busy', 'false'); for (const button of this.root.querySelectorAll('button')) button.disabled = false; this.undo.disabled = !this.library.canUndo;}
 }
}
