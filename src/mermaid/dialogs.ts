import {t as tr} from '../i18n';
import {Component, Modal, type App, type TFile} from 'obsidian';
import {cssColors} from './css-colors';
import type {LabelMode} from './labels';
import {MermaidMarkdownEditor} from './markdown-editor';

export class MermaidTextModal extends Modal {
 private lifecycle = new Component();
 private input?: HTMLTextAreaElement;
 private markdown?: MermaidMarkdownEditor;
 constructor(app: App, title: string, private value: string, private submit: (value: string, mode: LabelMode) => void, private mode?: LabelMode, private file?: TFile, private markdownHint?: string) {super(app); this.setTitle(title);}
 getValue(): string {return this.markdown?.value ?? this.input?.value ?? this.value;}
 setValue(value: string): void {this.value = value; if (this.markdown) this.markdown.set(value); else if (this.input) this.input.value = value;}
 onOpen(): void {
  this.lifecycle.load(); this.modalEl.addClass('em-mm-text-modal');
  let mount: () => void;
  if (this.mode) {
   const label = this.contentEl.createEl('label', {text: tr("mermaid.label_format"), cls: 'em-mm-label-mode'}), select = label.createEl('select', {attr: {'aria-label': tr("mermaid.label_format_2")}});
   select.createEl('option', {text: tr("argdown.text"), value: 'text'}); select.createEl('option', {text: tr("mermaid.markdown"), value: 'markdown'}); select.value = this.mode;
   this.lifecycle.registerDomEvent(select, 'change', () => {this.value = this.getValue(); this.mode = select.value === 'markdown' ? 'markdown' : 'text'; mount();});
  }
  const host = this.contentEl.createDiv({cls: 'em-mm-label-editor'}), status = this.contentEl.createDiv({cls: 'em-muted', attr: {role: 'status'}});
  const button = this.contentEl.createEl('button', {text: tr("argdown.apply"), cls: 'mod-cta'});
  const done = (): void => {this.submit(this.getValue(), this.mode ?? 'text'); this.close();};
  this.lifecycle.registerDomEvent(button, 'click', done);
  this.lifecycle.registerDomEvent(host, 'keydown', event => {if (!this.markdown && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {event.preventDefault(); event.stopPropagation(); done();}}, {capture: true});
  mount = (): void => {
   if (this.markdown) {this.lifecycle.removeChild(this.markdown); this.markdown = undefined;} this.input = undefined; host.empty(); status.empty();
   if (this.mode === 'markdown') {
    status.setText(this.markdownHint ?? tr("mermaid.pele_renders_line_breaks_bold_and_italic_in_the_diagram_wiki"));
    try {this.markdown = this.lifecycle.addChild(new MermaidMarkdownEditor(this.app, host, this.value, this.file, this.scope, done, () => this.close())); this.markdown.focus(); return;}
    catch {host.empty(); status.setText(tr("mermaid.live_preview_is_unavailable_in_this_obsidian_version_markdown_can_be"));}
   }
   const input = this.input = host.createEl('textarea', {cls: 'em-mm-text-input', attr: {'aria-label': this.titleEl.textContent ?? tr("argdown.text")}}); input.value = this.value; input.focus(); input.select();
  };
  mount();
 }
 onClose(): void {this.lifecycle.unload(); this.markdown = undefined; this.input = undefined; this.contentEl.empty();}
}
export function hsvColor(h: number, s: number, v: number): string {
 const channel = (offset: number): string => {const k = (offset + h / 60) % 6; return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))).toString(16).padStart(2, '0');};
 return '#' + channel(5) + channel(3) + channel(1);
}
export class MermaidColorModal extends Modal {
 private lifecycle = new Component();
 constructor(app: App, private apply: (color?: string) => void, private options?: {title?: string; hint?: string}) {super(app); this.setTitle(options?.title ?? tr("argdown.choose_color"));}
 onOpen(): void {
  this.lifecycle.load(); this.modalEl.addClass('em-mm-color-modal');
  if (this.options?.hint) this.contentEl.createDiv({text: this.options.hint, cls: 'em-muted'});
  const search = this.contentEl.createEl('input', {type: 'search', placeholder: tr("mermaid.search_css_colors"), attr: {'aria-label': tr("mermaid.search_css_colors_2")}});
  const palette = this.contentEl.createDiv({cls: 'em-mm-palette'});
  const swatches = cssColors.map(name => {
   const button = palette.createEl('button', {cls: 'em-mm-swatch', attr: {type: 'button', title: name, 'aria-label': name}}); button.style.setProperty('--em-mm-color', name);
   button.createSpan({cls: 'em-mm-swatch-surface', attr: {'aria-hidden': 'true'}});
   this.lifecycle.registerDomEvent(button, 'click', () => {this.apply(name); this.close();}); return {name, button};
  });
  this.lifecycle.registerDomEvent(search, 'input', () => {for (const {name, button} of swatches) button.hidden = !name.includes(search.value.toLowerCase());});
  const custom = this.contentEl.createDiv({cls: 'em-mm-custom-color'}), wheel = custom.createDiv({cls: 'em-mm-color-wheel', attr: {role: 'slider', tabindex: '0', 'aria-label': tr("mermaid.hue_and_saturation"), 'aria-valuemin': '0', 'aria-valuemax': '360'}});
  const shade = wheel.createDiv({cls: 'em-mm-wheel-shade'}), marker = wheel.createDiv({cls: 'em-mm-wheel-marker'});
  let h = 210, s = 1, v = 1;
  const brightnessLabel = custom.createEl('label', {text: tr("mermaid.brightness")}), brightness = brightnessLabel.createEl('input', {type: 'range', attr: {min: '0', max: '100', value: '100', 'aria-label': tr("mermaid.brightness")}});
  const row = custom.createDiv({cls: 'em-mm-color-value'}), preview = row.createDiv({cls: 'em-mm-color-preview'}), value = row.createEl('input', {type: 'text', attr: {'aria-label': tr("mermaid.hex_or_rgb_color_value")}});
  const update = (): void => {
   value.value = hsvColor(h, s, v); preview.style.setProperty('--em-mm-color', value.value); wheel.setAttribute('aria-valuenow', String(Math.round(h))); wheel.setAttribute('aria-valuetext', value.value);
   marker.style.setProperty('left', (50 + Math.cos(h * Math.PI / 180) * s * 50) + '%'); marker.style.setProperty('top', (50 + Math.sin(h * Math.PI / 180) * s * 50) + '%');
   shade.style.setProperty('opacity', String(1 - v));
  };
  const point = (event: PointerEvent): void => {const rect = wheel.getBoundingClientRect(), x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2), y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2); h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; s = Math.min(1, Math.hypot(x, y)); update();};
  this.lifecycle.registerDomEvent(wheel, 'pointerdown', event => {event.preventDefault(); wheel.setPointerCapture(event.pointerId); point(event);});
  this.lifecycle.registerDomEvent(wheel, 'pointermove', event => {if (wheel.hasPointerCapture(event.pointerId)) point(event);});
  this.lifecycle.registerDomEvent(wheel, 'keydown', event => {if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {event.preventDefault(); h = (h + (event.key === 'ArrowLeft' ? 355 : event.key === 'ArrowRight' ? 5 : 0)) % 360; s = Math.max(0, Math.min(1, s + (event.key === 'ArrowUp' ? 0.05 : event.key === 'ArrowDown' ? -0.05 : 0))); update();}});
  this.lifecycle.registerDomEvent(brightness, 'input', () => {v = Number(brightness.value) / 100; update();});
  const error = custom.createDiv({cls: 'em-error', attr: {role: 'status'}});
  this.lifecycle.registerDomEvent(value, 'input', () => {if (CSS.supports('color', value.value)) preview.style.setProperty('--em-mm-color', value.value);});
  const apply = custom.createEl('button', {text: tr("mermaid.apply_color"), cls: 'mod-cta'});
  this.lifecycle.registerDomEvent(apply, 'click', () => {
   const color = value.value.trim();
   if (!/^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/iu.test(color) || !CSS.supports('color', color)) {error.setText(tr("mermaid.enter_a_css_color_hex_or_rgb_value")); return;}
   this.apply(color); this.close();
  });
  const reset = custom.createEl('button', {text: tr("mermaid.reset_to_default")}); this.lifecycle.registerDomEvent(reset, 'click', () => {this.apply(); this.close();}); update();
 }
 onClose(): void {this.lifecycle.unload(); this.contentEl.empty();}
}
