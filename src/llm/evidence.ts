import {t as tr} from '../i18n';
import {assert} from '../util';

export interface EvidenceSpan {id: string; start: number; end: number; text: string}
/** IDs are request-local. Text and offsets always refer to the untouched source. */
export function evidenceSpans(content: string, offset = 0): EvidenceSpan[] {
 const spans: EvidenceSpan[] = []; let start = 0;
 while (start < content.length) {
  let end = Math.min(start + 360, content.length);
  const newline = content.indexOf('\n', start);
  if (newline >= start && newline < end) end = newline + 1;
  else if (end < content.length) {
   const boundary = content.lastIndexOf(' ', end - 1);
   if (boundary > start + 180) end = boundary + 1;
   const code = content.charCodeAt(end - 1); if (code >= 0xD800 && code <= 0xDBFF) end--;
  }
  const text = content.slice(start, end);
  if (text.trim()) spans.push({id: `E${spans.length + 1}`, start: start + offset, end: end + offset, text});
  start = end;
 }
 return spans;
}
export function resolveEvidence(id: string, spans: EvidenceSpan[], content: string): string {
 const span = spans.find(s => s.id === id);
 assert(span && span.text.trim() && content.includes(span.text), tr("fieldIdeas.unknown_or_invalid_evidence_location"));
 return span.text;
}
