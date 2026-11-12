import {createHighlightState, highlightMermaidLine, type HighlightState} from './pele-highlighting';
export interface HighlightRange {from: number; to: number; className: string}
/** Pele website's escaped-span adapter; only ranges are passed into CodeMirror. */
export function highlightMermaidRanges(source: string): HighlightRange[] {
 const state: HighlightState = createHighlightState(), ranges: HighlightRange[] = [];
 const entities: Record<string, string> = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"};
 let lineOffset = 0;
 for (const line of source.split('\n')) {
  if (line.length <= 2000) {
   const classes: string[] = []; let offset = 0;
   for (const match of highlightMermaidLine(line, state).matchAll(/<span class="([\w-]+)">|<\/span>|([^<]+)/gu)) {
    if (match[1]) classes.push(match[1]);
    else if (match[2]) {
     const text = match[2].replace(/&(?:amp|lt|gt|quot|#39);/gu, entity => entities[entity]!), cls = classes[classes.length - 1];
     if (cls) ranges.push({from: lineOffset + offset, to: lineOffset + offset + text.length, className: cls}); offset += text.length;
    } else classes.pop();
   }
  }
  lineOffset += line.length + 1;
 }
 return ranges;
}
