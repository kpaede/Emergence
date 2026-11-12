import {mermaidBlocks} from '../mermaid/blocks';
import {ARGDOWN_LANGUAGE} from '../argdown/blocks';
import type {MermaidTemplate} from '../mermaid/library';
export type TemplateKind='mermaid'|'argdown';
/** Titles come from Markdown headings outside fenced code, never from diagram syntax. */
export function templatesInNote(path:string,text:string,kind:TemplateKind):MermaidTemplate[]{
 const headings=new Map<number,string>();let heading='',fence:{char:string;length:number}|undefined;
 for(const [line,raw]of text.split(/\r?\n/u).entries()){
  if(fence){if(new RegExp('^ {0,3}'+fence.char+'{'+fence.length+',}\\s*$').test(raw))fence=undefined;continue;}
  const start=/^ {0,3}(`{3,}|~{3,})/u.exec(raw);if(start){fence={char:start[1]![0]!,length:start[1]!.length};headings.set(line,heading);continue;}
  const match=/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/u.exec(raw);if(match)heading=match[1]!;
 }
 const counts=new Map<string,number>(),base=path.split('/').at(-1)!.replace(/\.md$/iu,'');
 return mermaidBlocks(text,kind==='argdown'?ARGDOWN_LANGUAGE:undefined).filter(block=>block.source.trim()).map(block=>{
  const heading=headings.get(block.line)??'',occurrence=counts.get(heading)??0;counts.set(heading,occurrence+1);
  return {id:'folder:'+JSON.stringify([path,heading,occurrence]),name:base+(heading&&heading!==base?' · '+heading:'')+(occurrence?' · '+String(occurrence+1):''),source:block.source,path,line:block.line};
 });
}
export function validTemplateFolder(path:string,configDir?:string):boolean{return !path.startsWith('/')&&!/[\\\0\r\n]/u.test(path)&&!path.split('/').some(part=>part.startsWith('.'))&&(!configDir||path!==configDir&&!path.startsWith(configDir+'/'));}
