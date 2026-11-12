import {t as tr} from '../i18n';
import {flowHeader, quoted, statements} from './source';
import {isFlow, type FlowModel, type Pele} from './types';

function semanticValue(value: unknown): unknown {
 if (Array.isArray(value)) return value.map(semanticValue);
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, semanticValue(entry)]));
 return value;
}
export const sameMermaidValue = (a: unknown, b: unknown): boolean => JSON.stringify(semanticValue(a)) === JSON.stringify(semanticValue(b));

export function parents(model: FlowModel): Map<string, string> {
 const result = new Map<string, string>();
 for (const group of model.subgraphs) for (const id of group.nodes) {
  if (result.has(id) && result.get(id) !== group.id) throw new Error(tr("mermaid.group_membership_is_ambiguous"));
  result.set(id, group.id);
 }
 return result;
}
export function rootSelection(model: FlowModel, selection: Iterable<string>): string[] {
 const selected = new Set(selection), parent = parents(model);
 return [...selected].filter(id => {let p = parent.get(id); const seen = new Set<string>(); while (p) {if (selected.has(p)) return false; if (seen.has(p)) throw new Error(tr("labels.cyclic_subgraph_hierarchy")); seen.add(p); p = parent.get(p);} return true;});
}
export function validGroupTarget(model: FlowModel, selection: Iterable<string>, target: string): boolean {
 const selected = new Set(rootSelection(model, selection)), parent = parents(model), seen = new Set<string>();
 let id: string | undefined = target;
 while (id) {if (selected.has(id) || seen.has(id)) return false; seen.add(id); id = parent.get(id);}
 return !target || model.subgraphs.some(g => g.id === target);
}
/** Keep all original node, edge, style and opaque statements, in their original order.
 * Emit ownership first, then the original statements at the root. This avoids changing
 * ownership implicitly through endpoints in compact edge chains, and keeps linkStyle indices.
 */
export function moveToGroup(source: string, model: FlowModel, selection: Iterable<string>, target: string,
 create?: {id: string; title: string; parent?: string}, dissolve?: string): string {
 const chosen = rootSelection(model, selection), parent = parents(model);
 const groups = model.subgraphs.filter(g => g.id !== dissolve).map(g => ({...g, nodes: [...g.nodes]}));
 const ids = new Set([...model.nodes.keys(), ...groups.map(g => g.id)]);
 if (create) {
  if (ids.has(create.id) || model.edges.some(edge => edge.id === create.id)) throw new Error(tr("mermaid.the_subgraph_id_is_already_in_use"));
  if (create.parent && !groups.some(g => g.id === create.parent)) throw new Error(tr("mermaid.the_target_group_no_longer_exists"));
  if (create.parent && !validGroupTarget(model, chosen, create.parent)) throw new Error(tr("mermaid.the_new_group_would_create_cyclic_nesting"));
  groups.push({id: create.id, title: create.title, nodes: [], classes: [], labelType: 'string'});
  if (create.parent) parent.set(create.id, create.parent);
  target = create.id;
 } else if (!validGroupTarget(model, chosen, target)) throw new Error(tr("mermaid.a_subgraph_cannot_be_moved_into_itself_or_a_subgroup"));
 for (const id of chosen) {
  if (!ids.has(id)) throw new Error(tr("mermaid.the_selection_contains_an_unknown_element"));
  if (target) parent.set(id, target); else parent.delete(id);
 }
 if (dissolve) {
  const enclosing = parent.get(dissolve); parent.delete(dissolve);
  for (const [id, p] of parent) if (p === dissolve) {if (enclosing) parent.set(id, enclosing); else parent.delete(id);}
 }
 const groupIds = new Set(groups.map(g => g.id)), skeleton: string[] = [], active = new Set<string>();
 const emit = (id: string, depth: number): void => {
  const pad = '  '.repeat(depth), group = groups.find(g => g.id === id);
  if (!group) {skeleton.push(pad + id); return;}
  if (active.has(id)) throw new Error(tr("labels.cyclic_subgraph_hierarchy")); active.add(id);
  skeleton.push(`${pad}subgraph ${id} [${quoted(group.labelType === 'markdown' ? '`' + group.title + '`' : group.title)}]`);
  if (group.dir) skeleton.push(pad + '  direction ' + group.dir);
  for (const child of new Set([...model.nodes.keys(), ...groupIds])) if (parent.get(child) === id) emit(child, depth + 1);
  skeleton.push(pad + 'end'); active.delete(id);
 };
 for (const id of new Set([...model.nodes.keys(), ...groupIds])) if (!parent.has(id) && id !== dissolve) emit(id, 1);
 const header = flowHeader(source); let nesting = 0;
 const body = statements(source.slice(header.to)).filter(s => {
  const text = s.text.trim();
  if (/^subgraph\b/u.test(text)) {nesting++; return false;}
  if (/^end\s*;?$/u.test(text)) {nesting--; return false;}
  if (model.nodes.has(text.replace(/;$/u, '')) && !groupIds.has(text.replace(/;$/u, ''))) return false;
  return !(nesting > 0 && /^direction\s+(?:TB|TD|BT|LR|RL)\b/u.test(text));
 }).map(s => s.text).join('');
 return source.slice(0, header.to).trimEnd() + '\n' + skeleton.join('\n') + '\n' + body;
}
export function assertGroupRewrite(pele: Pele, before: FlowModel, candidate: string, expected?: Map<string, string>): FlowModel {
 const after = pele.parse(candidate);
 if (!isFlow(after)) throw new Error(tr("mermaid.the_diagram_type_has_changed_2"));
 for (const [id, node] of before.nodes) if (!sameMermaidValue(after.nodes.get(id), node)) throw new Error(tr("mermaid.properties_of_would_change_action_cancelled", {value1: id}));
 if (after.nodes.size !== before.nodes.size) throw new Error(tr("mermaid.the_number_of_nodes_would_change"));
 if (!sameMermaidValue(before.edges, after.edges)) throw new Error(tr("mermaid.connections_would_change_action_cancelled"));
 if (expected) {const actual = parents(after); for (const id of new Set([...expected.keys(), ...actual.keys()])) if (expected.get(id) !== actual.get(id)) throw new Error(tr("mermaid.the_group_assignment_could_not_be_preserved"));}
 pele.render(candidate); return after;
}
