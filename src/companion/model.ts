export interface SourceHeading {title:string;level:number;from:number;line:number;parent:number;body:string}
export type SectionState='linked'|'review'|'detached'|'general';
export interface SectionBase extends SourceHeading {index:number}
export interface CompanionSection {id:string;title:string;level:number;state:SectionState;base?:SectionBase;raw:string;format?:2;plain?:boolean}
export interface ChapterFileIssue {path:string;reason:'missing'|'invalid';reference:string;message?:string}
export interface CompanionDocument {id:string;source:string;sections:CompanionSection[];preamble:string;newline:string;original:string;header:string;storage?:StorageOptions;files?:Record<string,string>;fileOriginals?:Record<string,string>;storageDrift?:boolean;unavailableFiles?:Record<string,ChapterFileIssue>}
export interface Thought {id:string;section:string;from:number;to:number;lineFrom:number;lineTo:number;indent:string;text:string;marker:string;parent?:string}
export interface PairState {path:string;source:string;error?:string;revision:number;missing?:boolean}
export const newId=():string=>crypto.randomUUID();
export function fingerprint(text:string):string {let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `${(a>>>0).toString(36)}-${(b>>>0).toString(36)}-${text.length}`;}

export interface StorageOptions {mode:'document'|'sections';location:'beside'|'folder'|'subfolder';folder:string;subfolder?:string;origin?:'defaults'|'custom'}
export const defaultStorage=():StorageOptions=>({mode:'document',location:'beside',folder:''});
