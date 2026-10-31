import type {LiteratureReference} from '../types';
export interface BibliographicItem {indexedKey: string; fields: {title?: string; citationKey?: string; date?: string; publicationTitle?: string; bookTitle?: string; publisher?: string}; baseFields?: {title?: string}; creators: {firstName: string | null; lastName: string | null}[]}
/** Metadata from ZotLit, never a title guessed from the citekey. */
export function bibliographicReference(item: BibliographicItem, citekey = item.fields.citationKey): LiteratureReference {
 const title = item.fields.title ?? item.baseFields?.title;
 return {indexedKey:item.indexedKey,citekey,...(title?.trim()?{title:title.trim()}: {})};
}
