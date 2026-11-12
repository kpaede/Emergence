import {t as tr} from '../i18n';
import type {WebSearchUiState} from './web-search';
import {setIcon, setTooltip} from 'obsidian';
import type {EmergenceController} from '../controller';
import type {Decision} from '../types';
import type {ProfilePromptDraft} from '../llm/profile-prompts';
import type {WikipediaUiState} from './wikipedia';
export type Tab = 'search' | 'graph' | 'analysis' | 'mermaid' | 'argdown';
export interface PanelState {
 analysis: WikipediaUiState & WebSearchUiState & {folders?: string; properties?: string; filter?: 'none' | 'breadcrumbs' | 'custom'; descriptionField?: string; descriptions?: Record<string, string>; fieldsOpen?: boolean; descriptionsOpen?: boolean; scopeOpen?: boolean;
  connection?: 'checking' | 'success' | 'error'; connectionMessage?: string; targetChoice?: string; selectedIdea?: string; ideaEdit?: {id: string; value: string; error?: string}; profileDrafts?: Record<string, ProfilePromptDraft>};
 search: {query: string; mode: 'open' | 'explore'};
 review: {query: string; status: string; page: number; expanded: string};
}
export const initialPanelState = (): PanelState => ({analysis: {}, search: {query: '', mode: 'open'}, review: {query: '', status: 'all', page: 0, expanded: ''}});
export interface PanelContext {
 host: HTMLElement; controller: EmergenceController; state: PanelState;
 navigate(tab: Tab): void; repaint(): void; run(action: () => unknown): Promise<void>; isCurrent(): boolean;
}
export function labelWithoutTooltip(element: HTMLElement, text: string): void {
 const id = 'em-label-' + crypto.randomUUID();
 element.createSpan({text, cls: 'em-sr-only', attr: {id}});
 element.setAttribute('aria-labelledby', id);
}
export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void, tooltip = true): HTMLButtonElement {
 const b = parent.createEl('button', {cls: 'clickable-icon', attr: {type: 'button'}});
 setIcon(b, icon);
 if (tooltip) {b.setAttribute('aria-label', label); setTooltip(b, label);} else labelWithoutTooltip(b, label);
 b.onclick = action; return b;
}
export function relabelIcon(button:HTMLElement,label:string):void{button.setAttribute('aria-label',label);setTooltip(button,label);}
export function title(parent: HTMLElement, text: string, description = ''): HTMLElement {
 const section = parent.createDiv({cls: 'em-section-heading'}); section.createEl('h3', {text});
 if (description) section.createDiv({cls: 'em-muted', text: description}); return section;
}
export function emptyState(parent: HTMLElement, icon: string, heading: string, description: string): HTMLElement {
 const box = parent.createDiv({cls: 'em-empty'}); setIcon(box.createDiv({cls: 'em-empty-icon', attr: {'aria-hidden': 'true'}}), icon);
 box.createEl('h4', {text: heading}); box.createDiv({text: description, cls: 'em-empty-description'}); return box;
}
export function disclosure(parent: HTMLElement, label: string, open = false, key?: string): HTMLDetailsElement {
 const box = parent.createEl('details', {cls: 'em-disclosure'}); if (key) box.dataset.emDisclosure = key;
 box.open = open; box.createEl('summary', {text: label}); return box;
}
export function noteContext(parent: HTMLElement, path: string, label = tr("labels.current_note")): void {
 const row = parent.createDiv({cls: 'em-note-context'}); setIcon(row.createSpan({cls: 'em-context-icon', attr: {'aria-hidden': 'true'}}), 'file-text');
 const text = row.createDiv(); text.createEl('small', {text: label});
 text.createDiv({text: path.split('/').at(-1)?.replace(/\.md$/u, '') || tr("common.no_note_open"), cls: 'em-note-title'});
 if (path.includes('/')) text.createDiv({text: path, cls: 'em-path', attr: {title: path}});
}
export function badge(parent: HTMLElement, text: string, status = ''): HTMLElement {return parent.createSpan({text, cls: `em-badge ${status ? 'em-badge-' + status : ''}`});}
export const decisionLabel: Record<Decision, string> = {get pending() {return tr("common.unreviewed");}, get accepted() {return tr("labels.accepted");}, get rejected() {return tr("labels.rejected");}};
export const evidenceLabel = {low: 'gering', medium: 'mittel', high: 'hoch'};
export function pagination(parent: HTMLElement, count: number, page: number, size: number, change: (page: number) => void): void {
 if (count <= size) return;
 const bar = parent.createDiv({cls: 'em-pagination'});
 const previous = iconButton(bar, 'chevron-left', tr("labels.previous_page"), () => change(page - 1)); previous.disabled = page === 0;
 bar.createSpan({text: tr("messages.pageRange",{from:page*size+1,to:Math.min(count,(page+1)*size),total:count})});
 const next = iconButton(bar, 'chevron-right', tr("common.next_page"), () => change(page + 1)); next.disabled = (page + 1) * size >= count;
}
