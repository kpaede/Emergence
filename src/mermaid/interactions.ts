import {t as tr} from '../i18n';
import {Component} from 'obsidian';
import {aboveSelection, belowElement} from '../diagrams/controls';
import {connectionTarget, diagramElements, diagramKey, groupAtPoint, paintEdgeTargets} from './hit-targets';
import {isFlow, isMind, type DiagramModel} from './types';

export interface InteractionHost {
 stage: HTMLElement; preview: HTMLElement; overlay: HTMLElement; toolbar: HTMLElement;
 selected: Set<string>; model?: DiagramModel;
 select(keys: string[], additive?: boolean): void;
 connect(origin: string, target?: string, group?: string): void;
 move(keys: string[], target: string): void;
 editText(): void;
 openLink(target: string): void;
}
interface Drag {kind: 'connect' | 'move' | 'box'; x: number; y: number; origin: string; moved: boolean; line?: HTMLElement; box?: HTMLElement; label?: HTMLElement}
export class MermaidInteractions extends Component {
 private drag?: Drag; private suppressClickUntil = 0; private pointerSelection?: string;
 private hits: SVGSVGElement;
 constructor(private host: InteractionHost) {super(); this.hits = host.overlay.createSvg('svg', {cls: 'em-mm-edge-targets', attr: {'aria-hidden': 'true'}});}
 private pick(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const hit = target.closest<SVGElement>('[data-mm-key]'); if (hit) return hit.dataset.mmKey;
  const element = target.closest('.pele-node[data-id],.pele-cluster[data-id],.pele-edge,.pele-edge-label[data-id]');
  return element ? diagramKey(this.host.preview, this.host.model, element) : undefined;
 }
 private choose(key: string, additive: boolean): void {
  const h = this.host; if (additive || !h.selected.has(key)) h.select([key], additive); h.preview.focus({preventScroll: true});
 }
 onload(): void {
  const h = this.host, doc = h.stage.ownerDocument;
  this.registerDomEvent(h.preview, 'pointerdown', event => {
   if (!h.model || event.button !== 0) return;
   if ((event.ctrlKey || event.metaKey) && event.target instanceof Element && event.target.closest('a')) return;
   const key = this.pick(event.target);
   if (key) {
    event.stopImmediatePropagation(); event.preventDefault(); this.pointerSelection = key; this.choose(key, event.shiftKey);
    if ((key.startsWith('n:') || key.startsWith('g:')) && !event.shiftKey) this.drag = {kind: 'move', x: event.clientX, y: event.clientY, origin: key, moved: false};
   } else if (event.shiftKey && (isFlow(h.model) || isMind(h.model))) {
    event.stopImmediatePropagation(); event.preventDefault(); this.drag = {kind: 'box', x: event.clientX, y: event.clientY, origin: '', moved: false};
   }
  }, {capture: true});
  this.registerDomEvent(h.stage, 'click', event => {if (Date.now() < this.suppressClickUntil) {event.preventDefault(); event.stopImmediatePropagation();}}, {capture: true});
  const click = (event: MouseEvent): void => {
   const link = event.target instanceof Element ? event.target.closest('a') : undefined;
   if (link && (event.ctrlKey || event.metaKey)) {
    if (link.classList.contains('internal-link')) {event.preventDefault(); event.stopImmediatePropagation(); h.openLink(link.getAttribute('data-href') ?? link.getAttribute('href') ?? '');}
    return;
   }
   const key = this.pick(event.target);
   if (key) {event.preventDefault(); event.stopImmediatePropagation(); if (key !== this.pointerSelection) this.choose(key, event.shiftKey); else h.preview.focus({preventScroll: true});}
   else if (event.target instanceof Element && !event.target.closest('button,a')) h.select([]);
   this.pointerSelection = undefined;
  };
  this.registerDomEvent(h.preview, 'click', click, {capture: true});
  this.registerDomEvent(h.overlay, 'click', event => {if (event.target instanceof Element && event.target.closest('.em-mm-edge-targets')) click(event);});
  const doubleClick = (event: MouseEvent): void => {
   const key = this.pick(event.target); if (!key || key.startsWith('m:')) return;
   event.preventDefault(); event.stopImmediatePropagation(); h.select([key]); h.editText();
  };
  this.registerDomEvent(h.preview, 'dblclick', doubleClick, {capture: true});
  this.registerDomEvent(h.overlay, 'dblclick', doubleClick, {capture: true});
  this.registerDomEvent(h.overlay, 'pointerdown', event => {
   if (!(event.target instanceof Element) || event.button !== 0) return;
   const handle = event.target.closest<HTMLElement>('[data-connect]');
   if (handle) {event.preventDefault(); event.stopImmediatePropagation(); this.drag = {kind: 'connect', x: event.clientX, y: event.clientY, origin: handle.dataset.connect!, moved: false}; return;}
   const key = this.pick(event.target); if (key) {event.preventDefault(); event.stopImmediatePropagation(); this.pointerSelection = key; this.choose(key, event.shiftKey);}
  }, {capture: true});
  this.registerDomEvent(doc, 'pointermove', event => {
   const drag = this.drag; if (!drag) return;
   drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5; if (!drag.moved) return;
   h.overlay.addClass('is-dragging');
   const rect = h.stage.getBoundingClientRect();
   if (drag.kind === 'box') {
    drag.box ??= h.overlay.createDiv({cls: 'em-mm-selection-box'});
    drag.box.style.setProperty('left', Math.min(drag.x, event.clientX) - rect.left + 'px'); drag.box.style.setProperty('top', Math.min(drag.y, event.clientY) - rect.top + 'px');
    drag.box.style.setProperty('width', Math.abs(event.clientX - drag.x) + 'px'); drag.box.style.setProperty('height', Math.abs(event.clientY - drag.y) + 'px');
   } else {
    if (drag.kind === 'connect') {
    drag.line ??= h.overlay.createDiv({cls: 'em-mm-drag-line'});
    drag.line.style.setProperty('left', drag.x - rect.left + 'px'); drag.line.style.setProperty('top', drag.y - rect.top + 'px');
    drag.line.style.setProperty('width', Math.hypot(event.clientX - drag.x, event.clientY - drag.y) + 'px'); drag.line.style.setProperty('transform', `rotate(${Math.atan2(event.clientY - drag.y, event.clientX - drag.x)}rad)`);
     drag.label ??= h.overlay.createDiv({cls: 'em-mm-drop-label'});
     const group = groupAtPoint(h.preview, h.model, event.clientX, event.clientY), target = connectionTarget(h.preview, h.model, event.clientX, event.clientY), targetGroup = h.model && isFlow(h.model) ? h.model.subgraphs.find(g => g.id === target) : undefined;
     const name = targetGroup?.title || (h.model && isFlow(h.model) && target ? h.model.nodes.get(target)?.text : target);
     drag.label.setText(h.model && isMind(h.model) ? tr("mermaid.new_child_last") : target ? tr("labels.connect_to") + (targetGroup ? 'Subgraph' : tr("mermaid.node")) + ' „' + name + '“' : group ? tr("mermaid.new_node_in_subgraph") : tr("mermaid.new_node_top_level"));
     drag.label.style.setProperty('left', Math.max(4, Math.min(rect.width - 180, event.clientX - rect.left + 12)) + 'px'); drag.label.style.setProperty('top', Math.max(4, event.clientY - rect.top - 30) + 'px');
    }
   }
  });
  this.registerDomEvent(doc, 'pointerup', event => {
   const drag = this.drag; if (!drag) return; this.drag = undefined; drag.line?.remove(); drag.box?.remove(); drag.label?.remove(); if (!drag.moved) return;
   try {
   this.suppressClickUntil = Date.now() + 250;
   const under = doc.elementFromPoint(event.clientX, event.clientY), node = under?.closest('.pele-node[data-id]');
   if (drag.kind === 'connect') {
    if (h.stage.contains(under)) {
     const group = groupAtPoint(h.preview, h.model, event.clientX, event.clientY), origin = drag.origin.slice(2);
     const target = connectionTarget(h.preview, h.model, event.clientX, event.clientY);
     h.connect(origin, target, group);
    }
   }
   else if (drag.kind === 'move') {
    if (h.model && isMind(h.model)) {if (node && h.preview.contains(node)) h.move([...h.selected], node.getAttribute('data-id')!);}
    else if (h.stage.contains(under)) h.move([...h.selected], groupAtPoint(h.preview, h.model, event.clientX, event.clientY));
   } else {
    const left = Math.min(drag.x, event.clientX), right = Math.max(drag.x, event.clientX), top = Math.min(drag.y, event.clientY), bottom = Math.max(drag.y, event.clientY);
    h.select(diagramElements(h.preview, h.model).flatMap(({element, key}) => {const r = element.getBoundingClientRect(); return !key.startsWith('e:') && !key.startsWith('m:') && r.left >= left && r.right <= right && r.top >= top && r.bottom <= bottom ? [key] : [];}));
   }
   } finally {h.overlay.removeClass('is-dragging');}
  });
  const cancel = (): void => {this.drag?.line?.remove(); this.drag?.box?.remove(); this.drag?.label?.remove(); this.drag = undefined; this.pointerSelection = undefined;h.overlay.removeClass('is-dragging');};
  this.registerDomEvent(doc, 'pointercancel', cancel); this.registerDomEvent(doc.defaultView ?? window, 'blur', cancel); this.register(cancel);
 }
 paint(): void {
  const h = this.host; h.overlay.querySelectorAll('.em-mm-selected,.em-mm-connect').forEach(el => el.remove());
  const stage = h.stage.getBoundingClientRect(); paintEdgeTargets(this.hits, h.preview, h.model, stage, h.selected);
  let first: {left: number; top: number; right: number; bottom: number} | undefined;
  for (const {element, key} of diagramElements(h.preview, h.model)) {
   if (!h.selected.has(key)) continue;
   const rect = element.getBoundingClientRect(); if (!rect.width && !rect.height) continue;
   first = first ? {left: Math.min(first.left, rect.left), top: Math.min(first.top, rect.top), right: Math.max(first.right, rect.right), bottom: Math.max(first.bottom, rect.bottom)} : rect;
   if (key.startsWith('n:') || key.startsWith('g:')) {
    const box = h.overlay.createDiv({cls: 'em-mm-selected'});
    box.style.setProperty('left', rect.left - stage.left - 3 + 'px'); box.style.setProperty('top', rect.top - stage.top - 3 + 'px'); box.style.setProperty('width', rect.width + 6 + 'px'); box.style.setProperty('height', rect.height + 6 + 'px');
   }
   if (key.startsWith('n:') || key.startsWith('g:')) {
    const mind = h.model && isMind(h.model);
    const handle = h.overlay.createEl('button', {text: '+', cls: 'em-mm-connect', attr: {type: 'button', 'data-connect': key, 'aria-label': mind ? tr("mermaid.add_child_node_last") : key.startsWith('g:') ? tr("labels.drag_connection_from_subgraph") : tr("mermaid.drag_a_connection_or_add_a_node"), title: mind ? tr("mermaid.add_child_node_last") : tr("mermaid.drag_onto_a_node_subgraph_or_empty_space")}});
    belowElement(handle, rect, stage); handle.onclick = () => h.connect(key.slice(2));
   }
  }
  if (first) {
   aboveSelection(h.toolbar, first, stage);
  }
 }
}
