import {indentColumns as width,subtreeEnd,reindentSubtree,childIndent} from './indentation';
import {t} from '../i18n';
import {newId,type CompanionDocument,type CompanionSection,type Thought} from './model';
import {multilineOutline,markMultiline,encodeOutlineText} from './multiline';
const NODE=/^(\s*)([-+*]|\d+[.)])[ \t]+(.*?)(?: <!-- em-note:([a-zA-Z0-9-]+) -->)?[ \t]*$/u;
function outlineLines(raw:string):{line:string;row:string;from:number;match:RegExpExecArray|null}[]{
 let from=0,fence='',comment=false;
 return raw.split(/(?<=\n)/u).map(line=>{
  const row=line.replace(/\r?\n$/u,''),mark=/^[ \t]*(`{3,}|~{3,})(.*)$/u.exec(row);let match:RegExpExecArray|null=null;
  if(comment){if(row.includes('-->'))comment=false;}
  else if(/^[ \t]*<!--/u.test(row))comment=!row.includes('-->');
  else if(fence){if(mark&&mark[1]![0]===fence[0]&&mark[1]!.length>=fence.length&&!mark[2]!.trim())fence='';}
  else if(mark)fence=mark[1]!;
  else match=NODE.exec(row);
  const result={line,row,from,match};from+=line.length;return result;
 });
}
export function thoughts(section:CompanionSection):Thought[]{
 if(section.format===2)return multilineOutline(section.raw).map(node=>{if(!node.id)throw new Error(t('companion.unmarked'));return {id:node.id,section:section.id,from:node.from,to:node.to,lineFrom:node.from,lineTo:node.lineTo,indent:node.indent,text:node.text,marker:'-',parent:node.parent?.id};});
 const list:Thought[]=[],stack:Thought[]=[];
 for(const {line,row,from,match}of outlineLines(section.raw)){
  if(match){const indent=match[1]!,id=match[4];if(!id)throw new Error(t('companion.unmarked'));while(stack.length&&width(stack[stack.length-1]!.indent)>=width(indent))stack.pop();const node:Thought={id,section:section.id,from,to:from+line.length,lineFrom:from,lineTo:from+row.length,indent,text:match[3]!,marker:match[2]!,parent:stack[stack.length-1]?.id};list.push(node);stack.push(node);}
 }
 for(const node of list)node.to=subtreeEnd(section.raw,node.from,node.indent);
 return list;
}
export function validateThoughts(document:CompanionDocument):void{const seen=new Set<string>();for(const section of document.sections)for(const node of thoughts(section)){if(seen.has(node.id))throw new Error(t('companion.duplicate'));seen.add(node.id);}}
export function markThoughts(document:CompanionDocument):CompanionDocument{
 return {...document,sections:document.sections.map(section=>({...section,raw:section.format===2?markMultiline(section.raw):outlineLines(section.raw).map(({line,row,match})=>{return match&&!match[4]?row+` <!-- em-note:${newId()} -->`+(line.endsWith('\n')?document.newline:''):line;}).join('')}))};
}
export type Placement='before'|'after'|'first'|'last';
export type ThoughtOperation=
 |{kind:'edit';id:string;expected:string;text:string}
 |{kind:'add';section:string;target?:string;placement:Placement;text:string;id?:string}
 |{kind:'remove';id:string;expected:string}
 |{kind:'move';id:string;section:string;target?:string;placement:Placement;expectedParent?:string;expectedSection:string};
export interface OperationResult {document:CompanionDocument;inverse?:ThoughtOperation;restore?:{section:string;target?:string;placement:Placement;raw:string;id:string};removed?:string}
export function locate(document:CompanionDocument,id:string):{section:CompanionSection;node:Thought}{for(const section of document.sections){const node=thoughts(section).find(n=>n.id===id);if(node)return {section,node};}throw new Error(t('companion.targetMissing'));}
export function applyThought(document:CompanionDocument,operation:ThoughtOperation):OperationResult{
 if('section'in operation&&document.unavailableFiles?.[operation.section]||operation.kind==='move'&&document.unavailableFiles?.[operation.expectedSection])throw new Error(t('companion.sectionFileMissing'));
 validateThoughts(document);const next=structuredClone(document),nl=next.newline;
 if(operation.kind==='edit'){
  const {section,node}=locate(next,operation.id);if(node.text!==operation.expected)throw new Error(t('companion.conflict'));
  if(section.format!==2&&(/[\r\n]/u.test(operation.text)||/<!--\s*em-(?:note|section):/u.test(operation.text)))throw new Error(t('companion.oneLine'));
  if(section.format===2){const outline=multilineOutline(section.raw).find(n=>n.id===node.id)!,lines=encodeOutlineText(operation.text,node.indent).split('\n');lines[0]+=` <!-- em-note:${node.id} -->`;section.raw=section.raw.slice(0,node.from)+lines.join(nl)+(section.raw.slice(node.from,outline.ownTo).endsWith('\n')?nl:'')+section.raw.slice(outline.ownTo);return {document:next,inverse:{kind:'edit',id:node.id,expected:operation.text,text:node.text}};}
  const line=`${node.indent}${node.marker} ${operation.text} <!-- em-note:${node.id} -->`;
  section.raw=section.raw.slice(0,node.lineFrom)+line+section.raw.slice(node.lineTo);
  return {document:next,inverse:{kind:'edit',id:node.id,expected:operation.text,text:node.text}};
 }
 if(operation.kind==='remove'){
  const {section,node}=locate(next,operation.id),raw=section.raw.slice(node.from,node.to);if(raw!==operation.expected)throw new Error(t('companion.conflict'));
  const sibling=thoughts(section).find(n=>n.from>=node.to&&n.parent===node.parent),placement:Placement=sibling?'before':node.parent?'last':'last';
  section.raw=section.raw.slice(0,node.from)+section.raw.slice(node.to);
  return {document:next,restore:{section:section.id,target:sibling?.id??node.parent,placement,raw,id:node.id},removed:node.id};
 }
 let moved:string|undefined,original:{section:string;parent?:string;next?:string}|undefined;
 if(operation.kind==='move'){
  const {section,node}=locate(next,operation.id);
  if(node.section!==operation.expectedSection||node.parent!==operation.expectedParent)throw new Error(t('companion.conflict'));
  if(operation.target){const target=locate(next,operation.target);if(target.section.id===section.id&&target.node.from>=node.from&&target.node.from<node.to)throw new Error(t('companion.cycle'));}
  const sibling=thoughts(section).find(n=>n.from>=node.to&&n.parent===node.parent);original={section:section.id,parent:node.parent,next:sibling?.id};moved=section.raw.slice(node.from,node.to);section.raw=section.raw.slice(0,node.from)+section.raw.slice(node.to);
 }
 const section=next.sections.find(s=>s.id===operation.section);if(!section)throw new Error(t('companion.targetMissing'));
 let position=operation.placement==='first'?0:section.raw.length,indent='';
 if(operation.target){const found=locate(next,operation.target);if(found.section.id!==section.id)throw new Error(t('companion.targetMissing'));const target=found.node;
  position=operation.placement==='before'?target.from:operation.placement==='after'||operation.placement==='last'?target.to:section.format===2?multilineOutline(section.raw).find(n=>n.id===target.id)!.ownTo:target.lineTo+(section.raw.slice(target.lineTo).startsWith('\r\n')?2:1);
  indent=operation.placement==='first'||operation.placement==='last'?childIndent(target.indent):target.indent;
 }
 let id:string,insert:string;
 if(operation.kind==='add'){
  if(section.format!==2&&(/[\r\n]/u.test(operation.text)||/<!--\s*em-(?:note|section):/u.test(operation.text)))throw new Error(t('companion.oneLine'));
  id=operation.id??newId();if(section.format===2){const lines=encodeOutlineText(operation.text,indent).split('\n');lines[0]+=` <!-- em-note:${id} -->`;insert=lines.join(nl)+nl;}else insert=`${indent}- ${operation.text} <!-- em-note:${id} -->${nl}`;
 }else{
  id=operation.id;const rows=moved!.split(/(?<=\n)/u),base=/^[ \t]*/u.exec(rows[0]??'')![0];
  insert=section.format===2?moved!.split(/(?<=\n)/u).map(line=>indent+line.slice(base.length)).join(''):reindentSubtree(moved!,base,indent);if(!insert.endsWith('\n'))insert+=nl;
 }
 const prefix=section.raw.slice(0,position),suffix=section.raw.slice(position);section.raw=prefix+(prefix&&!prefix.endsWith('\n')?nl:'')+insert+suffix;
 if(operation.kind==='add'){const added=locate(next,id);return {document:next,inverse:{kind:'remove',id,expected:added.section.raw.slice(added.node.from,added.node.to)}};}
 const node=locate(next,id).node;
 return {document:next,inverse:{kind:'move',id,expectedParent:node.parent,expectedSection:section.id,section:original!.section,target:original!.next??original!.parent,placement:original!.next?'before':'last'}};
}
export function restoreThought(document:CompanionDocument,restore:NonNullable<OperationResult['restore']>):OperationResult{
 try{locate(document,restore.id);throw new Error(t('companion.conflict'));}catch(error){if(error instanceof Error&&error.message!==t('companion.targetMissing'))throw error;}
 const first=NODE.exec(restore.raw.split(/\r?\n/u)[0]??'');if(!first)throw new Error(t('companion.invalid'));
 const result=applyThought(document,{kind:'add',section:restore.section,target:restore.target,placement:restore.placement,text:first[3]!,id:restore.id});
 const found=locate(result.document,restore.id),base=first[1]!,indent=found.node.indent;
 const raw=reindentSubtree(restore.raw,base,indent);
 found.section.raw=found.section.raw.slice(0,found.node.from)+raw+found.section.raw.slice(found.node.to);
 return {document:result.document,inverse:{kind:'remove',id:restore.id,expected:raw}};
}
