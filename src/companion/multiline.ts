/*! EOME v2 continuation grammar adapted from Excerpt Outline Mindmap Editor 0.2.4.
 * Copyright (c) 2025 Kornelius Paede. MIT; third-party/companion-outline-LICENSE.txt. */
import {t} from '../i18n';
import {newId} from './model';

export interface OutlineItem {
 id?:string;text:string;indent:string;from:number;lineTo:number;ownTo:number;to:number;parent?:OutlineItem;
}
const ID=/ <!-- em-note:([a-zA-Z0-9-]+) -->$/u;
/** Content prefixes are consumed before testing any Markdown syntax inside them. */
export function multilineOutline(raw:string,identities=true):OutlineItem[]{
 if(/\r(?!\n)/u.test(raw))throw new Error(t('companion.nativeOutlineOnly'));
 const nodes:OutlineItem[]=[],stack:OutlineItem[]=[];let current:OutlineItem|undefined,offset=0;
 for(const line of raw.split(/(?<=\n)/u)){
  const row=line.replace(/\r?\n$/u,'');
  if(current&&row.startsWith(current.indent+'  ')){
   current.text+='\n'+row.slice(current.indent.length+2);current.ownTo=offset+line.length;
  }else{
   current=undefined;const match=/^(\t*)- (.*)$/u.exec(row);
   if(match){
    const indent=match[1]!,depth=indent.length;while(stack.length>depth)stack.pop();
    if(depth>stack.length)throw new Error(t('companion.nativeOutlineOnly'));
    const marked=identities?ID.exec(match[2]!):null;
    current={id:marked?.[1],text:marked?match[2]!.slice(0,marked.index):match[2]!,indent,from:offset,lineTo:offset+row.length,ownTo:offset+line.length,to:offset+line.length,parent:stack.at(-1)};
    nodes.push(current);stack.push(current);
   }else if(row.trim())throw new Error(t('companion.nativeOutlineOnly'));
   else stack.length=0;
  }
  offset+=line.length;
 }
 for(let i=nodes.length-1;i>=0;i--){const node=nodes[i]!;node.to=Math.max(node.to,node.ownTo);if(node.parent)node.parent.to=Math.max(node.parent.to,node.to);}
 return nodes;
}
export function markMultiline(raw:string,preserve=true):string{
 const chunks:string[]=[];let offset=0;
 for(const node of multilineOutline(raw,preserve))if(!node.id){chunks.push(raw.slice(offset,node.lineTo),` <!-- em-note:${newId()} -->`);offset=node.lineTo;}
 chunks.push(raw.slice(offset));return chunks.join('');
}
export function stripMultilineIds(raw:string):string{
 const chunks:string[]=[];let offset=0;
 for(const node of multilineOutline(raw))if(node.id){const start=node.lineTo-` <!-- em-note:${node.id} -->`.length;chunks.push(raw.slice(offset,start));offset=node.lineTo;}
 chunks.push(raw.slice(offset));return chunks.join('');
}
export function encodeOutlineText(text:string,indent=''):string{
 const lines=text.replace(/\r\n/gu,'\n').split('\n');
 if(/\r/u.test(lines.join('\n')))throw new Error(t('companion.nativeOutlineOnly'));
 return indent+'- '+lines.map((line,i)=>i?indent+'  '+line:line).join('\n');
}
