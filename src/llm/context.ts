import {t as tr} from '../i18n';
import type {Settings} from '../types';
import {assert} from '../util';
import type {Message} from './provider';
import {templateVariables} from '../config';

export const placeholders = templateVariables;
export function renderTemplate(template: string, values: Record<string, string>): string {
 return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_match, key: string) => {
  assert(placeholders.includes(key) && Object.prototype.hasOwnProperty.call(values, key), tr("fieldIdeas.unknown_or_missing_placeholder", {value1: key}));
  return values[key]!;
 });
}
export interface Section {index: number; start: number; end: number; content: string; heading: string}
/** Hard bounds preserve every character, including giant paragraphs and fenced code. */
export function sectionMarkdown(content: string, maxCharacters: number): Section[] {
 assert(maxCharacters >= 100, tr("labels.context_budget_too_small"));
 const sections: Section[] = []; let start = 0, heading = '';
 while (start < content.length) {
  let end = Math.min(start + maxCharacters, content.length);
  if (end < content.length) {
   const boundary = content.lastIndexOf('\n', end - 1);
   if (boundary > start + maxCharacters / 2) end = boundary + 1;
   else {
    const space = content.lastIndexOf(' ', end - 1);
    if (space > start + maxCharacters / 2) end = space + 1;
   }
   const code = content.charCodeAt(end - 1); if (code >= 0xD800 && code <= 0xDBFF) end--;
  }
  const text = content.slice(start, end);
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gmu)];
  heading = headings.at(-1)?.[1] ?? heading;
  sections.push({index: sections.length, start, end, content: text, heading}); start = end;
 }
 return sections.length ? sections : [{index: 0, start: 0, end: 0, content: '', heading: ''}];
}
/** Conservative estimate, not an exact model tokenizer. Count content, not the HTTP envelope. */
export function estimateTextTokens(text: string): number {
 let count = 0; const encoder = new TextEncoder();
 for (const match of text.matchAll(/[\p{Script=Latin}\p{M}]+|\p{Nd}+|[ \t]+|\r\n|[\s\S]/gu)) {
  const part = match[0], bytes = encoder.encode(part).length;
  if (/^[\p{Script=Latin}\p{M}]+$/u.test(part)) count += Math.ceil(bytes / (part.length > 24 ? 2 : 3));
  else if (/^\p{Nd}+$/u.test(part)) count += Math.ceil(part.length / 2);
  else if (/^[ \t]+$/u.test(part)) count += Math.ceil(part.length / 4);
  else count += bytes;
 }
 return count;
}
export const tokenBound = (messages: Message[]): number => 32 + messages.reduce((sum, message) => sum + 12 + estimateTextTokens(message.content), 0);
export function contextEstimate(messages: Message[], outputTokens: number, structured: boolean | object = false): number {
 return tokenBound(messages) + (typeof structured === 'object' ? estimateTextTokens(JSON.stringify(structured)) : 0) + outputTokens + 512;
}
export class ContextBudgetError extends Error {}
export function ensureBudget(messages: Message[], settings: Settings, outputTokens: number, structured: boolean | object = false): void {
 const total = contextEstimate(messages, outputTokens, structured);
 if(total>settings.numCtx)throw new ContextBudgetError(tr("fieldIdeas.estimated_context_budget_exceeded_including_output_and_reserve", {value1: total, value2: settings.numCtx}));
}
