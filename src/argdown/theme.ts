import {isGroup, type ArgdownModel, type IMapNode} from './model';
/** Keep renderer colors intact; only identify elements for interactions and tests. */
export function themeArgdownNodes(root: ParentNode, _model: ArgdownModel, _nodes: ReadonlyMap<string, IMapNode>): void {for(const el of root.querySelectorAll('.node,.cluster')) el.classList.add('em-ad-theme-node');}
export function argdownNodeIds(model: ArgdownModel): Map<string, IMapNode> {
 const nodes = new Map(model.nodes.map(node => [node.id, node]));
 model.nodes.filter(isGroup).forEach((node, index) => {if (!node.isClosed) nodes.set('cluster_' + (index + 1), node);}); return nodes;
}
