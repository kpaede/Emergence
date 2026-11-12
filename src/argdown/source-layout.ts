import {t as tr} from '../i18n';
import type {IConclusion} from '@argdown/core';
import {applyEdits, type Edit} from './source-edits';
import {edgeKey, isGroup, leaves, nodeKey, span, type ArgdownModel, type IAstNode} from './model';
import type {ArgdownEngine} from './engine';
/** Preserve native argument content, data, grouping and interpreted edges when tidying source. */
export function argdownMeaning(model: ArgdownModel, generated?: string): string {
 const data = (value: unknown, key: string): unknown => {if (key !== generated || !value || typeof value !== 'object') return value; const copy = {...value}; delete (copy as Record<string, unknown>).isInGroup; return copy;};
 return JSON.stringify([
  Object.entries(model.response.statements ?? {}).map(([title, value]) => [title, value.members.filter(member => member.text?.trim()).map(member => [member.text, data(member.data as unknown, 's:' + title), member.tags])]).sort(),
  Object.entries(model.response.arguments ?? {}).map(([title, value]) => [title, value.members.filter(member => member.text?.trim()).map(member => [member.text, data(member.data as unknown, 'a:' + title), member.tags]), value.pcs.map(step => [step.title, step.text, step.role, (step as IConclusion).inference?.inferenceRules, (step as IConclusion).inference?.data as unknown])]).sort(),
  model.nodes.map(node => [nodeKey(node), node.labelText, node.labelTitle, node.color, node.fontColor]).sort(),
  model.nodes.filter(isGroup).map(group => [nodeKey(group), group.children?.map(nodeKey).sort()]).sort(),
  model.edges.map(edgeKey).sort(),
 ]);
}
/** Append a child beneath its existing declaration, keeping its whole relation tree together. */
export function relationUnder(model: ArgdownModel, key: string, child: string, symbol: string): string | undefined {
 const candidates = model.rules.filter(rule => key.startsWith('a:') ? String(rule.name) === 'argument' && rule.argument?.title === key.slice(2) : String(rule.name) === 'statement' && rule.statement?.title === key.slice(2));
 const rule = candidates.find(rule => leaves(rule).some(token => 'tokenType' in token && /Definition/u.test(token.tokenType.name) && token.title === key.slice(2))) ?? candidates[0];
 const range = rule ? span(rule) : undefined; if (!range) return;
 const lineStart = model.source.lastIndexOf('\n', range.from - 1) + 1, indent = model.source.slice(lineStart, range.from).match(/^[ \t]*/u)?.[0] ?? '';
 const lineEnd = model.source.indexOf('\n', range.to), at = lineEnd < 0 ? model.source.length : lineEnd;
 const newline = model.source.includes('\r\n') ? '\r\n' : '\n';
 return applyEdits(model.source, [{from: at, to: at, insert: newline + indent + '  ' + symbol + ' ' + child}]);
}
/** Format layout whitespace only; leave comments, labels, YAML and inference bodies untouched. */
export function formatArgdown(engine: ArgdownEngine, source: string): string {
 const model = engine.parse(source), edits: Edit[] = [];
 const visit = (node: IAstNode, depth: number): void => {
  if (!('children' in node)) return;
  const rule = node, relation = !!rule.relation, next = relation ? depth + 1 : depth;
  if (relation) {
   const token = rule.children?.find(child => 'tokenType' in child), range = token ? span(token) : undefined;
   if (range) {const raw = source.slice(range.from, range.to), match = /^(\r?\n)?[ \t]*([+<>_-])/u.exec(raw); if (match) edits.push({from: range.from + (match[1]?.length ?? 0), to: range.from + match[0].length - 1, insert: '  '.repeat(next)});}
  }
  for (const child of rule.children ?? []) visit(child, next);
 };
 if (model.response.ast) visit(model.response.ast, 0);
 const blocks = model.response.ast && 'children' in model.response.ast ? (model.response.ast.children ?? []).filter(child => 'children' in child).map(span).filter((range): range is NonNullable<typeof range> => !!range) : [];
 const newline = source.includes('\r\n') ? '\r\n' : '\n';
 for (let index = 1; index < blocks.length; index++) {const from = blocks[index - 1]!.to, to = blocks[index]!.from, gap = source.slice(from, to); if (/^\s+$/u.test(gap) && gap !== newline + newline) edits.push({from, to, insert: newline + newline});}
 const candidate = applyEdits(source, edits);
 if (argdownMeaning(model) !== argdownMeaning(engine.parse(candidate))) throw new Error(tr("argdown.the_source_could_not_be_organized_without_changing_its_meaning"));
 return candidate;
}
export function tryFormatArgdown(engine: ArgdownEngine, source: string): string {try {return formatArgdown(engine, source);} catch {return source;}}
