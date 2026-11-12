import {t as tr} from '../i18n';
export interface MermaidBlock {from: number; to: number; contentFrom: number; contentTo: number; source: string; index: number; line: number}
export function mermaidBlocks(text: string, language: RegExp = /^mermaid\s*$/iu): MermaidBlock[] {
 const result: MermaidBlock[] = [], lines = text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
 let offset = 0, fence: {char: string; length: number; from: number; contentFrom: number; mermaid: boolean; line: number} | undefined;
 for (const [line, raw] of lines.entries()) {
  const clean = raw.replace(/\r?\n$/u, '');
  if (!fence) {
   const match = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/u.exec(clean);
   if (match) fence = {char: match[1]![0]!, length: match[1]!.length, from: offset, contentFrom: offset + raw.length, mermaid: language.test(match[2]!.trim()), line};
  } else if (new RegExp('^ {0,3}' + fence.char + '{' + fence.length + ',}\\s*$').test(clean)) {
   if (fence.mermaid) result.push({from: fence.from, to: offset + raw.length, contentFrom: fence.contentFrom, contentTo: offset,
    source: text.slice(fence.contentFrom, offset).replace(/\r\n/gu, '\n').replace(/\n$/u, ''), index: result.length, line: fence.line});
   fence = undefined;
  }
  offset += raw.length;
 }
 return result;
}
/** Map the bound block across a single contiguous note change. Never guess by diagram text. */
export function relocateBlock(previous: string, next: string, block: MermaidBlock, language?: RegExp): MermaidBlock {
 let start = 0; while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
 let end = previous.length, nextEnd = next.length;
 while (end > start && nextEnd > start && previous[end - 1] === next[nextEnd - 1]) {end--; nextEnd--;}
 let position = block.from;
 if (end <= block.from) position += nextEnd - end;
 else if (start < block.to && end > block.from && (start < block.contentFrom || end > block.contentTo)) throw new Error(tr("mermaid.the_open_mermaid_block_was_moved_or_removed_open_it_again"));
 const found = mermaidBlocks(next, language).find(b => b.from === position);
 if (!found) throw new Error(tr("mermaid.the_open_mermaid_block_no_longer_exists"));
 return found;
}
export function replaceBlock(text: string, block: MermaidBlock, source: string, language?: RegExp): string {
 const eol = text.includes('\r\n') ? '\r\n' : '\n';
 const content = source.replace(/\r\n/gu, '\n').replace(/\n?$/u, '\n').replace(/\n/gu, eol), next = text.slice(0, block.contentFrom) + content + text.slice(block.contentTo);
 if (mermaidBlocks(next, language).find(b => b.from === block.from)?.contentTo !== block.contentFrom + content.length) throw new Error(tr("mermaid.the_source_contains_a_closing_markdown_fence_reopen_the_code_block"));
 return next;
}
export function fencedSource(source: string, language = 'mermaid'): string {
 const runs = source.match(/`+/gu) ?? [], fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
 return fence + language + '\n' + source.trimEnd() + '\n' + fence;
}
