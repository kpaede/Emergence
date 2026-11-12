import {t as tr} from '../i18n';
import {Component, setIcon} from 'obsidian';
import {aboveSelection, belowElement, unionRect, type DiagramRect} from '../diagrams/controls';
import {inHoverRegion} from '../diagrams/hover-region';
import {dragRelations, type DragRelation} from './relations';
import {ArgdownDiagram} from './diagram';
export interface ArgdownInteractionHost {
 stage: HTMLElement; preview: HTMLElement; overlay: HTMLElement; toolbar: HTMLElement; selected: Set<string>; diagram: ArgdownDiagram; canConnect?(key: string): boolean; hover?(key?: string): void; toolKeys?(): ReadonlySet<string>; activateTools?(): void; connectionTarget?(key: string): string;
 select(keys: string[], additive?: boolean, reveal?: boolean): void; edit(): void; connect(from: string, to?: string, section?: string, point?: {x: number; y: number}, kind?: DragRelation): void; move(keys: Set<string>, section: string): void;
}
interface Drag {from: string; x: number; y: number; mode: 'connect' | 'move' | 'box'; kind: DragRelation; moved: boolean}
export class ArgdownInteractions extends Component {
 private drag?: Drag; private suppressClickUntil = 0; private pointerSelection?: string; private hoverAnchor?: {key: string; x: number; y: number};
 private marks!: HTMLElement; private handles!: HTMLElement; private line!: HTMLElement; private label!: HTMLElement; private box!: HTMLElement;
 constructor(private host: ArgdownInteractionHost) {super();}
 onload(): void {
  const h = this.host, doc = h.stage.ownerDocument;
  this.marks = h.overlay.createDiv(); this.handles = h.overlay.createDiv(); this.line = h.overlay.createDiv({cls: 'em-mm-drag-line em-ad-drag-arrow'});
  this.label = h.overlay.createDiv({cls: 'em-mm-drop-label'}); this.box = h.overlay.createDiv({cls: 'em-mm-selection-box'}); this.cancel();
  this.registerDomEvent(h.stage, 'pointermove', event => {
   if (this.drag || !(event.target instanceof Element)) return;
   if (event.target.closest('.em-mm-toolbar,.em-ad-connectors,.em-ad-connection-menu')) return;
   const key = h.preview.contains(event.target) ? this.key(event.target, event) : undefined;
   if (key && h.toolKeys?.().has(key)) this.hoverAnchor = {key, x: event.clientX, y: event.clientY};
   if (this.protectsHover(event)) return;
   this.hoverAnchor = key ? {key, x: event.clientX, y: event.clientY} : undefined; h.hover?.(key);
  });
  this.registerDomEvent(h.stage, 'pointerleave', () => {if (!this.drag) {this.hoverAnchor = undefined; h.hover?.();}});
  this.registerDomEvent(h.stage, 'pointerdown', event => this.start(event), {capture: true});
  this.registerDomEvent(h.stage, 'click', event => {if (Date.now() < this.suppressClickUntil && event.target instanceof Element && (h.preview.contains(event.target) || event.target.closest('.em-ad-connectors'))) {event.preventDefault(); event.stopImmediatePropagation();}}, {capture: true});
  this.registerDomEvent(h.preview, 'click', event => {
   if ((event.ctrlKey || event.metaKey) && event.target instanceof Element && event.target.closest('a')) return;
   event.preventDefault(); const key = this.key(event.target, event);
   if (!key) {h.hover?.(); h.select([]);} else if (key !== this.pointerSelection) {if (key) this.choose(key, event.shiftKey || event.ctrlKey || event.metaKey, true); else h.select([]);} else h.select([...h.selected], false, true);
   this.pointerSelection = undefined; h.preview.focus({preventScroll: true});
  });
  this.registerDomEvent(h.preview, 'dblclick', event => {const key = this.key(event.target, event); if (key) {event.preventDefault(); h.select([key]); h.edit();}});
  this.registerDomEvent(h.preview, 'keydown', event => {
   if (event.key === 'Escape') {event.preventDefault(); this.cancel(); h.select([]);}
   if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {event.preventDefault(); h.select(h.diagram.elements().map(el => this.key(el)).filter((key): key is string => !!key && /^(s|a):/u.test(key)));}
  });
  this.registerDomEvent(doc, 'pointermove', event => this.move(event)); this.registerDomEvent(doc, 'pointerup', event => this.end(event));
  this.registerDomEvent(doc, 'pointercancel', () => this.cancel()); this.registerDomEvent(doc.defaultView ?? window, 'blur', () => this.cancel());
  this.registerDomEvent(h.preview, 'scroll', () => this.paint(), {passive: true});
  const resize = new ResizeObserver(() => {h.stage.style.setProperty('--em-ad-tools-height', (h.stage.querySelector<HTMLElement>('.em-ad-diagram-tools')?.offsetHeight ?? 0) + 'px'); h.diagram.resize(); this.paint();}); resize.observe(h.stage);
  this.register(() => {resize.disconnect(); this.cancel(); this.marks.remove(); this.handles.remove(); this.line.remove(); this.label.remove(); this.box.remove();});
 }
 private toolRect(element: Element): DOMRect {
  return (element.classList.contains('cluster') ? element.querySelector(':scope > text') ?? element : element).getBoundingClientRect();
 }
 private protectsHover(point: {clientX: number; clientY: number}): boolean {
  const h = this.host; if (h.toolbar.hidden) return false;
  const sources = [...(h.toolKeys?.() ?? [])].flatMap(key => {
   const element = h.diagram.element(key); if (!element) return [];
   if (key.startsWith('e:') && this.hoverAnchor?.key === key) {const {x, y} = this.hoverAnchor; return [{left: x - 3, right: x + 3, top: y - 3, bottom: y + 3}];}
   return [this.toolRect(element)];
  });
  const controls = [h.toolbar, ...h.overlay.querySelectorAll<HTMLElement>('.em-ad-connectors')].filter(element => !element.hidden).map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
  return inHoverRegion({x: point.clientX, y: point.clientY}, sources, controls);
 }
 private choose(key: string, additive: boolean, reveal = false): void {const h = this.host; if (additive || !h.selected.has(key)) h.select([key], additive, reveal);}
 private start(event: PointerEvent): void {
  const h = this.host; if (event.button !== 0 || !(event.target instanceof Element)) return;
  if ((event.ctrlKey || event.metaKey) && event.target.closest('a')) return;
  const handle = event.target.closest<HTMLButtonElement>('[data-argdown-connect]'); if (handle?.disabled || event.target.closest('button') && !handle) return;
  const key = handle?.dataset.argdownConnect ?? this.key(event.target, event), additive = event.shiftKey || event.ctrlKey || event.metaKey;
  if (!key) {this.pointerSelection = undefined; if (!additive && h.preview.contains(event.target)) {h.hover?.(); h.select([]);} if (event.shiftKey && h.preview.contains(event.target)) {event.preventDefault(); this.drag = {from: '', x: event.clientX, y: event.clientY, mode: 'box', kind: 'support', moved: false};} return;}
  if (handle) {h.activateTools?.(); event.preventDefault(); event.stopPropagation();}
  else {event.preventDefault(); h.hover?.(key); this.pointerSelection = key; this.choose(key, additive); h.preview.focus({preventScroll: true}); if (additive || key.startsWith('e:') || key.startsWith('d:')) return;}
  this.drag = {from: key, x: event.clientX, y: event.clientY, mode: handle ? 'connect' : 'move', kind: (handle?.dataset.argdownRelation ?? 'support') as DragRelation, moved: false};
 }
 private move(event: PointerEvent): void {
  const d = this.drag, h = this.host; if (!d) return; d.moved ||= Math.hypot(event.clientX - d.x, event.clientY - d.y) >= 5; if (!d.moved) return;
  const bounds = h.stage.getBoundingClientRect(), dx = event.clientX - d.x, dy = event.clientY - d.y;
  if (d.mode === 'box') {
   this.box.hidden = false; this.box.style.setProperty('left', Math.min(d.x, event.clientX) - bounds.left + 'px'); this.box.style.setProperty('top', Math.min(d.y, event.clientY) - bounds.top + 'px'); this.box.style.setProperty('width', Math.abs(dx) + 'px'); this.box.style.setProperty('height', Math.abs(dy) + 'px'); return;
  }
  if (d.mode === 'connect') {
   this.line.dataset.relationKind = d.kind; this.line.hidden = false; this.line.style.setProperty('left', d.x - bounds.left + 'px'); this.line.style.setProperty('top', d.y - bounds.top + 'px'); this.line.style.setProperty('width', Math.hypot(dx, dy) + 'px'); this.line.style.setProperty('transform', 'rotate(' + Math.atan2(dy, dx) + 'rad)');
  }
  const key = this.at(event.clientX, event.clientY), section = this.sectionAt(event.clientX, event.clientY);
  const element = key && /^(s|a):/u.test(key) ? '„' + key.slice(2) + '“' : tr("argdown.new_element");
  this.label.setText(d.mode === 'connect' ? tr(d.kind==='attack'?"messages.dragAttack":d.kind==='undercut'?"messages.dragUndercut":"messages.dragSupport",{element,target:d.from.slice(2)}) : section ? tr("argdown.move_into_group") : tr("argdown.drag_onto_a_group"));
  this.label.hidden = false; this.label.style.setProperty('left', Math.max(4, Math.min(bounds.width - this.label.offsetWidth - 4, event.clientX - bounds.left + 12)) + 'px'); this.label.style.setProperty('top', Math.max(4, event.clientY - bounds.top - 30) + 'px');
  h.diagram.elements().forEach(el => el.classList.toggle('em-diagram-drop-target', this.key(el) === section && d.mode === 'move'));
 }
 private end(event: PointerEvent): void {
  const d = this.drag, h = this.host; if (!d?.moved) {this.drag = undefined; return;} this.cancel(); this.suppressClickUntil = Date.now() + 250;
  if (d.mode === 'box') {
   const left = Math.min(d.x, event.clientX), right = Math.max(d.x, event.clientX), top = Math.min(d.y, event.clientY), bottom = Math.max(d.y, event.clientY);
   h.select(h.diagram.elements().flatMap(el => {const key = this.key(el), r = el.getBoundingClientRect(); return key && /^(s|a):/u.test(key) && r.left >= left && r.right <= right && r.top >= top && r.bottom <= bottom ? [key] : [];})); return;
  }
  const bounds = h.preview.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
  const key = this.at(event.clientX, event.clientY), section = this.sectionAt(event.clientX, event.clientY);
  if (d.mode === 'connect') h.connect(d.from, key && /^(s|a):/u.test(key) ? key : undefined, section, {x: event.clientX, y: event.clientY}, d.kind);
  else if (section) h.move(new Set(h.selected), section);
 }
 reset(): void {this.hoverAnchor = undefined; this.cancel(); this.suppressClickUntil = 0;}
 private cancel(): void {this.drag = undefined; this.pointerSelection = undefined; this.line.hidden = this.label.hidden = this.box.hidden = true; this.host.diagram.elements().forEach(el => el.classList.remove('em-diagram-drop-target'));}
 private key(target: EventTarget | null, point?: {clientX: number; clientY: number}): string | undefined {
  if (!(target instanceof Element)) return; const element = target.closest<SVGGElement>('[data-argdown-key]'); if (!element) return;
  if (point && element.classList.contains('cluster') && !target.closest('text')) {const r = element.querySelector(':scope > polygon,:scope > path')?.getBoundingClientRect(); if (r && Math.min(Math.abs(point.clientX - r.left), Math.abs(point.clientX - r.right), Math.abs(point.clientY - r.top), Math.abs(point.clientY - r.bottom)) > 6) return;}
  return element.dataset.argdownKey;
 }

