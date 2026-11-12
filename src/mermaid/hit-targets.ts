import {elementKey} from './selection';
import {isFlow, isMind, type DiagramModel} from './types';
import {parents} from './groups';

export interface DiagramElement {element: SVGGraphicsElement; key: string}
export function diagramElements(preview: HTMLElement, model?: DiagramModel): DiagramElement[] {
 let mindEdge = 0;
 return [...preview.querySelectorAll<SVGGraphicsElement>('.pele-node[data-id],.pele-cluster[data-id],.pele-edge,.pele-edge-label[data-id]')].flatMap(element => {
  let key = elementKey(element);
  if (!key && model && isMind(model) && element.classList.contains('pele-edge')) {const child = model.nodes.filter(n => !n.isRoot)[mindEdge++]; if (child) key = 'm:' + child.nodeId;}
  return key ? [{element, key}] : [];
 });
}
export function diagramKey(preview: HTMLElement, model: DiagramModel | undefined, element: Element): string | undefined {return elementKey(element) ?? diagramElements(preview, model).find(item => item.element === element)?.key;}
export function groupAtPoint(preview: HTMLElement, model: DiagramModel | undefined, x: number, y: number): string {
 if (!model || !isFlow(model)) return '';
 const parent = parents(model), depth = (id: string): number => {let d = 0; while (parent.has(id)) {id = parent.get(id)!; if (++d > model.subgraphs.length) break;} return d;};
 return [...preview.querySelectorAll<SVGGraphicsElement>('.pele-cluster[data-id]')].filter(element => {const r = element.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;}).sort((a, b) => depth(b.getAttribute('data-id')!) - depth(a.getAttribute('data-id')!))[0]?.getAttribute('data-id') ?? '';
}
/** A subgraph's title is its connection target; its empty interior creates nodes. */
export function connectionTarget(preview: HTMLElement, model: DiagramModel | undefined, x: number, y: number): string | undefined {
 const under = preview.ownerDocument.elementFromPoint(x, y), handle = under?.closest<HTMLElement>('[data-connect^="g:"]');
 if (handle && preview.parentElement?.contains(handle)) return handle.dataset.connect?.slice(2);
 const node = under?.closest('.pele-node[data-id]'); if (node && preview.contains(node)) return node.getAttribute('data-id') ?? undefined;
 if (!model || !isFlow(model)) return undefined;
 for (const group of preview.querySelectorAll<SVGGraphicsElement>('.pele-cluster[data-id]')) {
  const title = group.querySelector('.pele-cluster-label,.pele-label'); if (!title) continue; const r = title.getBoundingClientRect();
  if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return group.getAttribute('data-id') ?? undefined;
 }
 return undefined;
}
/** Wider invisible input paths use Pele's exact geometry in a separate SVG interaction layer. */
export function paintEdgeTargets(layer: SVGSVGElement, preview: HTMLElement, model: DiagramModel | undefined, stage: DOMRect, selected: Set<string>): void {
 // Keep the input paths across selection paints so the browser can recognize
 // a real double click on the same DOM element.
 const existing = [...layer.querySelectorAll<SVGPathElement>(':scope > path')]; let index = 0;
 layer.setAttribute('viewBox', `0 0 ${stage.width} ${stage.height}`);
 for (const {element, key} of diagramElements(preview, model)) {
  if (!key.startsWith('e:') && !key.startsWith('m:')) continue;
  const paths = element.tagName.toLowerCase() === 'path' ? [element] : [...element.querySelectorAll<SVGGraphicsElement>('path:not(.pele-marker)')];
  for (const path of paths) {
   const matrix = path.getScreenCTM(), d = path.getAttribute('d'); if (!matrix || !d) continue;
   const hit = existing[index++] ?? layer.createSvg('path', {cls: 'em-mm-edge-hit'});
   hit.setAttribute('d', d); hit.setAttribute('data-mm-key', key); hit.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e - stage.left} ${matrix.f - stage.top})`); hit.setAttribute('vector-effect', 'non-scaling-stroke');
   hit.toggleClass('is-selected', selected.has(key));
  }
 }
 for (const stale of existing.slice(index)) stale.remove();
}
