import {t as tr} from '../i18n';
import {sanitizeHTMLToDom} from 'obsidian';
import {argdownNodeIds, themeArgdownNodes} from './theme';
import {edgeKey, nodeKey, type ArgdownModel} from './model';
/** The SVG is produced by Argdown/Graphviz; this layer only adds hit areas and navigation. */
export class ArgdownDiagram {
 private svg?: SVGSVGElement; private width = 1; private height = 1; private scale = 1; private autoFit = true;
 constructor(readonly preview: HTMLElement) {}
 set(svg: string, model: ArgdownModel): void {
  const fragment = sanitizeHTMLToDom(svg);
  // Do not load remote images merely by opening an Argdown block.
  for (const image of fragment.querySelectorAll('image')) image.remove();
  this.preview.replaceChildren(fragment); this.svg = this.preview.querySelector<SVGSVGElement>('svg') ?? undefined;
  if (!this.svg) throw new Error(tr("argdown.the_argdown_renderer_did_not_return_svg"));
  this.width = this.svg.viewBox.baseVal.width || 1; this.height = this.svg.viewBox.baseVal.height || 1;
  const nodes = argdownNodeIds(model); themeArgdownNodes(this.svg, model, nodes);
  for (const el of this.svg.querySelectorAll<SVGGElement>('.node,.cluster')) {
   const id = el.querySelector(':scope > title')?.textContent ?? '', node = nodes.get(id) ?? nodes.get(id.replace(/^cluster_/u, ''));
   if (node) {if (nodeKey(node).startsWith('d:')) el.classList.add('em-ad-derivation-boundary'); el.dataset.argdownKey = nodeKey(node); el.setAttribute('aria-label', (nodeKey(node).startsWith('d:') ? '' : String(node.type) === 'argument-map-node' ? tr("argdown.argument_3") : String(node.type) === 'group-map-node' ? tr("argdown.group") : tr("argdown.statement_3")) + (node.title ?? ''));}
  }
  // Graphviz preserves the numeric edge IDs in DOM even when it reorders SVG groups.
  for (const el of this.svg.querySelectorAll<SVGGElement>('.edge')) {
   const id = el.id.replace(/^edge/u, 'e'), edge = model.edges.find(edge => edge.id === id); if (!edge) continue;
   el.dataset.argdownKey = edgeKey(edge); el.setAttribute('aria-label', edge.relationType + ': ' + edge.from.title + ' → ' + edge.to.title);
   const path = el.querySelector('path'); if (path) {const hit = path.cloneNode() as SVGPathElement; hit.removeAttribute('id'); hit.setAttribute('class', 'em-ad-edge-hit'); el.append(hit);}
  }
  if (this.autoFit) this.fit(); else this.size();
 }
 elements(): Element[] {return [...this.preview.querySelectorAll('[data-argdown-key]')];}
 element(key: string): Element | undefined {return this.elements().find(el => (el as SVGGElement).dataset.argdownKey === key);}
 reveal(key: string): void {
  const target = this.element(key)?.getBoundingClientRect(); if (!target) return; const bounds = this.preview.getBoundingClientRect(), reserved = parseFloat(getComputedStyle(this.preview).paddingTop) || 8;
  const dy = target.top < bounds.top + reserved ? target.top - bounds.top - reserved : target.bottom > bounds.bottom - 8 ? target.bottom - bounds.bottom + 8 : 0;
  const dx = target.left < bounds.left + 8 ? target.left - bounds.left - 8 : target.right > bounds.right - 8 ? target.right - bounds.right + 8 : 0;
  if (dx || dy) this.preview.scrollBy(dx, dy);
 }
 fit(): void {this.autoFit = true; this.resize(); this.preview.scrollTo(0, 0);}
 resize(): void {if (!this.autoFit) return; const style = getComputedStyle(this.preview), horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight), vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom); this.scale = Math.min(1.5, Math.max(0.08, Math.min((this.preview.clientWidth - horizontal) / this.width, (this.preview.clientHeight - vertical) / this.height))); this.size();}
 zoom(factor: number): void {
  this.autoFit = false; const before = this.scale, x = this.preview.scrollLeft + this.preview.clientWidth / 2, y = this.preview.scrollTop + this.preview.clientHeight / 2;
  this.scale = Math.max(0.08, Math.min(5, before * factor)); this.size(); this.preview.scrollTo(x * this.scale / before - this.preview.clientWidth / 2, y * this.scale / before - this.preview.clientHeight / 2);
 }
 private size(): void {if (this.svg) {this.svg.style.setProperty('width', this.width * this.scale + 'px'); this.svg.style.setProperty('height', this.height * this.scale + 'px');}}
}