 private at(x: number, y: number): string | undefined {const key = this.key(this.host.stage.ownerDocument.elementFromPoint(x, y)); return key ? this.host.connectionTarget?.(key) ?? key : undefined;}
 private sectionAt(x: number, y: number): string | undefined {return this.host.diagram.elements().filter(el => this.key(el)?.startsWith('g:') && !this.host.selected.has(this.key(el)!)).map(el => ({el, r: el.getBoundingClientRect()})).filter(({r}) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom).sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height).map(({el}) => this.key(el))[0];}
 paint(): void {
  if (!this.marks) return; const h = this.host, tools = h.toolKeys?.() ?? h.selected, bounds = h.stage.getBoundingClientRect(); this.marks.empty(); this.handles.empty(); let selection: DiagramRect | undefined;
  for (const key of new Set([...h.selected, ...tools])) {
   const el = h.diagram.element(key), r = el?.getBoundingClientRect(); if (!r?.width || !r.height) continue; if (tools.has(key) && el) selection = unionRect(selection, this.toolRect(el));
   if (h.selected.has(key)) {const marker = this.marks.createDiv({cls: 'em-mm-selected'}); marker.style.setProperty('left', r.left - bounds.left - 3 + 'px'); marker.style.setProperty('top', r.top - bounds.top - 3 + 'px'); marker.style.setProperty('width', r.width + 6 + 'px'); marker.style.setProperty('height', r.height + 6 + 'px');}
   if (!/^(s|a):/u.test(key) || !tools.has(key) || tools.size !== 1 || h.canConnect?.(key) === false) continue;
   const strip = this.handles.createDiv({cls: 'em-ad-connectors', attr: {role: 'group', 'aria-label': tr("argdown.add_relation")}});
   for (const relation of dragRelations) {
    const action = relation.kind === 'support' ? tr("argdown.add_support_for", {value1: key.slice(2)}) : relation.kind === 'attack' ? tr("argdown.add_objection_to", {value1: key.slice(2)}) : tr("labels.inference_of") + key.slice(2) + '“ unterminieren';
    const button = strip.createEl('button', {cls: 'em-mm-connect em-ad-connect-handle', attr: {type: 'button', 'data-argdown-connect': key, 'data-argdown-relation': relation.kind, 'aria-label': action, title: tr("argdown.drag_or_click", {value1: action})}});
    if (relation.kind === 'undercut' && key.startsWith('s:')) {button.disabled = true; button.title = tr("argdown.an_undercut_adds_an_objection_to_an_argument_s_inference_select");}
    if (relation.symbol) button.setText(relation.symbol); else if (relation.icon) setIcon(button, relation.icon);
    button.onclick = event => {if (Date.now() >= this.suppressClickUntil) {event.stopPropagation(); h.activateTools?.(); h.connect(key, undefined, undefined, undefined, relation.kind);}};
   }
   belowElement(strip, r, bounds);
  }
  h.toolbar.hidden = !selection;
  if (selection) aboveSelection(h.toolbar, selection, bounds, (h.stage.querySelector<HTMLElement>('.em-ad-diagram-tools')?.offsetHeight ?? 0) + 14);
 }
}
