import {t as tr} from '../i18n';
import {parseDocument} from 'yaml';
import type {SourceSpan} from './model';
export interface Edit extends SourceSpan {insert: string}
export function applyEdits(source: string, edits: Edit[]): string {
 let last = source.length;
 for (const edit of edits.sort((a, b) => b.from - a.from)) {if (edit.to > last || edit.from < 0 || edit.to < edit.from) throw new Error(tr("argdown.the_source_ranges_overlap_select_again")); source = source.slice(0, edit.from) + edit.insert + source.slice(edit.to); last = edit.from;}
 return source;
}
export function dataDocument(raw: string): {document: ReturnType<typeof parseDocument>; write(): string} {
 const block = /^\{[ \t]*\r?\n/u.test(raw), document = parseDocument(block ? raw.replace(/^\{[ \t]*\r?\n/u, '').replace(/\}\s*$/u, '') : raw);
 if (document.errors.length) throw new Error(tr("argdown.correct_the_metadata_in_the_source"));
 return {document, write: () => block ? '{\n' + document.toString().trimEnd() + '\n}' : document.toString().trim()};
}
