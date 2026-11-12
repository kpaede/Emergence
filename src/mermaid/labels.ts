import {quoted} from './source';
export type LabelMode = 'text' | 'markdown';

/** Entity escapes keep literal text literal in Pele, including mindmaps' Markdown labels. */
export function labelSource(text: string, mode: LabelMode): string {
 const escaped = mode === 'text' ? text.replace(/[#*_`~<>(){}[\]:%]/gu, ch => '#' + ch.codePointAt(0)! + ';') : text;
 return quoted(mode === 'markdown' ? '`' + escaped + '`' : escaped);
}
export function labelText(text: string): string {
 const named: Record<string, string> = {quot: '"', amp: '&', lt: '<', gt: '>', apos: "'"};
 return text.replace(/ﬂ°°([^¶]+)¶ß/gu, '#$1;').replace(/<br\s*\/?\s*>/giu, '\n').replace(/#(quot|amp|lt|gt|apos|\d+|x[\da-f]+);/giu, (whole: string, entity: string) => {
  if (named[entity]) return named[entity];
  const n = entity[0] === 'x' ? Number.parseInt(entity.slice(1), 16) : Number(entity);
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
 });
}
export function labelMode(source: string): LabelMode {return /"`[\s\S]*`"/u.test(source) ? 'markdown' : 'text';}
