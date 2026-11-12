import {t as tr} from '../i18n';
export interface ArgdownLinkContext {vault: string; sourcePath?: string; resolve?(path: string): string | undefined}
const encode = (value: string): string => encodeURIComponent(value).replace(/[!'()*]/gu, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
/** Store Obsidian links as ordinary Argdown-supported Markdown links. No renderer extension. */
export function argdownLabelSource(text: string, context: ArgdownLinkContext): string {
 return text.replace(/(?<!\\)\[\[([^\]\r\n]+)\]\]/gu, (_match, inner: string) => {
  const separator = inner.indexOf('|'), target = (separator < 0 ? inner : inner.slice(0, separator)).trim(), alias = separator < 0 ? target : inner.slice(separator + 1);
  const hash = target.indexOf('#'), path = hash < 0 ? target : target.slice(0, hash), subpath = hash < 0 ? '' : target.slice(hash);
  const resolved = path ? context.resolve?.(path) ?? path : context.sourcePath ?? '';
  if (!resolved) throw new Error(tr("argdown.specify_a_note_for_this_wiki_link"));
  return '[' + alias + '](obsidian://open?vault=' + encode(context.vault) + '&file=' + encode(resolved + subpath) + ')';
 });
}
