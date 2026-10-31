import type {WebSearchUiState} from './web-search';
import {setIcon, setTooltip} from 'obsidian';
import type {EmergenceController} from '../controller';
import type {Decision} from '../types';
import type {ProfilePromptDraft} from '../llm/profile-prompts';
import type {WikipediaUiState} from './wikipedia';
export type Tab = 'search' | 'graph' | 'analysis' | 'inquiry';
export interface PanelState {
 analysis: WikipediaUiState & WebSearchUiState & {folders?: string; properties?: string; filter?: 'none' | 'breadcrumbs' | 'custom'; descriptionField?: string; descriptions?: Record<string, string>; fieldsOpen?: boolean; descriptionsOpen?: boolean; scopeOpen?: boolean;
  connection?: 'checking' | 'success' | 'error'; connectionMessage?: string; targetChoice?: string; ideaEdit?: {id: string; value: string; error?: string}; profileDrafts?: Record<string, ProfilePromptDraft>};
 inquiry: WikipediaUiState & WebSearchUiState & {prompt: string; mode: string; extra: string; template: string; kind?:import('../llm/research-examples').ResearchKind;field?:string;editingExample?:{id:string;value:string;error?:string}};
 inquirySource?:string;inquiries?:Record<string,PanelState['inquiry']>;
 search: {query: string; mode: 'open' | 'explore'};
 review: {query: string; status: string; page: number; expanded: string};
}
export const initialPanelState = (): PanelState => ({analysis: {}, inquiry: {prompt: '', mode: 'none', extra: '', template: '', kind:'examples', webGoal:'examples'}, search: {query: '', mode: 'open'}, review: {query: '', status: 'all', page: 0, expanded: ''}});
export function inquiryStateForNote(state:PanelState,source:string):PanelState['inquiry']{
 if(state.inquirySource===undefined){state.inquirySource=source;state.inquiries??={};return state.inquiry;}
 if(state.inquirySource!==source){state.inquiries??={};if(state.inquirySource!==undefined)state.inquiries[state.inquirySource]=state.inquiry;state.inquiry=state.inquiries[source]??initialPanelState().inquiry;state.inquirySource=source;}return state.inquiry;
}
export interface PanelContext {
 host: HTMLElement; controller: EmergenceController; state: PanelState;
 navigate(tab: Tab): void; repaint(): void; run(action: () => unknown): Promise<void>; isCurrent(): boolean;
}
export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
 const b = parent.createEl('button', {cls: 'clickable-icon', attr: {'aria-label': label, type: 'button'}});
 setIcon(b, icon); setTooltip(b, label); b.onclick = action; return b;
}
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
export function noteContext(parent: HTMLElement, path: string, label = 'Aktuelle Notiz'): void {
 const row = parent.createDiv({cls: 'em-note-context'}); setIcon(row.createSpan({cls: 'em-context-icon', attr: {'aria-hidden': 'true'}}), 'file-text');
 const text = row.createDiv(); text.createEl('small', {text: label});
 text.createDiv({text: path.split('/').at(-1)?.replace(/\.md$/u, '') || 'Keine Notiz geöffnet', cls: 'em-note-title'});
 if (path.includes('/')) text.createDiv({text: path, cls: 'em-path', attr: {title: path}});
}
export function badge(parent: HTMLElement, text: string, status = ''): HTMLElement {return parent.createSpan({text, cls: `em-badge ${status ? 'em-badge-' + status : ''}`});}
export const decisionLabel: Record<Decision, string> = {pending: 'Ungeprüft', accepted: 'Akzeptiert', rejected: 'Abgelehnt'};
export const evidenceLabel = {low: 'gering', medium: 'mittel', high: 'hoch'};
export function pagination(parent: HTMLElement, count: number, page: number, size: number, change: (page: number) => void): void {
 if (count <= size) return;
 const bar = parent.createDiv({cls: 'em-pagination'});
 const previous = iconButton(bar, 'chevron-left', 'Vorherige Seite', () => change(page - 1)); previous.disabled = page === 0;
 bar.createSpan({text: `${page * size + 1}–${Math.min(count, (page + 1) * size)} von ${count}`});
 const next = iconButton(bar, 'chevron-right', 'Nächste Seite', () => change(page + 1)); next.disabled = (page + 1) * size >= count;
}
