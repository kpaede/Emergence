import {TreeFragment,type Tree} from '@lezer/common';
import type {ChangeDesc,Text} from '@codemirror/state';
import {parser,GFM,type MarkdownConfig,type InlineContext} from '@lezer/markdown';

export interface CharacterCountOptions {whitespace:boolean;footnotes:boolean}
export const defaultCharacterCountOptions:CharacterCountOptions={whitespace:true,footnotes:true};
export interface CharacterCount {count(from:number,to:number):number}
interface Range {from:number;to:number}
const BLOCK=1024;

/** End of a footnote reference; escaped punctuation is part of its label. */
function referenceEnd(text:string,from:number):number{
 if(!text.startsWith('[^',from))return -1;
 for(let i=from+2;i<text.length;i++){const char=text[i];if(char==='\\'){i++;continue;}if(char===']')return i>from+2?i+1:-1;if(char==='['||/\s/u.test(char!))break;}return -1;
}
/** Inline notes can contain links, balanced brackets and code containing a closing bracket. */
const inlineMatches=new WeakMap<InlineContext,Map<number,number>>();
function inlineEnds(text:string):Map<number,number>{
 const stack:number[]=[],ends=new Map<number,number>();
 for(let i=0;i<text.length;i++){
  const char=text[i];if(char==='\\'){i++;continue;}
  if(char==='`'){let end=i+1;while(text[end]==='`')end++;const ticks=text.slice(i,end);let close=text.indexOf(ticks,end);while(close>=0&&(text[close-1]==='`'||text[close+ticks.length]==='`'))close=text.indexOf(ticks,close+ticks.length);if(close>=0){i=close+ticks.length-1;continue;}}
  if(char==='[')stack.push(i);else if(char===']'&&stack.length)ends.set(stack.pop()!,i+1);
 }return ends;
}
const notes:MarkdownConfig={
 defineNodes:[{name:'FootnoteDefinition',block:true},'FootnoteReference','InlineFootnote',{name:'BlockMath',block:true},'InlineMath'],
 parseBlock:[{
  name:'FootnoteDefinition',before:'LinkReference',parse(context,line){
   const text=line.text.slice(line.pos),end=referenceEnd(text,0);if(end<0||text[end]!==':'||line.indent>=line.baseIndent+4)return false;
   const from=context.lineStart+line.pos;let blank=false;while(context.nextLine()){const next=line.text.slice(line.pos);if(!next.trim()){blank=true;continue;}if(line.indent<line.baseIndent+4){const reference=referenceEnd(next,0);if(blank||reference>=0&&next[reference]===':'||/^(?:#{1,6}(?:\s|$)|`{3,}|~{3,}|>|[-+*]\s|\d+[.)]\s|(?:[-*_][ \t]*){3,}$|<)/u.test(next))break;}blank=false;}
   context.addElement(context.elt('FootnoteDefinition',from,context.prevLineEnd()));return true;
  },
 },{
  name:'BlockMath',before:'FencedCode',parse(context,line){
   const text=line.text.slice(line.pos);if(!text.startsWith('$$')||line.indent>=line.baseIndent+4)return false;const from=context.lineStart+line.pos;
   if(text.slice(2).includes('$$'))context.nextLine();else while(context.nextLine()){if(line.text.slice(line.pos).includes('$$')){context.nextLine();break;}}
   context.addElement(context.elt('BlockMath',from,context.prevLineEnd()));return true;
  },
 }],
 parseInline:[{
  name:'ObsidianFootnotes',before:'Link',parse(context,next,pos){
   const offset=pos-context.offset,text=context.text;
   if(next===94&&text[offset+1]==='['){let ends=inlineMatches.get(context);if(!ends){ends=inlineEnds(text);inlineMatches.set(context,ends);}const end=ends.get(offset+1);if(end!==undefined)return context.addElement(context.elt('InlineFootnote',pos,context.offset+end));}
   if(next===91&&text[offset-1]!=='!'){const end=referenceEnd(text,offset);if(end>=0)return context.addElement(context.elt('FootnoteReference',pos,context.offset+end));}
   if(next===36&&text[offset+1]!=='$'){for(let end=offset+1;end<text.length&&text[end]!=='\n';end++){if(text[end]==='\\'){end++;continue;}if(text[end]==='$')return context.addElement(context.elt('InlineMath',pos,context.offset+end+1));}}
   return -1;
  },
 }],
};
const markdown=parser.configure([GFM,notes]);

/** Parse only when notes are excluded. Ordinary Markdown code, HTML and math stay literal. */
function footnoteRanges(text:string,tree:Tree):Range[]{
 const frontmatter=/^(?:\uFEFF)?---\r?\n[^]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/u.exec(text)?.[0].length??0,definitions=new Set<string>(),ranges:Range[]=[],references:Range[]=[];
 tree.iterate({enter(node){
  if(node.to<=frontmatter)return false;if(node.from<frontmatter)return true;
  if(node.name==='FootnoteDefinition'){const end=referenceEnd(text,node.from);definitions.add(text.slice(node.from+2,end-1));const from=text.lastIndexOf('\n',node.from-1)+1,to=text[node.to]==='\r'&&text[node.to+1]==='\n'?node.to+2:text[node.to]==='\n'?node.to+1:node.to;ranges.push({from,to});return false;}
  if(node.name==='InlineFootnote'){ranges.push({from:node.from,to:node.to});return false;}
  if(node.name==='FootnoteReference'){references.push({from:node.from,to:node.to});return false;}
  return true;
 }});
 for(const range of references)if(definitions.has(text.slice(range.from+2,range.to-1)))ranges.push(range);
 ranges.sort((a,b)=>a.from-b.from);const merged:Range[]=[];for(const range of ranges){const previous=merged.at(-1);if(previous&&range.from<=previous.to)previous.to=Math.max(previous.to,range.to);else merged.push({...range});}return merged;
}

/** Compact prefix counts: O(source length) once per changed snapshot, O(1 KB) per lookup. */
function filteredCount(text:string,options:CharacterCountOptions,excluded:Range[]):CharacterCount{
 const prefix=[0];
 const visible=(from:number,to:number)=>options.whitespace?to-from:text.slice(from,to).replace(/\s/gu,'').length;
 const chunk=(from:number,to:number)=>{
  let low=0,high=excluded.length;while(low<high){const middle=(low+high)>>>1;if(excluded[middle]!.to<=from)low=middle+1;else high=middle;}
  let count=0,at=from;for(let i=low;i<excluded.length&&excluded[i]!.from<to;i++){const range=excluded[i]!;if(range.from>at)count+=visible(at,range.from);at=Math.max(at,Math.min(to,range.to));}return count+(at<to?visible(at,to):0);
 };
 for(let from=0;from<text.length;from+=BLOCK)prefix.push(prefix.at(-1)!+chunk(from,Math.min(from+BLOCK,text.length)));
 const before=(at:number)=>{at=Math.max(0,Math.min(at,text.length));const block=Math.floor(at/BLOCK);return prefix[block]!+chunk(block*BLOCK,at);};
 return {count:(from,to)=>before(to)-before(from)};
}

/** RAM only. Companion edits and drag previews reuse the source snapshot's existing counts. */
export class CharacterCountCache {
 private source?:string|Text;private key='';private value?:CharacterCount;private tree?:Tree;private fragments:readonly TreeFragment[]=[];
 /** Reuse the existing Markdown tree after edits; no parse runs inside the editor event. */
 update(before:Text,after:Text,changes:ChangeDesc):void{
  if(this.source===after)return;
  if(this.source===before){const ranges:{fromA:number;toA:number;fromB:number;toB:number}[]=[];changes.iterChangedRanges((fromA,toA,fromB,toB)=>ranges.push({fromA,toA,fromB,toB}));this.fragments=TreeFragment.applyChanges(this.tree?TreeFragment.addTree(this.tree):this.fragments,ranges);}
  else this.fragments=[];this.tree=undefined;this.value=undefined;this.source=after;
 }
 scans=0;
 get(source:string|Text,options:CharacterCountOptions):CharacterCount{
  if(options.whitespace&&options.footnotes)return {count:(from,to)=>to-from};
  if(this.source!==source){this.tree=undefined;this.fragments=[];}
  const key=String(options.whitespace)+String(options.footnotes);if(this.source!==source||this.key!==key||!this.value){const text=typeof source==='string'?source:source.sliceString(0,source.length);let excluded:Range[]=[];if(!options.footnotes&&(text.includes('[^')||text.includes('^['))){this.tree??=markdown.parse(text,this.fragments);excluded=footnoteRanges(text,this.tree);}this.value=filteredCount(text,options,excluded);this.source=source;this.key=key;this.scans++;}return this.value;
 }
}
