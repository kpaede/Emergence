import {t} from '../i18n';
import {parseDocument} from 'yaml';
import {thoughts} from './thoughts';
import type {CompanionSection} from './model';
import {markMultiline,stripMultilineIds,encodeOutlineText} from './multiline';

export const withoutThoughtIds=(raw:string):string=>raw.replace(/^(\t*- .*?) <!-- em-note:[a-zA-Z0-9-]+ -->(\r?)$/gmu,'$1$2');
export function splitProjection(text:string):{header:string;body:string}{const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);return match?{header:match[1]!,body:text.slice(match[0].length)}:{header:'',body:text};}
export function validateNativeProjection(text:string):void{
 const {header}=splitProjection(text);if(!header)return;const yaml=parseDocument(header);
 const version:unknown=yaml.errors.length?undefined:yaml.get('eome-outline-format');
 if(yaml.errors.length||yaml.has('eome-outline-format')&&version!==2&&version!=='2')throw new Error(t('companion.nativeFormatUnsupported'));
}
/** Legacy conversion follows the existing tree, rather than reinterpreting its indentation. */
export function sectionOutline(section:CompanionSection):string{
 if(section.format===2)return stripMultilineIds(section.raw);
 const nodes=thoughts(section),byOffset=new Map(nodes.map(n=>[n.from,n])),depth=new Map<string,number>();let offset=0;
 return section.raw.split(/(?<=\n)/u).map(line=>{const node=byOffset.get(offset);offset+=line.length;if(!node){if(line.trim())throw new Error(t('companion.nativeMigration'));return line;}const level=node.parent?(depth.get(node.parent)??0)+1:0;depth.set(node.id,level);return encodeOutlineText(node.text,'\t'.repeat(level))+(line.endsWith('\n')?'\n':'');}).join('');
}
export function projectionText(raw:string,header:string,format?:2):string{
 const body=format===2?stripMultilineIds(raw):withoutThoughtIds(raw);
 return projectionFromBody(body,header);
}
export function projectionFromBody(body:string,header:string):string{
 const options=header.replace(/^(?:eome-outline-format|["']eome-outline-format["']):[^\r\n]*(?:\r?\n|$)/gmu,'');
 return '---\neome-outline-format: 2\n'+(options?options.replace(/\n?$/u,'\n'):'')+'---\n'+body.replace(/^\r?\n/u,'');
}
export function nativeBodiesEqual(raw:string,text:string):boolean{const normalize=(value:string)=>value.replace(/\r\n/gu,'\n').replace(/^\n+|\n+$/gu,'');return normalize(withoutThoughtIds(raw))===normalize(splitProjection(text).body);}
/** Preserve whole Markdown bodies; companion identities occur only on structural start lines. */
export function mergeNativeOutline(section:CompanionSection,text:string):string{
 validateNativeProjection(text);
 const {body}=splitProjection(text);if(body.endsWith('...[truncated]'))throw new Error(t('companion.nativeOutlineOnly'));
 const oldNodes=thoughts(section);sectionOutline(section);const raw=markMultiline(body,false),next={...section,format:2 as const,raw},newNodes=thoughts(next),used=new Set<string>(),assigned=new Map<string,string>();
 const match=(key:(node:typeof oldNodes[number])=>string)=>{const old=new Map<string,typeof oldNodes>();for(const node of oldNodes)if(!used.has(node.id)){const value=key(node),list=old.get(value)??[];list.push(node);old.set(value,list);}for(const node of newNodes)if(!assigned.has(node.id)){const candidate=old.get(key(node))?.shift();if(candidate){used.add(candidate.id);assigned.set(node.id,candidate.id);}}};
 match(node=>JSON.stringify([node.text,node.indent]));match(node=>node.text);
 const before=oldNodes.filter(node=>!used.has(node.id)),after=newNodes.filter(node=>!assigned.has(node.id));if(before.length===after.length)for(let i=0;i<after.length;i++)assigned.set(after[i]!.id,before[i]!.id);
 const chunks:string[]=[];let offset=0;for(const node of newNodes){const id=node.id,replacement=assigned.get(id)??id,start=node.lineTo-` <!-- em-note:${id} -->`.length;chunks.push(raw.slice(offset,start),` <!-- em-note:${replacement} -->`);offset=node.lineTo;}chunks.push(raw.slice(offset));return chunks.join('');
}
