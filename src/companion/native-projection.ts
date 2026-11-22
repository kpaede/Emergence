import {t} from '../i18n';
import {parseDocument} from 'yaml';
import {thoughts,sectionOutline} from './thoughts';
export {sectionOutline} from './thoughts';
import type {CompanionSection} from './model';
import {markMultiline,stripMultilineIds} from './multiline';

export const withoutThoughtIds=(raw:string):string=>raw.replace(/^(\t*- .*?) <!-- em-note:[a-zA-Z0-9-]+ -->(\r?)$/gmu,'$1$2');
export function splitProjection(text:string):{header:string;body:string}{const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);return match?{header:match[1]!,body:text.slice(match[0].length)}:{header:'',body:text};}
export function validateNativeProjection(text:string):void{
 const {header}=splitProjection(text);if(!header)return;const yaml=parseDocument(header);
 const version:unknown=yaml.errors.length?undefined:yaml.get('eome-outline-format');
 if(yaml.errors.length||yaml.has('eome-outline-format')&&version!==2&&version!=='2')throw new Error(t('companion.nativeFormatUnsupported'));
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
 const oldNodes=thoughts(section);sectionOutline(section);const raw=markMultiline(body,false),next={...section,plain:false,format:2 as const,raw},newNodes=thoughts(next),used=new Set<string>(),assigned=new Map<string,string>();
 const oldByText=new Map<string,typeof oldNodes>(),newByText=new Map<string,typeof newNodes>();
 for(const node of oldNodes){const list=oldByText.get(node.text)??[];list.push(node);oldByText.set(node.text,list);}for(const node of newNodes){const list=newByText.get(node.text)??[];list.push(node);newByText.set(node.text,list);}
 const ambiguous=(text:string)=>(oldByText.get(text)?.length??0)>1||(newByText.get(text)?.length??0)>1;
 for(const node of newNodes){const candidates=oldByText.get(node.text);if(!ambiguous(node.text)&&candidates?.length===1){used.add(candidates[0]!.id);assigned.set(node.id,candidates[0]!.id);}}
 // A single unambiguous rename can retain its reference; multiple edits are never paired by position.
 const before=oldNodes.filter(node=>!used.has(node.id)&&!ambiguous(node.text)),after=newNodes.filter(node=>!assigned.has(node.id)&&!ambiguous(node.text));if(before.length===1&&after.length===1)assigned.set(after[0]!.id,before[0]!.id);
 const chunks:string[]=[];let offset=0;for(const node of newNodes){const id=node.id,replacement=assigned.get(id)??id,start=node.lineTo-` <!-- em-note:${id} -->`.length;chunks.push(raw.slice(offset,start),` <!-- em-note:${replacement} -->`);offset=node.lineTo;}chunks.push(raw.slice(offset));return chunks.join('');
}
