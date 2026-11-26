import type {Thought} from './model';
import type {ThoughtIndex} from './board-model';
import {thoughts,sectionOutline,type Placement} from './thoughts';
import type {CompanionDrag} from './drag';
import type {CompanionDocument} from './model';
import {parseYaml} from 'obsidian';

export function readerSingleLine(header:string):boolean{
 try{const data=parseYaml(header) as Record<string,unknown>|null,value=data?.['excerpt-outline-mindmap'];return typeof value==='string'?/(?:^|;)nodeEditingMode:single-line(?:;|$)/u.test(value):!!value&&typeof value==='object'&&(value as Record<string,unknown>).nodeEditingMode==='single-line';}catch{return false;}
}

/** Read-only relationships over the common thought index, with no second tree. */
export function readerTarget(index:ThoughtIndex,id:string,key:string,visible?:ReadonlySet<string>):Thought|undefined {
 const children=(parent:string)=>(index.children.get(parent)??[]).filter(node=>!visible||visible.has(node.id));
 const node=index.byId.get(id);if(!node)return children('')[0];
 const siblings=children(node.parent??''),at=siblings.indexOf(node);
 switch(key){
  case 'ArrowUp':return siblings[at-1];
  case 'ArrowDown':return siblings[at+1];
  case 'ArrowLeft':return node.parent?index.byId.get(node.parent):undefined;
  case 'ArrowRight':return children(id)[0];
  case 'Home':return siblings[0];case 'End':return siblings.at(-1);
  default:return undefined;
 }
}
export function readerPreview(text:string,limit=100):string {
 const plain=text.replace(/^\[[ xX-]\]\s*/u,'').replace(/<!--[^]*?-->/gu,'').replace(/!?(?:\[([^\]]*)\])\([^)]*\)/gu,'$1').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/gu,(_all:string,target:string,label?:string)=>label??target).replace(/^[ \t]*[>#]+[ \t]*/gmu,'').replace(/[*`_]/gu,'').replace(/\s+/gu,' ').trim();
 return plain.length>limit?plain.slice(0,limit-1)+'…':plain;
}
const dropIndexes=new WeakMap<CompanionDocument,{nodes:Map<string,Thought>;duplicate:boolean;promotable:Map<string,boolean>}>();
/** Hover inspects immutable relationships. The write still revalidates through the operation engine. */
export function validReaderDrop(document:CompanionDocument,path:string,data:CompanionDrag,section:string,target:string|undefined,placement:Placement):boolean {
 if(data.path!==path||!data.id||!data.section||!Array.isArray(data.nodes??[]))return false;
 if(!['before','after','first','last'].includes(placement)||document.unavailableFiles?.[section])return false;
 let index=dropIndexes.get(document);if(!index){const nodes=new Map<string,Thought>();let duplicate=false;for(const item of document.sections)for(const node of thoughts(item)){if(nodes.has(node.id))duplicate=true;nodes.set(node.id,node);}index={nodes,duplicate,promotable:new Map()};dropIndexes.set(document,index);}
 const destination=document.sections.find(item=>item.id===section),sources=data.nodes??[data];if(index.duplicate||!destination||!sources.length)return false;
 const moved=new Set<string>();for(const source of sources){if(!source||typeof source.id!=='string'||typeof source.section!=='string')return false;const node=index.nodes.get(source.id);if(!node||node.section!==source.section||node.parent!==source.parent||document.unavailableFiles?.[source.section])return false;moved.add(node.id);}
 for(const id of moved){let parent=index.nodes.get(id)?.parent;while(parent){if(moved.has(parent))return false;parent=index.nodes.get(parent)?.parent;}}
 if(target){const node=index.nodes.get(target);if(!node||node.section!==section)return false;let ancestor:Thought|undefined=node;while(ancestor){if(moved.has(ancestor.id))return false;ancestor=ancestor.parent?index.nodes.get(ancestor.parent):undefined;}}
 for(const id of moved){const source=document.sections.find(item=>item.id===index.nodes.get(id)!.section)!;if(source.format===destination.format)continue;for(const item of [source,destination])if(item.format!==2){let allowed=index.promotable.get(item.id);if(allowed===undefined){try{sectionOutline(item,true);allowed=true;}catch{allowed=false;}index.promotable.set(item.id,allowed);}if(!allowed)return false;}}
 return true;
}
export function readerTask(text:string):{body:string;state:string|undefined} {
 const task=/^\[([ xX-])\][ \t]*/u.exec(text);return {body:task?text.slice(task[0].length):text,state:task?.[1]};
}
/** A view-only mask: checked ancestors stay in place when an open descendant needs them. */
export function readerVisibility(index:ThoughtIndex,hideCompleted:boolean):{visible:Set<string>;connectors:Set<string>} {
 const visible=new Set<string>(),connectors=new Set<string>();
 for(let i=index.nodes.length-1;i>=0;i--){
  const node=index.nodes[i]!,checked=readerTask(node.text).state?.toLowerCase()==='x',needed=(index.children.get(node.id)??[]).some(child=>visible.has(child.id));
  if(!hideCompleted||!checked||needed)visible.add(node.id);
  if(hideCompleted&&checked&&needed)connectors.add(node.id);
 }
 return {visible,connectors};
}
