import {t as tr} from '../i18n';
import {flowHeader, quoted, statements} from './source';
import {isFlow, type FlowModel, type FlowNode, type Pele} from './types';
import {parents, sameMermaidValue} from './groups';
import {edgeText} from './flow-actions';

const brackets: Record<string, [string, string]> = {square: ['[', ']'], round: ['(', ')'], diamond: ['{', '}'], circle: ['((', '))'], stadium: ['([', '])'], subroutine: ['[[', ']]'], cylinder: ['[(', ')]'], hexagon: ['{{', '}}'], odd: ['>', ']'], lean_right: ['[/', '/]'], lean_left: ['[\\', '\\]'], trapezoid: ['[/', '\\]'], inv_trapezoid: ['[\\', '/]'], doublecircle: ['(((', ')))']};
const publicText = (text: string): string => text.replace(/ﬂ°°([^¶]+)¶ß/gu, '#$1;');
function textSource(text: string, kind: string): string {const value = publicText(text); return kind === 'markdown' ? quoted('`' + value + '`') : kind === 'text' && !/["\n]/u.test(value) ? value : quoted(value);}
function nodeSource(node: FlowNode): string {
 const pair = brackets[node.type ?? ''];
 const extra = node as unknown as Record<string, unknown>;
 if (pair && !['icon', 'form', 'pos', 'img', 'constraint', 'assetWidth', 'assetHeight'].some(key => extra[key] !== undefined) && !Object.keys(node.props ?? {}).length) return node.id + pair[0] + textSource(node.text ?? node.id, node.labelType) + pair[1];
 if (!node.type && (node.text === undefined || node.text === node.id)) return node.id;
 const properties: Record<string, unknown> = {...node.props}; if (node.type) properties.shape = node.type;
 if (node.text !== undefined) {properties.label = publicText(node.text); properties.labelType = node.labelType;}
 for (const key of ['icon', 'form', 'pos', 'img', 'constraint']) if (extra[key] !== undefined) properties[key] = extra[key];
 if (extra.assetWidth !== undefined) properties.w = extra.assetWidth; if (extra.assetHeight !== undefined) properties.h = extra.assetHeight;
 return node.id + '@{ ' + Object.entries(properties).map(([key, value]) => key + ': ' + (typeof value === 'number' ? value : quoted(String(value)))).join(', ') + ' }';
}
function classLines(source: string, model: FlowModel): string[] {
 const clicked = new Set(statements(source).flatMap(s => /^\s*click\s+(\S+)/u.exec(s.text)?.[1]?.split(',') ?? []));
 const result: string[] = [];
 const emit = (id: string, classes: string[]): void => {let skip = clicked.has(id); for (const cls of classes) {if (skip && cls === 'clickable') {skip = false; continue;} result.push(`  class ${id} ${cls}`);}};
 for (const node of model.nodes.values()) emit(node.id, node.classes);
 for (const group of model.subgraphs) if (!model.nodes.has(group.id)) emit(group.id, group.classes);
 for (const edge of model.edges) if (edge.id) emit(edge.id, edge.classes);
 return result;
}
/** Normalize visual edits only after proving the complete public model is preserved. */
export function formatFlow(source: string, model: FlowModel, pele: Pele): string {
 const header = flowHeader(source), groupIds = new Set(model.subgraphs.map(g => g.id)), ownership = parents(model), lines: string[] = [];
 const emit = (id: string, depth: number): void => {
  const group = model.subgraphs.find(g => g.id === id), pad = '  '.repeat(depth);
  if (!group) {const node = model.nodes.get(id); if (node) lines.push(pad + nodeSource(node)); return;}
  lines.push(`${pad}subgraph ${group.id} [${textSource(group.title, group.labelType)}]`);
  if (group.dir) lines.push(pad + '  direction ' + group.dir);
  for (const child of group.nodes) emit(child, depth + 1);
  lines.push(pad + 'end');
 };
 for (const id of [...model.nodes.keys(), ...groupIds]) if (!ownership.has(id) && !groupIds.has(id)) emit(id, 1);
 for (const group of model.subgraphs) if (!ownership.has(group.id)) emit(group.id, 1);
 const extras: string[] = [];
 for (const statement of statements(source.slice(header.to))) {
  const text = statement.text.trim(); if (!text || /^(?:subgraph\b|end\s*;?$|direction\b|class\s)/u.test(text)) continue;
  if (!/^(?:%%|style\b|classDef\b|linkStyle\b|click\b|accTitle\b|accDescr\b|interpolate\b)/u.test(text)) {
   try {const local = pele.parse('flowchart TD\n' + text); if (isFlow(local) && local.nodes.size > 0 && [...local.nodes.keys()].every(id => model.nodes.has(id) && !groupIds.has(id))) continue;} catch { /* Keep syntax that cannot be interpreted independently. */ }
  }
  extras.push(statement.text.trimEnd());
 }
 const edges = model.edges.map(edge => '  ' + edgeText(edge)), classes = classLines(source, model);
 const candidate = source.slice(0, header.to).trimEnd() + '\n' + [lines.join('\n'), edges.join('\n'), [...classes, ...extras].join('\n')].filter(Boolean).join('\n\n') + '\n';
 const after = pele.parse(candidate); if (!isFlow(after) || after.nodes.size !== model.nodes.size) throw new Error(tr("mermaid.nodes_could_not_be_reordered_without_losing_data"));
 for (const [id, node] of model.nodes) if (!sameMermaidValue(node, after.nodes.get(id))) throw new Error(tr("mermaid.node_properties_would_change"));
 if (!sameMermaidValue(model.edges, after.edges)) throw new Error(tr("mermaid.connections_would_change"));
 for (const group of model.subgraphs) if (!sameMermaidValue(group, after.subgraphs.find(g => g.id === group.id))) throw new Error(tr("mermaid.subgraph_properties_would_change"));
 const beforeRecord = model as unknown as Record<string, unknown>, afterRecord = after as unknown as Record<string, unknown>;
 for (const key of ['classes', 'tooltips']) {const a = beforeRecord[key], b = afterRecord[key]; if (a instanceof Map && b instanceof Map && !sameMermaidValue([...a], [...b])) throw new Error(tr("mermaid.classes_or_links_would_change"));}
 for (const key of ['direction', 'defaultEdgeStyle', 'defaultInterpolate', 'title', 'accTitle', 'accDescr']) if (!sameMermaidValue(beforeRecord[key], afterRecord[key])) throw new Error(tr("mermaid.diagram_properties_would_change"));
 return candidate;
}
export function tryFormatFlow(source: string, model: FlowModel, pele: Pele): string {try {return formatFlow(source, model, pele);} catch {return source;}}
