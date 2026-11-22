import type {CompanionSection} from './model';
import {thoughts} from './thoughts';
import type {NativeKind,NativeView} from './native-types';
import type {LineageDocument} from './lineage-adapter';

function lineageIds(document:LineageDocument|undefined):string[]{
 if(!document?.columns)return [];const children=new Map<string,string[]>();
 for(let depth=0;depth<document.columns.length;depth++)for(const group of document.columns[depth]!.groups)children.set(depth?group.parentId:'',[...(children.get(depth?group.parentId:'')??[]),...group.nodes]);
 const ids:string[]=[],pending=[...(children.get('')??[])].reverse(),seen=new Set<string>();while(pending.length){const id=pending.pop()!;if(seen.has(id))return [];seen.add(id);ids.push(id);pending.push(...[...(children.get(id)??[])].reverse());}return ids;
}
/** Translate original-view selection at the boundary; companion IDs stay authoritative. */
export function nativeSelection(view:NativeView,kind:NativeKind,section:CompanionSection,id?:string):string|undefined{
 const nodes=thoughts(section);
 if(kind==='eome'){
  const flat=view.getFlatNodes?.().filter(node=>!node.isHeading).sort((a,b)=>a.line-b.line);if(!flat||flat.length!==nodes.length)return;
  if(id!==undefined){const at=nodes.findIndex(node=>node.id===id);if(at>=0)view.selectNode?.(flat[at]!.line);return id;}
  const line=view.selectedNodeLines?.values().next().value;return nodes[flat.findIndex(node=>node.line===line)]?.id;
 }
 const document=view.documentStore?.getValue().document as LineageDocument|undefined,ids=lineageIds(document);if(ids.length!==nodes.length)return;
 if(id!==undefined){const at=nodes.findIndex(node=>node.id===id);if(at>=0)view.viewStore?.dispatch({type:'view/set-active-node/document',payload:{id:ids[at]}});return id;}
 const selection=view.viewStore?.getValue().document as {activeNode?:string}|undefined;return nodes[ids.indexOf(selection?.activeNode??'')]?.id;
}
