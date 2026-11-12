import {t as tr} from '../i18n';
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
 row.appendText(tr("common.include_web_search_duckduckgo")); box.checked = state.webSearch ?? false; box.disabled = busy;
 box.onchange = () => {state.webSearch = box.checked; repaint();}; if (!box.checked) return;
 const term = input(group,tr("labels.web_search_term"), state.webTerm ?? targetTitle(source), value => {state.webTerm = value; preview.setText(searchQuery(value, state.webGoal));}) as HTMLInputElement; term.maxLength = 180; term.disabled = busy;
 const goal = select(group,tr("labels.search_suffix"),{general:tr("labels.none"),examples:tr("labels.examples"),artworks:tr("labels.artworks")},state.webGoal ?? 'general',value => {state.webGoal = value as SearchGoal;preview.setText(searchQuery(term.value,state.webGoal));}); goal.disabled = busy;
 const preview = group.createDiv({text:searchQuery(term.value,state.webGoal),cls:'em-muted em-caption'});
 group.createDiv({text:tr("common.only_this_query_is_sent_to_duckduckgo_up_to_two_results"),cls:'em-muted em-caption'});
}
export function renderWebSearchContext(host: HTMLElement, context: WebSearchContext | undefined, key: string): void {
 if (!context) return;
 if (context.status !== 'ready') {host.createDiv({text:context.message ?? tr("common.no_web_context_available"),cls:'em-muted em-caption',attr:{role:'status'}});return;}
 const box = disclosure(host,tr("messages.webResults",{count:context.totalSources??context.sources.length,details:context.shortened?tr("common.in_context",{value1:context.sources.length}):''}),false,key);
 box.createDiv({text:context.query,cls:'em-muted em-caption'}); if(context.message)box.createDiv({text:context.message,cls:'em-muted em-caption'});
 for(const source of context.sources){box.createEl('a',{text:`[${source.id}] ${source.title}`,cls:'external-link',attr:{href:source.url,target:'_blank',rel:'noopener noreferrer'}});box.createDiv({text:source.snippet,cls:'em-muted em-caption'});}
}
