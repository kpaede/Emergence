import type {CompanionDocument} from './model';
import {markThoughts,stripThoughtIds,validateThoughts,thoughts} from './thoughts';
import type {CompanionSection} from './model';
import {parseCompanion} from './codec';
import {parseDocument} from 'yaml';

const sameText=(left:string,right:string)=>left.replace(/\r\n/gu,'\n')===right.replace(/\r\n/gu,'\n');
function retainUnambiguous(section:CompanionSection,before:CompanionSection):CompanionSection{
 const old=thoughts(before),nodes=thoughts(section),key=(node:typeof nodes[number])=>node.text,oldKeys=new Map<string,string[]>(),newCounts=new Map<string,number>();
 for(const node of old){const k=key(node),ids=oldKeys.get(k)??[];ids.push(node.id);oldKeys.set(k,ids);}for(const node of nodes)newCounts.set(key(node),(newCounts.get(key(node))??0)+1);
 const chunks:string[]=[];let offset=0;for(const node of nodes){const ids=oldKeys.get(key(node));if(ids?.length!==1||newCounts.get(key(node))!==1||ids[0]===node.id)continue;const marker=' <!-- em-note:'+node.id+' -->',start=section.raw.lastIndexOf(marker,node.lineTo);if(start<node.lineFrom)continue;chunks.push(section.raw.slice(offset,start),' <!-- em-note:'+ids[0]+' -->');offset=start+marker.length;}
 chunks.push(section.raw.slice(offset));return {...section,raw:chunks.join('')};
}
/** Identical bodies retain their references. Ambiguous external changes are never matched by position. */
export function sessionThoughts(document:CompanionDocument,previous?:CompanionDocument):CompanionDocument{
 const old=new Map(previous?.id===document.id?previous.sections.map(section=>[section.id,section]):[]);
 const projected={...document,sections:document.sections.map(section=>{
  const before=old.get(section.id);if(!before||before.format!==section.format||!sameText(stripThoughtIds(before),stripThoughtIds(section)))return {...section,plain:true,raw:stripThoughtIds(section)};
  return {...section,plain:before.plain,raw:before.raw.replace(/\r?\n/gu,document.newline)};
 })};
 const working=markThoughts(projected);validateThoughts(working);
 working.sections=working.sections.map(section=>{const before=old.get(section.id);return before&&!sameText(stripThoughtIds(before),stripThoughtIds(section))?retainUnambiguous(section,before):section;});validateThoughts(working);return working;
}
/** The stored originals are the actual bytes, independent of the working references. */
export function needsCompanionCleanup(document:CompanionDocument):boolean{
 for(const text of [document.original,...Object.values(document.fileOriginals??{})])if(text){const stored=parseCompanion(text),yaml=parseDocument(stored.header);if(yaml.has('emergence-companion-version'))return true;if(yaml.get('emergence-companion-role')==='index')continue;if(stored.sections.some(section=>stripThoughtIds(section)!==section.raw))return true;}
 return false;
}
