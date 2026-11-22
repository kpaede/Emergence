import type {ThoughtOperation,Placement} from './thoughts';
export const COMPANION_DRAG='application/x-emergence-companion';
export interface DragNode {id:string;section:string;parent?:string}
export interface CompanionDrag extends DragNode {path:string;nodes?:DragNode[]}
export function dragOperations(data:CompanionDrag,section:string,target:string|undefined,placement:Placement):ThoughtOperation[]{
 const source=data.nodes??[data],nodes=source.filter((node,index)=>typeof node.id==='string'&&typeof node.section==='string'&&source.findIndex(other=>other.id===node.id)===index);
 if(placement==='after'||placement==='first')nodes.reverse();
 return nodes.map(node=>({kind:'move',id:node.id,section,target,placement,expectedSection:node.section,expectedParent:node.parent}));
}
