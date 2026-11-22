import type {App,HeadingCache,Editor} from 'obsidian';
import type {EditorView} from '@codemirror/view';
import {ensureSyntaxTree} from '@codemirror/language';
import {fingerprint,type SourceHeading} from './model';
import {sourceEditor} from './repository';

/** The same public heading cache used by Obsidian's Outline, tied to its exact text revision. */
export function cachedOutline(source:string,headings:readonly HeadingCache[]):SourceHeading[]{
 const result:SourceHeading[]=headings.map(h=>({title:h.heading,level:h.level,from:h.position.start.offset,line:h.position.start.line,parent:-1,body:''}));
 return describeOutline(source,result);
}
export function describeOutline(source:string,result:SourceHeading[]):SourceHeading[]{
 const stack:number[]=[];for(let i=0;i<result.length;i++){
  const heading=result[i]!;while(stack.length&&result[stack[stack.length-1]!]!.level>=heading.level)stack.pop();heading.parent=stack[stack.length-1]??-1;stack.push(i);
  const tail=source.slice(heading.from,result[i+1]?.from??source.length).split(/\r?\n/u);tail.shift();if(/^\s*(?:=+|-+)\s*$/u.test(tail[0]??''))tail.shift();const body=tail.join('\n').trim();heading.body=body?fingerprint(body):'';
 }return result;
}
/** Unsaved headings come from the active editor's existing syntax tree, without a second document parser. */
export function liveOutline(app:App,path:string,source:string):SourceHeading[]|undefined{
 const editor:(Editor&{cm?:EditorView})|undefined=sourceEditor(app,path)?.editor,cm=editor?.cm;if(!cm||cm.state.doc.toString()!==source)return;
 const tree=ensureSyntaxTree(cm.state,cm.state.doc.length,25);if(!tree)return;
 const lines=new Map<number,number>();tree.iterate({enter(node){const match=/(?:ATXHeading|SetextHeading|header[-_]?)([1-6])/iu.exec(node.type.name);if(match){let line=cm.state.doc.lineAt(node.from);if(/^ {0,3}(?:=+|-+)[ \t]*$/u.test(line.text)&&line.number>1)line=cm.state.doc.line(line.number-1);lines.set(line.number-1,Number(match[1]));}}});
 if(!lines.size)return;
 return describeOutline(source,[...lines].sort(([a],[b])=>a-b).map(([number,level])=>{const line=cm.state.doc.line(number+1);return {title:line.text.replace(/^ {0,3}#{1,6}[ \t]*/u,'').replace(/[ \t]+#+[ \t]*$/u,'').trim(),level,from:line.from,line:number,parent:-1,body:''};}));
}
