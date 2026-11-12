import {t as tr} from '../i18n';
import {appendSource, flowHeader, quoted, statements} from './source';
import {isFlow, type FlowEdge, type FlowModel, type FlowNode, type Pele} from './types';
import {parents, sameMermaidValue} from './groups';
import type {LabelMode} from './labels';

export function editFlowNode(source: string, id: string, label?: string, shape?: string, mode: LabelMode = 'text'): string {
 const fields = [label !== undefined ? 'label: ' + quoted(label) : '', label !== undefined ? 'labelType: ' + quoted(mode === 'markdown' ? 'markdown' : 'string') : '', shape ? 'shape: ' + shape : ''].filter(Boolean);
 return appendSource(source, `${id}@{ ${fields.join(', ')} }`);
}
export function flowColor(source: string, ids: string[], property: string, color?: string): string {
 let next = source;
 for (const id of ids) {
  const existing = statements(next).filter(s => new RegExp('^style\\s+' + id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') + '\\s', 'u').test(s.text.trim()));
  const styles = existing.flatMap(s => s.text.trim().replace(/^style\s+\S+\s+/u, '').replace(/;$/u, '').split(/,(?![^()]*\))/u)).filter(v => !v.trim().startsWith(property + ':'));
  if (color) styles.push(property + ':' + color);
  for (const item of existing.reverse()) next = next.slice(0, item.from) + next.slice(item.to);
  if (styles.length) next = appendSource(next, `style ${id} ${styles.join(',')}`);
 }
 return next;
}
export function flowEdgeColor(source: string, model: FlowModel, indices: number[], property: string, color?: string): string {
 const selected = new Set(indices);
 let candidate = statements(source).map(statement => {
  const match = /^\s*linkStyle\s+([\d,]+)\s+([\s\S]*)/u.exec(statement.text); if (!match) return statement.text;
  const all = match[1]!.split(',').map(Number); if (!all.some(i => selected.has(i))) return statement.text;
  const keep = all.filter(i => !selected.has(i)); return keep.length ? 'linkStyle ' + keep.join(',') + ' ' + match[2]!.trim().replace(/;$/u, '') + '\n' : '';
 }).join('');
 for (const index of indices) {
  const edge = model.edges[index]; if (!edge) throw new Error(tr("argdown.the_connection_no_longer_exists"));
  const styles = (edge.style ?? []).filter(style => !style.trim().startsWith(property + ':')); if (color) styles.push(property + ':' + color);
  if (styles.length) candidate = appendSource(candidate, 'linkStyle ' + index + ' ' + styles.join(','));
 }
 return candidate;
}
export function edgeText(edge: FlowEdge): string {
 const stroke = edge.stroke === 'dotted' ? '-.' : edge.stroke === 'thick' ? '==' : edge.stroke === 'invisible' ? '~~' : '--';
 const tip = edge.type?.includes('circle') ? 'o' : edge.type?.includes('cross') ? 'x' : edge.type?.includes('point') ? '>' : edge.stroke === 'dotted' ? '-' : edge.stroke === 'thick' ? '=' : edge.stroke === 'invisible' ? '~' : '-';
 const start = edge.type?.startsWith('double_') ? tip === '>' ? '<' : tip : '';
 const line = start + stroke + (edge.stroke === 'dotted' ? '.'.repeat(Math.max(0, (edge.length ?? 1) - 1)) : stroke[0]!.repeat(Math.max(0, (edge.length ?? 1) - 1))) + (edge.stroke === 'dotted' && tip !== '-' ? '-' : '') + tip;
 const raw = edge.text.replace(/ﬂ°°([^¶]+)¶ß/gu, '#$1;'), label = edge.labelType === 'markdown' ? quoted('`' + raw + '`') : edge.labelType === 'string' ? quoted(raw) : raw;
 return edge.start + ' ' + (edge.isUserDefinedId ? edge.id + '@' : '') + line + (edge.text ? '|' + label + '|' : '') + ' ' + edge.end;
}
const legacyShapes: Record<string, string> = {square: 'rect', round: 'rounded', diamond: 'diam', circle: 'circle', stadium: 'stadium', subroutine: 'subroutine', cylinder: 'cyl', hexagon: 'hex', odd: 'odd', lean_right: 'lean-r', lean_left: 'lean-l', trapezoid: 'trap-b', inv_trapezoid: 'trap-t', doublecircle: 'dbl-circ'};
export const flowIds = (model: FlowModel): string[] => [...model.nodes.keys(), ...model.subgraphs.map(group => group.id), ...model.edges.flatMap(edge => edge.id ? [edge.id] : [])];
const nodeValue = (node: FlowNode): unknown => ({...node, type: legacyShapes[node.type ?? ''] ?? node.type});
const edgeValue = (edge: FlowEdge): unknown => ({...edge, id: edge.isUserDefinedId ? edge.id : undefined, labelType: edge.labelType === 'markdown' ? 'markdown' : 'text'});
function nodeText(node: FlowNode): string {
 if (!node.type && node.text === node.id && node.labelType === 'text' && !Object.keys(node.props ?? {}).length && !node.classes.length) return node.id;
 const metadata: Record<string, string> = {...node.props};
 if (node.type) metadata.shape = legacyShapes[node.type] ?? node.type;
 if (node.text !== undefined) {metadata.label = node.text; metadata.labelType = node.labelType;}
 return node.id + (Object.keys(metadata).length ? `@{ ${Object.entries(metadata).map(([key, value]) => key + ': ' + quoted(value)).join(', ')} }` : '') + (node.classes.length ? ':::' + node.classes.join(',') : '');
}
export function deleteFlowItems(source: string, model: FlowModel, pele: Pele, nodes: Set<string>, edges: Set<number>): string {
 const removeEdges = new Set([...edges, ...model.edges.flatMap((e, i) => nodes.has(e.start) || nodes.has(e.end) ? [i] : [])]);
 const indexMap = new Map<number, number>(); let nextIndex = 0;
 model.edges.forEach((_, i) => {if (!removeEdges.has(i)) indexMap.set(i, nextIndex++);});
 const header = flowHeader(source); let ordinal = 0;
 const chunks = statements(source).map(statement => {
  const text = statement.text.trim();
  if (statement.from < header.to || /^(?:subgraph|end|direction|%%)/u.test(text)) return statement.text;
  if (/^linkStyle\s+/u.test(text)) {
   const match = /^linkStyle\s+([\d,]+)\s+([\s\S]*)/u.exec(text);
   if (!match) return statement.text;
   const indices = match[1]!.split(',').flatMap(n => indexMap.has(Number(n)) ? [indexMap.get(Number(n))!] : []);
   return indices.length ? 'linkStyle ' + indices.join(',') + ' ' + match[2]!.replace(/;$/u, '') + '\n' : '';
  }
  if (/^(?:style|click)\s+/u.test(text)) return nodes.has(text.split(/\s+/u)[1] ?? '') ? '' : statement.text;
  if (/^class\s+/u.test(text)) {
   const match = /^class\s+(\S+)\s+([\s\S]*)/u.exec(text); if (!match) return statement.text;
   const ids = match[1]!.split(',').filter(id => !nodes.has(id)); return ids.length ? 'class ' + ids.join(',') + ' ' + match[2]!.replace(/;$/u, '') + '\n' : '';
  }
  let local; try {local = pele.parse('flowchart TD\n' + statement.text);} catch {return statement.text;}
  if (!isFlow(local)) return statement.text;
  const firstEdge = ordinal; ordinal += local.edges.length;
  if (![...local.nodes.keys()].some(id => nodes.has(id)) && !local.edges.some((_, i) => removeEdges.has(firstEdge + i))) return statement.text;
  const lines = [...local.nodes.values()].filter(n => !nodes.has(n.id)).map(nodeText);
  local.edges.forEach((_, i) => {if (!removeEdges.has(firstEdge + i)) lines.push(edgeText(model.edges[firstEdge + i]!));});
  return lines.join('\n') + '\n';
 });
 const candidate = chunks.join(''), after = pele.parse(candidate);
 if (!isFlow(after) || [...nodes].some(id => after.nodes.has(id))) throw new Error(tr("mermaid.the_selection_could_not_be_removed_without_losing_data_edit_the"));
 const expected = model.edges.filter((_, i) => !removeEdges.has(i));
 if (after.edges.length !== expected.length || expected.some((e, i) => {const a = after.edges[i]; return !a || a.start !== e.start || a.end !== e.end || a.text !== e.text || a.stroke !== e.stroke || a.type !== e.type || JSON.stringify(a.style) !== JSON.stringify(e.style);})) throw new Error(tr("mermaid.connections_or_their_styles_would_change_edit_the_source_instead"));
 for (const [i, edge] of expected.entries()) if (!sameMermaidValue(edgeValue(after.edges[i]!), edgeValue(edge))) throw new Error(tr("mermaid.connection_properties_would_be_lost_edit_the_source_instead"));
 for (const [id, node] of model.nodes) if (!nodes.has(id)) {const actual = after.nodes.get(id); if (!actual || !sameMermaidValue(nodeValue(actual), nodeValue(node))) throw new Error(tr("mermaid.node_properties_would_change_edit_the_source_instead"));}
 if (after.nodes.size !== model.nodes.size - nodes.size || !sameMermaidValue([...parents(model)].filter(([id]) => !nodes.has(id)).sort(), [...parents(after)].sort())) throw new Error(tr("mermaid.group_assignments_would_change_edit_the_source_instead"));
 return candidate;
}
/** Rewrite only the statement containing the edge; retain all other source verbatim.
 * Check the resulting model before committing, especially positional link styles.
 */
export function changeFlowEdge(source: string, model: FlowModel, pele: Pele, index: number, change?: Partial<FlowEdge>): string {
 const header = flowHeader(source); let ordinal = 0;
 for (const statement of statements(source)) {
  if (statement.from < header.to || /^(?:subgraph|end|direction|%%)/u.test(statement.text.trim())) continue;
  let local; try {local = pele.parse('flowchart TD\n' + statement.text);} catch {continue;}
  if (!isFlow(local) || !local.edges.length) continue;
  if (index >= ordinal + local.edges.length) {ordinal += local.edges.length; continue;}
  if (!change && model.edges.some(e => e.style?.length)) throw new Error(tr("mermaid.this_connection_has_position_dependent_styles_delete_it_in_the_source"));
  const lines = [...local.nodes.values()].map(nodeText);
  local.edges.forEach((edge, i) => {const original = model.edges[ordinal + i]!; if (ordinal + i !== index) lines.push(edgeText(original)); else if (change) lines.push(edgeText({...original, ...change}));});
  const candidate = source.slice(0, statement.from) + lines.join('\n') + '\n' + source.slice(statement.to);
  const after = pele.parse(candidate);
  if (!isFlow(after)) throw new Error(tr("mermaid.the_diagram_type_has_changed"));
  const expected = model.edges.filter((_, i) => !!change || i !== index);
  if (after.edges.length !== expected.length || expected.some((edge, i) => {
   const actual = after.edges[i]; return !actual || actual.start !== edge.start || actual.end !== edge.end || (i !== index || !change) && actual.text !== edge.text;
  })) throw new Error(tr("mermaid.the_connection_could_not_be_uniquely_changed_edit_the_source_instead"));
  for (const [i, edge] of expected.entries()) if (!sameMermaidValue(edgeValue(after.edges[i]!), edgeValue(i === index && change ? {...edge, ...change} : edge))) throw new Error(tr("mermaid.connection_properties_would_be_lost_edit_the_source_instead"));
  for (const [id, node] of model.nodes) {const actual = after.nodes.get(id); if (!actual || !sameMermaidValue(nodeValue(actual), nodeValue(node))) throw new Error(tr("mermaid.node_properties_would_change_edit_the_source_instead"));}
  if (!sameMermaidValue([...parents(model)].sort(), [...parents(after)].sort())) throw new Error(tr("mermaid.group_assignments_would_change_edit_the_source_instead"));
  return candidate;
 }
 throw new Error(tr("mermaid.this_connection_could_not_be_uniquely_matched_to_the_source"));
}
