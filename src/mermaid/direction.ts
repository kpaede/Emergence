import {t as tr} from '../i18n';
import {flowHeader} from './source';
import {moveToGroup} from './groups';
import type {FlowModel} from './types';

/** Links to the group itself preserve its direction; links from inside do not. */
export function hasOutsideConnection(model: FlowModel, group: string): boolean {
 const inside = new Set<string>(), visit = (id: string): void => {
  if (inside.has(id)) return; inside.add(id);
  for (const child of model.subgraphs.find(g => g.id === id)?.nodes ?? []) visit(child);
 };
 for (const id of model.subgraphs.find(g => g.id === group)?.nodes ?? []) visit(id);
 return model.edges.some(edge => inside.has(edge.start) !== inside.has(edge.end));
}
export function flowDirection(source: string, model: FlowModel, direction: string, group?: string): string {
 if (direction && !['TD', 'TB', 'BT', 'LR', 'RL'].includes(direction)) throw new Error(tr("labels.unknown_diagram_direction"));
 if (!group) {if (!direction) throw new Error(tr("mermaid.the_main_graph_needs_a_direction")); const header = flowHeader(source), keyword = /^\s*((?:flowchart|graph)(?:-elk)?)/u.exec(header.text)?.[1] ?? 'flowchart'; return source.slice(0, header.from) + keyword + ' ' + direction + '\n' + source.slice(header.to);}
 if (!model.subgraphs.some(g => g.id === group)) throw new Error(tr("mermaid.the_subgraph_no_longer_exists"));
 return moveToGroup(source, {...model, subgraphs: model.subgraphs.map(g => g.id === group ? {...g, dir: direction || undefined} : g)}, [], '');
}
