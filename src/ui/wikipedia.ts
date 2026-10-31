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
 row.appendText('Wikipedia zum Begriff hinzuziehen');box.checked=state.wikipedia??false;box.disabled=busy;box.dataset.emFocus='wikipedia-enabled';
 box.onchange=()=>{state.wikipedia=box.checked;repaint();};
 if(!state.wikipedia)return;
 const term=input(group,'Wikipedia-Suchbegriff',state.wikipediaTerm??targetTitle(source),value=>{state.wikipediaTerm=value;}) as HTMLInputElement;
 term.maxLength=180;term.disabled=busy;term.placeholder='Begriff eingeben';term.spellcheck=false;
 group.createDiv({text:'Nur dieser Suchbegriff geht an Wikipedia. Dein Notiztext bleibt lokal.',cls:'em-muted em-caption'});
}
export function renderWikipediaContext(host:HTMLElement,context:WikipediaContext|undefined,key:string):void{
 if(!context)return;
 if(context.status!=='ready') {host.createDiv({text:context.message??'Kein Wikipedia-Auszug verwendet.',cls:'em-muted em-caption',attr:{role:'status'}});return;}
 const box=disclosure(host,`Wikipedia · ${context.sources.length} ${context.sources.length===1?'Artikel':'Artikel'}${context.shortened?' · Auszug gekürzt':''}`,false,key);
 box.createDiv({text:`Suchbegriff: ${context.query}${context.cached?' · aus Sitzungscache':''}`,cls:'em-muted em-caption'});
 for(const source of context.sources){
  const link=box.createEl('a',{text:source.title,cls:'external-link',attr:{href:source.url,target:'_blank',rel:'noopener noreferrer'}});
  link.title=source.url;
  box.createDiv({text:`[${source.id}] · Wikipedia (${source.language})`,cls:'em-muted em-caption'});
  box.createDiv({text:source.excerpt,cls:'em-wikipedia-excerpt'});
  if(source.related.length)box.createDiv({text:`Verknüpfte Begriffe: ${source.related.join(' · ')}`,cls:'em-muted em-caption'});
 }
}
