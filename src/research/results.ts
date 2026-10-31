import type {WikipediaContext} from '../types';
import type {WebSearchContext} from '../llm/web-search';
import type {ResearchIdea,ResearchKind} from '../llm/research-examples';
export interface ResearchResult {source:string;prompt:string;answer:string;context:string;wikipedia?:WikipediaContext;truncated?:boolean;requestContext?:string;webSearch?:WebSearchContext;examples?:ResearchIdea[];kind?:ResearchKind;field?:string}
/** Session state contains at most the latest result per note; it is never conversation context. */
export function latestResearchResults(entries:readonly ResearchResult[]):ResearchResult[]{
 const notes=new Map<string,ResearchResult>();for(const entry of entries)if(typeof entry.source==='string')notes.set(entry.source,entry);return [...notes.values()];
}
export function replaceResearchResult(entries:readonly ResearchResult[],entry:ResearchResult):ResearchResult[]{return latestResearchResults([...entries,entry]);}
