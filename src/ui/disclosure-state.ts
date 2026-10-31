/** Capture live DOM state synchronously; native toggle events may still be queued. */
export class DisclosureState {
 private open = new Map<string, boolean>();
 capture(root: HTMLElement): void {
  for (const box of root.querySelectorAll<HTMLDetailsElement>('details[data-em-disclosure]')) this.open.set(box.dataset.emDisclosure!, box.open);
 }
 restore(root: HTMLElement): void {
  for (const box of root.querySelectorAll<HTMLDetailsElement>('details[data-em-disclosure]')) {
   const value = this.open.get(box.dataset.emDisclosure!); if (value !== undefined) box.open = value;
  }
 }
}
/** Removed details can emit delayed events; they must not overwrite current form state. */
export function trackDisclosure(box: HTMLDetailsElement, changed: (open: boolean) => void): void {
 box.addEventListener('toggle', () => {if (box.isConnected) changed(box.open);});
}
