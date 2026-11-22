import type {Thought} from './model';
import type {ThoughtIndex} from './board-model';
import {applyThought,type Placement} from './thoughts';
import {dragOperations,type CompanionDrag} from './drag';
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
/** Validate the complete batch, including cycles, through the shared operation engine. */
export function validReaderDrop(document:CompanionDocument,path:string,data:CompanionDrag,section:string,target:string|undefined,placement:Placement):boolean {
 if(data.path!==path||!data.id||!data.section||!Array.isArray(data.nodes??[]))return false;
 try{const operations=dragOperations(data,section,target,placement);if(!operations.length)return false;for(const operation of operations)document=applyThought(document,operation).document;return true;}catch{return false;}
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
