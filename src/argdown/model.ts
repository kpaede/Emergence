import {projectedRelationRules} from './projected-relations';
import type {IAstNode, IMapNode, IMapEdge, IRuleNode, ITokenNode, IArgdownResponse, IGroupMapNode, IArgdownRequest, IStatement} from '@argdown/core';
export type {IMapNode, IMapEdge, IRuleNode, IAstNode};
export interface ArgdownModel {request: IArgdownRequest; response: IArgdownResponse; nodes: IMapNode[]; edges: IMapEdge[]; rules: IRuleNode[]; source: string; canonical?: Map<string, IStatement | undefined>}
export interface SourceSpan {from: number; to: number}
export const nodeKey = (node: IMapNode): string => String(node.type) === 'group-map-node' && node.id.startsWith('derivation:') ? 'd:' + node.id.slice(11) : (String(node.type) === 'argument-map-node' ? 'a:' : String(node.type) === 'group-map-node' ? 'g:' : 's:') + (String(node.type) === 'group-map-node' ? node.id : node.title ?? '');
export const edgeKey = (edge: IMapEdge): string => 'e:' + JSON.stringify([nodeKey(edge.from), nodeKey(edge.to), edge.relationType]);
export function leaves(node: IAstNode): IAstNode[] {return ('children' in node) ? (node.children ?? []).flatMap(leaves) : [node];}
export function span(node: IAstNode): SourceSpan | undefined {
 const tokens = leaves(node).filter((token): token is ITokenNode => 'tokenType' in token).filter(t => t.image && Number.isFinite(t.startOffset) && Number.isFinite(t.endOffset));
 if (!tokens.length) return undefined;
 return {from: Math.min(...tokens.map(t => t.startOffset)), to: Math.max(...tokens.map(t => t.endOffset! + 1))};
}
export function rulesOf(node?: IAstNode): IRuleNode[] {return node && ('children' in node) ? [node, ...(node.children ?? []).flatMap(child => rulesOf(child))] : [];}
export const isGroup = (node: IMapNode): node is IGroupMapNode => String(node.type) === 'group-map-node';
export function flatNodes(nodes: IMapNode[]): IMapNode[] {return nodes.flatMap(node => [node, ...(isGroup(node) ? flatNodes(node.children ?? []) : [])]);}
interface SourceOccurrence {key: string; range: SourceSpan; priority: number}
const sourceMaps = new WeakMap<ArgdownModel, SourceOccurrence[]>();
function sourceMap(model: ArgdownModel): SourceOccurrence[] {
 const cached = sourceMaps.get(model); if (cached) return cached;
 const entries: SourceOccurrence[] = [], projection = model.response.emergenceDerivation, visible = new Set([...model.nodes.map(nodeKey), ...model.edges.map(edgeKey)]);
 const add = (key: string | undefined, range: SourceSpan | undefined, priority: number): void => {if (key && range && visible.has(key)) entries.push({key, range, priority});};
 const head = (rule: IRuleNode): SourceSpan | undefined => span({...rule, children: rule.children?.filter(child => !('name' in child) || String(child.name) !== 'relations')});
 const ownerKey = (title: string): string | undefined => visible.has('d:' + title) ? 'd:' + title : visible.has('a:' + title) && !projection?.inferences.has('a:' + title) ? 'a:' + title : [...(projection?.inferences ?? [])].filter(([,role]) => role.argument === title).pop()?.[0];
 for (const rule of model.rules) {
  if (String(rule.name) === 'statement' && rule.statement?.title) {const key = 's:' + rule.statement.title; add(key, head(rule), model.canonical?.get(key) === rule.statement ? 115 : 105);}
  if (String(rule.name) === 'argument' && rule.argument?.title) {const key = ownerKey(rule.argument.title); add(key, head(rule), model.canonical?.get('a:' + rule.argument.title) === rule.statement ? 90 : 80);}
  if (String(rule.name) !== 'pcs' || !rule.argument?.title) continue;
  const title = rule.argument.title, children = rulesOf(rule), statements = children.filter(child => String(child.name) === 'pcsStatement');
  add(ownerKey(title), span(rule), 10);
  statements.forEach((statement, index) => {
   const position = span(statement); if (!position) return;
   if (projection?.expanded.has(title)) add('s:' + statement.statement?.title, position, 120);
   for (const [key, role] of projection?.inferences ?? []) if (role.argument === title && role.conclusion === index) {const inference = children.filter(child => String(child.name) === 'inference' && (span(child)?.to ?? Infinity) <= position.from).pop(); add(key, inference ? span(inference) : position, 130);}
  });
 }
 for (const node of model.nodes) if (isGroup(node) && node.section?.heading) add(nodeKey(node), span(node.section.heading), 120);
 for (const edge of model.edges) {
  const key = edgeKey(edge), occurrences = projection ? projectedRelationRules(model, key) : (model.response.relations ?? []).filter(relation => relation.from?.title === edge.from.title && relation.to?.title === edge.to.title && relation.relationType === edge.relationType).flatMap(relation => relation.occurrences);
  for (const occurrence of occurrences) {const token = occurrence.children?.find(child => 'tokenType' in child), range = token ? span(token) : undefined; if (range) {const raw = model.source.slice(range.from, range.to), trim = raw.search(/\S/u); add(key, {from: range.from + Math.max(0, trim), to: range.to}, 200);}}
 }
 sourceMaps.set(model, entries); return entries;
}
export function sourceRanges(model: ArgdownModel, keys: ReadonlySet<string>): SourceSpan[] {
 const matches = sourceMap(model).filter(entry => keys.has(entry.key)).sort((a,b) => b.priority - a.priority || a.range.from - b.range.from);
 return [...new Map(matches.map(entry => [entry.range.from + ':' + entry.range.to, entry.range])).values()];
}
export function keysAt(model: ArgdownModel, position: number): string[] {
 const from = model.source.lastIndexOf('\n', Math.max(0, position - 1)) + 1, newline = model.source.indexOf('\n', position), to = newline < 0 ? model.source.length : newline;
 const entries = sourceMap(model), exact = entries.filter(entry => position >= entry.range.from && position < entry.range.to);
 const matches = exact.length ? exact : entries.filter(entry => entry.priority < 200 && entry.range.from <= to && entry.range.to > from);
 matches.sort((a,b) => b.priority - a.priority || (a.range.to - a.range.from) - (b.range.to - b.range.from));
 return matches[0] ? [matches[0].key] : [];
}
