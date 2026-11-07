import {iconButton} from './panel';

export type TermDrag = {kind: 'idea'; id: string; analysis: string; source: string}
 | {kind: 'relation'; focus: string; source: string; target: string; fields: string[]};
const mime = 'application/x-emergence-term';
let current: {value: TermDrag; document: Document} | undefined;

/** Only handles created by this plugin can initiate a frontmatter edit. */
export function termHandle(parent: HTMLElement, label: string, value: TermDrag, enabled: boolean | (() => boolean) = true, choose?: () => void): HTMLButtonElement {
 const handle = iconButton(parent, 'grip-vertical', label, () => choose?.(), false);
 handle.addClass('em-term-handle'); handle.disabled = typeof enabled === 'boolean' && !enabled; handle.draggable = !handle.disabled;
 handle.ondragstart = event => {
  if (!(typeof enabled === 'function' ? enabled() : enabled) || !event.dataTransfer) {event.preventDefault(); return;}
  event.stopPropagation(); current = {value, document: parent.ownerDocument};
  event.dataTransfer.effectAllowed = value.kind === 'idea' ? 'copy' : 'move';
  event.dataTransfer.setData(mime, JSON.stringify(value));
  event.dataTransfer.setDragImage(parent, 10, 10);
  parent.addClass('em-term-dragging');
 };
 handle.ondragend = () => {
  current = undefined; parent.removeClass('em-term-dragging');
  for (const target of parent.ownerDocument.querySelectorAll('.em-term-drop-active')) target.classList.remove('em-term-drop-active');
 };
 return handle;
}
export function termDrop(target: HTMLElement, accepts: (value: TermDrag) => boolean, apply: (value: TermDrag, event: DragEvent) => void): void {
 const value = () => current?.document === target.ownerDocument && accepts(current.value) ? current.value : undefined;
 target.ondragover = event => {
  const term = value(); if (!term || !event.dataTransfer) return;
  event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = term.kind === 'idea' ? 'copy' : 'move';
  target.addClass('em-term-drop-active');
 };
 target.ondragleave = event => {if (!(event.relatedTarget instanceof Node) || !target.contains(event.relatedTarget)) target.removeClass('em-term-drop-active');};
 target.ondrop = event => {
  const term = value(); if (!term) return;
  event.preventDefault(); event.stopPropagation(); current = undefined; target.removeClass('em-term-drop-active'); apply(term, event);
 };
}
