import type {Menu} from 'obsidian';
/** Button menus stay at their button, including keyboard-generated click events. */
export function showDiagramMenu(menu: Menu, event: MouseEvent, fallback: HTMLElement): void {
 const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : fallback;
 if (!anchor.isConnected) return;
 const rect = anchor.getBoundingClientRect(); if (!rect.width || !rect.height) return;
 menu.showAtPosition({x: Math.max(4, rect.left), y: Math.max(4, rect.bottom + 4)});
}
