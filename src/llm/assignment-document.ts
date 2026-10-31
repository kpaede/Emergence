import {splitFrontmatter} from '../review/frontmatter';
import {evidenceSpans, type EvidenceSpan} from './evidence';

/** Read prose, not empty template prompts or a stand-alone link's mere presence. */
export function assignmentDocument(content: string): {body: string; start: number; evidence: EvidenceSpan[]; ignoredLines: number} {
 const parts = splitFrontmatter(content), evidence: EvidenceSpan[] = []; let offset = parts.full.length, ignoredLines = 0;
 let paragraph = '', paragraphStart = offset;
 const flush = () => {
  for (const span of evidenceSpans(paragraph, paragraphStart)) evidence.push({...span, id: `E${evidence.length + 1}`});
  paragraph = '';
 };
 for (const match of parts.body.matchAll(/[^\n]*(?:\n|$)/gu)) {
  const line = match[0]; if (!line) continue;
  const text = line.trim(), withoutMarker = text.replace(/^#{1,6}\s*|^[-*+]\s*/u, '').trim();
  const blank = !text;
  const neutral = /^!?(?:\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]*\))\s*$/u.test(withoutMarker)
   || /^[-*_]{3,}$/u.test(text) || /^[-*+]\s+.*(?:[:：➜→⇒]|\[[ x]\])\s*$/iu.test(text)
   || /^\([^)]{1,40}\)\s*:\s*$/u.test(text);
  if (blank || neutral) {flush(); if (neutral) ignoredLines++;}
  else {if (!paragraph) paragraphStart = offset; paragraph += line;}
  offset += line.length;
 }
 flush();
 return {body: parts.body, start: parts.full.length, evidence, ignoredLines};
}
