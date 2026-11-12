import {t as tr} from '../i18n';
import {ArgdownTypes, type IArgdownPlugin, type IMapNode, type IGroupMapNode, type ISection} from '@argdown/core';
import {isGroup, nodeKey} from './model';
/** Graphviz draws the labeled boundaries; shared statements stay outside either owner. */
export const derivationBoundaries: IArgdownPlugin = {name: 'EmergenceDerivationBoundaries', run: (_request, response) => {
 const projection = response.emergenceDerivation; if (!projection || projection.focus || !response.map) return response;
 const statementOwner = (key: string): string | undefined => {const owners = new Set(projection.statements.get(key)?.map(role => role.argument)); return owners.size === 1 ? [...owners][0] : undefined;};
 const wrap = (nodes: IMapNode[]): IMapNode[] => {
  for (const node of nodes) if (isGroup(node)) node.children = wrap(node.children ?? []);
  const result: IMapNode[] = [], done = new Set<string>();
  for (const node of nodes) {
   if (done.has(node.id)) continue;
   const owner = projection.inferences.get(nodeKey(node))?.argument;
   if (!owner) {const owner = statementOwner(nodeKey(node)); if (owner && nodes.some(other => projection.inferences.get(nodeKey(other))?.argument === owner)) continue; result.push(node); continue;}
   const children = nodes.filter(other => projection.inferences.get(nodeKey(other))?.argument === owner || statementOwner(nodeKey(other)) === owner);
   for (const child of children) done.add(child.id);
   const id = 'derivation:' + owner, section: ISection = {id, title: tr("argdown.reconstruction", {value1: owner}), type: ArgdownTypes.SECTION, level: 1, children: []};
   (response.sections ??= []).push(section);
   const group: IGroupMapNode = {id, title: section.title, labelTitle: section.title, type: ArgdownTypes.GROUP_MAP_NODE, level: 1, section, children}; result.push(group);
  }
  return result;
 };
 response.map.nodes = wrap(response.map.nodes); return response;
}};
