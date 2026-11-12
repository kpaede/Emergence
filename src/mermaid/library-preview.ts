import {t as tr} from '../i18n';
import {Component, sanitizeHTMLToDom} from 'obsidian';
import type {MermaidTemplate} from './library';
/** Late renders never replace another hovered template; no editor state is touched. */
export class LibraryPreview extends Component {
 readonly root: HTMLElement;
 private generation = 0;
 private timer?: number;
 private current?: string;
 private cache = new Map<string, string>();
 constructor(host: HTMLElement, private render: (source: string) => Promise<string>) {
  super(); this.root = host.createDiv({cls: 'em-mm-library-preview', attr: {role: 'img', 'aria-label': tr("mermaid.diagram_preview")}}); this.root.hidden = true;
 }
 onload(): void {this.register(() => {this.clear(); this.cache.clear(); this.root.remove();});}
 clear(): void {this.generation++; this.current = undefined; if (this.timer) window.clearTimeout(this.timer); this.timer = undefined; this.root.hidden = true; this.root.empty();}
 show(item: MermaidTemplate): void {
  if (this.current === item.id) return;
  this.clear(); this.current = item.id; const generation = this.generation;
  this.root.hidden = false; this.root.setAttribute('aria-label', tr("labels.preview") + item.name); this.root.setText(tr("mermaid.loading_preview"));
  this.timer = window.setTimeout(() => {this.timer = undefined; void this.draw(item, generation);}, 120);
 }
 private async draw(item: MermaidTemplate, generation: number): Promise<void> {
  try {
   const svg = this.cache.get(item.source) ?? await this.render(item.source);
   if (generation !== this.generation) return;
   // Bounded cache also covers all shipped examples without retaining arbitrary drafts.
   if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value!);
   this.cache.set(item.source, svg); const fragment = sanitizeHTMLToDom(svg);
   for (const image of fragment.querySelectorAll('image')) image.remove();
   this.root.empty(); this.root.append(fragment);
   const drawing = this.root.querySelector('svg'); if (drawing) {drawing.style.removeProperty('width'); drawing.style.removeProperty('height'); drawing.style.removeProperty('max-height');}
  } catch (error) {if (generation === this.generation) this.root.setText(tr("mermaid.preview_unavailable", {value1: (error instanceof Error ? error.message : String(error))}));}
 }
}
