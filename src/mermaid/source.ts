import {t as tr} from '../i18n';
import type {SourceRange} from './types';
export interface Statement extends SourceRange {text: string}

/** Split only outside labels, metadata, quoted strings and comments. Keep every source byte. */
export function statements(source: string): Statement[] {
 const out: Statement[] = []; let from = 0, quote = '', depth = 0, comment = false;
 for (let i = 0; i < source.length; i++) {
  const ch = source[i]!;
  if (comment) {if (ch !== '\n') continue; comment = false;}
  else if (quote) {if (ch === quote && source[i - 1] !== '\\') quote = ''; continue;}
  else if (ch === '"' || ch === '`') {quote = ch; continue;}
  else if (ch === '%' && source[i + 1] === '%') {comment = true; continue;}
  else if ('[({'.includes(ch)) depth++;
  else if ('])}'.includes(ch)) depth = Math.max(0, depth - 1);
  if ((ch === '\n' || ch === ';') && depth === 0) {out.push({from, to: i + 1, text: source.slice(from, i + 1)}); from = i + 1;}
 }
 if (from < source.length) out.push({from, to: source.length, text: source.slice(from)});
 return out;
}
export function flowHeader(source: string): Statement {
 for (const statement of statements(source)) {
  const match = /^(\s*(?:flowchart|graph)(?:-elk)?\b(?:[ \t]+(?:TB|TD|BT|LR|RL)\b)?[ \t]*(?:;|\r?\n)?)/u.exec(statement.text);
  if (match) return {from: statement.from, to: statement.from + match[0].length, text: match[0]};
 }
 throw new Error(tr("mermaid.the_flowchart_header_could_not_be_uniquely_matched"));
}
export function quoted(text: string): string {
 return '"' + text.replace(/"/gu, '#quot;').replace(/\n/gu, '<br/>') + '"';
}
export function freshId(ids: Iterable<string>, prefix = 'n'): string {
 const used = new Set(ids); let n = 1; while (used.has(prefix + n)) n++; return prefix + n;
}
export function appendSource(source: string, text: string): string {return source.trimEnd() + '\n' + text + '\n';}
/** Locate ids outside quoted labels and comments, without mistaking a label for a node. */
export function idRanges(source: string, ids: Iterable<string>): Map<string, SourceRange[]> {
 const known = new Set(ids), ranges = new Map<string, SourceRange[]>();
 let quote = '', comment = false, depth = 0;
 for (let i = 0; i < source.length;) {
  const ch = source[i]!;
  if (comment) {if (ch === '\n') comment = false; i++; continue;}
  if (quote) {if (ch === quote && source[i - 1] !== '\\') quote = ''; i++; continue;}
  if (ch === '"' || ch === '`') {quote = ch; i++; continue;}
  if (ch === '%' && source[i + 1] === '%') {comment = true; i += 2; continue;}
  if ('[({'.includes(ch)) {depth++; i++; continue;}
  if ('])}'.includes(ch)) {depth = Math.max(0, depth - 1); i++; continue;}
  if (depth) {i++; continue;}
  const match = /^[\p{L}\p{N}_](?:[\p{L}\p{N}_]|-(?![-.=>]))*/u.exec(source.slice(i));
  if (match) {const id = match[0]; if (known.has(id)) {const list = ranges.get(id) ?? []; list.push({from: i, to: i + id.length}); ranges.set(id, list);} i += id.length;}
  else i++;
 }
 return ranges;
}
