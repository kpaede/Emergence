import type {Text} from '@codemirror/state';
import type {CompanionSection,NavigationHeading} from './model';
import type {CharacterCount} from './character-count';

export const outlineSizeModes=['off','section','subtree'] as const;
export type OutlineSizeMode=typeof outlineSizeModes[number];
export interface OutlineSize {characters:number;percentage:number}
export type OutlineSizes=ReadonlyMap<string,OutlineSize>;
export function validOutlineSizeMode(value:unknown):value is OutlineSizeMode{return outlineSizeModes.some(mode=>mode===value);}

/** Only inspect heading lines. Body lengths come from existing source offsets. */
export function headingContentStart(source:string|Text,from:number):number{
 if(typeof source!=='string'){
  const line=source.lineAt(from);if(line.number===source.lines)return source.length;
  const next=source.line(line.number+1);
  if(!/^ {0,3}#{1,6}(?:\s|$)/u.test(line.text)&&/^ {0,3}(?:=+|-+)[ \t]*$/u.test(next.text))return next.number<source.lines?source.line(next.number+1).from:source.length;
  return next.from;
 }
 const end=source.indexOf('\n',from);if(end<0)return source.length;
 if(/^ {0,3}#{1,6}(?:\s|$)/u.test(source.slice(from,end)))return end+1;
 const next=source.indexOf('\n',end+1),tail=next<0?source.length:next;
 return /^ {0,3}(?:=+|-+)[ \t]*\r?$/u.test(source.slice(end+1,tail))?next<0?source.length:next+1:end+1;
}

/** O(headings), independent of body length; no second Markdown parser or body copies. */
export function outlineSizes(sections:readonly CompanionSection[],anchors:ReadonlyMap<string,number>,source:string|Text,mode:Exclude<OutlineSizeMode,'off'>,counter?:CharacterCount,outline?:readonly NavigationHeading[]):OutlineSizes|undefined{
 const linked=sections.filter(section=>section.state==='linked'),eligible=new Set(linked.map(s=>s.id)),headings=outline?.filter(h=>h.kind!=='marker').map(h=>({id:h.key,level:h.level}))??linked,nodes:{id:string;level:number;from:number;start:number}[]=[],ends:number[]=[],stack:number[]=[];
 for(const section of headings){const from=anchors.get(section.id);if(from===undefined||from<0||from>source.length||nodes.length&&from<=nodes[nodes.length-1]!.from)return;
  nodes.push({id:section.id,level:section.level,from,start:headingContentStart(source,from)});
 }
 for(let i=0;i<nodes.length;i++){while(stack.length&&nodes[stack[stack.length-1]!]!.level>=nodes[i]!.level)ends[stack.pop()!]=nodes[i]!.from;stack.push(i);}for(const index of stack)ends[index]=source.length;
 const counts=nodes.map((node,index)=>{const end=mode==='section'?nodes[index+1]?.from??source.length:ends[index]!;return Math.max(0,counter?counter.count(node.start,end):end-node.start);}),maximum=counts.reduce((max,count,index)=>eligible.has(nodes[index]!.id)?Math.max(max,count):max,0);
 return new Map(nodes.flatMap((node,index)=>eligible.has(node.id)?[[node.id,{characters:counts[index]!,percentage:maximum?Math.round(counts[index]!/maximum*10000)/100:0}] as const]:[]));
}
