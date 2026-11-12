export interface DiagramRect {left: number; top: number; right: number; bottom: number}
/** Same centering and edge handling for Mermaid and Argdown controls. */
export function belowElement(controls: HTMLElement, element: DiagramRect, stage: DOMRect): void {
 const width = controls.offsetWidth, height = controls.offsetHeight;
 controls.style.setProperty('left', Math.max(2, Math.min(stage.width - width - 2, (element.left + element.right) / 2 - stage.left - width / 2)) + 'px');
 controls.style.setProperty('top', Math.max(2, Math.min(stage.height - height - 2, element.bottom - stage.top + 5)) + 'px');
}
export function aboveSelection(toolbar: HTMLElement, selection: DiagramRect, stage: DOMRect, reserved = 4, lowerGap = 32): void {
 toolbar.style.setProperty('left', Math.max(4, Math.min(stage.width - toolbar.offsetWidth - 4, (selection.left + selection.right) / 2 - stage.left - toolbar.offsetWidth / 2)) + 'px');
 const top = selection.top - stage.top - toolbar.offsetHeight - 10;
 toolbar.style.setProperty('top', Math.max(4, Math.min(stage.height - toolbar.offsetHeight - 4, top < reserved ? selection.bottom - stage.top + lowerGap : top)) + 'px');
}
export function unionRect(a: DiagramRect | undefined, b: DiagramRect): DiagramRect {
 return a ? {left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom)} : b;
}
