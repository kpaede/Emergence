import type {WebSearchContext, WebSearchRequest, SearchGoal} from '../llm/web-search';
import {searchQuery} from '../llm/web-search';
import {targetTitle} from '../review/wikilink';
import {input, select} from './helpers';
import {disclosure} from './panel';
export interface WebSearchUiState {webSearch?: boolean; webTerm?: string; webSource?: string; webGoal?: SearchGoal}
export function webSearchRequest(state: WebSearchUiState, source: string): WebSearchRequest {return {enabled: state.webSearch ?? false, term: state.webTerm ?? targetTitle(source), goal: state.webGoal ?? 'general'};}
export function renderWebSearchOption(host: HTMLElement, state: WebSearchUiState, source: string, busy: boolean, repaint: () => void): void {
 if (state.webSource !== source) {state.webSource = source; state.webTerm = undefined;}
 const group = host.createDiv({cls:'em-web-option'}), row = group.createEl('label',{cls:'em-check-row'}), box = row.createEl('input',{type:'checkbox'});
 row.appendText('Websuche hinzuziehen (DuckDuckGo)'); box.checked = state.webSearch ?? false; box.disabled = busy;
 box.onchange = () => {state.webSearch = box.checked; repaint();}; if (!box.checked) return;
 const term = input(group,'Web-Suchbegriff', state.webTerm ?? targetTitle(source), value => {state.webTerm = value; preview.setText(searchQuery(value, state.webGoal));}) as HTMLInputElement; term.maxLength = 180; term.disabled = busy;
 const goal = select(group,'Suchzusatz',{general:'Keiner',examples:'Beispiele',artworks:'Kunstwerke'},state.webGoal ?? 'general',value => {state.webGoal = value as SearchGoal;preview.setText(searchQuery(term.value,state.webGoal));}); goal.disabled = busy;
 const preview = group.createDiv({text:searchQuery(term.value,state.webGoal),cls:'em-muted em-caption'});
 group.createDiv({text:'Nur diese Suchanfrage geht an DuckDuckGo. Bis zu zwei Ergebnisseiten; keine Zielseiten werden geöffnet.',cls:'em-muted em-caption'});
}
export function renderWebSearchContext(host: HTMLElement, context: WebSearchContext | undefined, key: string): void {
 if (!context) return;
 if (context.status !== 'ready') {host.createDiv({text:context.message ?? 'Kein Webkontext verfügbar.',cls:'em-muted em-caption',attr:{role:'status'}});return;}
 const box = disclosure(host,`Websuche · ${context.totalSources??context.sources.length} Treffer${context.shortened?' · '+context.sources.length+' im Kontext':''}`,false,key);
 box.createDiv({text:context.query,cls:'em-muted em-caption'}); if(context.message)box.createDiv({text:context.message,cls:'em-muted em-caption'});
 for(const source of context.sources){box.createEl('a',{text:`[${source.id}] ${source.title}`,cls:'external-link',attr:{href:source.url,target:'_blank',rel:'noopener noreferrer'}});box.createDiv({text:source.snippet,cls:'em-muted em-caption'});}
}
