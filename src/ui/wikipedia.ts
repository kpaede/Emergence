import {t as tr} from '../i18n';
import type {WikipediaContext, WikipediaRequest} from '../types';
import {targetTitle} from '../review/wikilink';
import {input} from './helpers';
import {disclosure} from './panel';

export interface WikipediaUiState {wikipedia?:boolean;wikipediaTerm?:string;wikipediaSource?:string}
export function wikipediaRequest(state:WikipediaUiState,source:string):WikipediaRequest {
 return {enabled:state.wikipedia??false,term:state.wikipediaTerm??targetTitle(source)};
}
export function renderWikipediaOption(host:HTMLElement,state:WikipediaUiState,source:string,busy:boolean,repaint:()=>void):void{
 if(state.wikipediaSource!==source){state.wikipediaSource=source;state.wikipediaTerm=undefined;}
 const group=host.createDiv({cls:'em-wikipedia-option'}),row=group.createEl('label',{cls:'em-check-row'}),box=row.createEl('input',{type:'checkbox'});
 row.appendText(tr("common.include_wikipedia_for_this_term"));box.checked=state.wikipedia??false;box.disabled=busy;box.dataset.emFocus='wikipedia-enabled';
 box.onchange=()=>{state.wikipedia=box.checked;repaint();};
 if(!state.wikipedia)return;
 const term=input(group,tr("labels.wikipedia_search_term"),state.wikipediaTerm??targetTitle(source),value=>{state.wikipediaTerm=value;}) as HTMLInputElement;
 term.maxLength=180;term.disabled=busy;term.placeholder=tr("labels.enter_a_term");term.spellcheck=false;
 group.createDiv({text:tr("common.only_this_search_term_is_sent_to_wikipedia_your_note_text"),cls:'em-muted em-caption'});
}
export function renderWikipediaContext(host:HTMLElement,context:WikipediaContext|undefined,key:string):void{
 if(!context)return;
 if(context.status!=='ready') {host.createDiv({text:context.message??tr("common.no_wikipedia_excerpt_used"),cls:'em-muted em-caption',attr:{role:'status'}});return;}
 const box=disclosure(host,tr("messages.wikipediaArticles",{count:context.sources.length,details:context.shortened?tr("common.excerpt_shortened"):''}),false,key);
 box.createDiv({text:tr("messages.searchTerm",{term:context.query,cache:context.cached?tr("labels.from_session_cache"):''}),cls:'em-muted em-caption'});
 for(const source of context.sources){
  const link=box.createEl('a',{text:source.title,cls:'external-link',attr:{href:source.url,target:'_blank',rel:'noopener noreferrer'}});
  link.title=source.url;
  box.createDiv({text:`[${source.id}] · Wikipedia (${source.language})`,cls:'em-muted em-caption'});
  box.createDiv({text:source.excerpt,cls:'em-wikipedia-excerpt'});
  if(source.related.length)box.createDiv({text:tr("common.linked_concepts", {value1: source.related.join(' · ')}),cls:'em-muted em-caption'});
 }
}
