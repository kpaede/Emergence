import type {TetradPattern} from './patterns';
import type {TetradBlock} from './source-types';
import {MarkdownContext,interruptsParagraph,sourceLines} from './source-context';

export const calloutHeader=/^ {0,3}>[ \t]?\[!([a-z][a-z0-9-]*)\][+-]?[ \t]*(.*)$/iu;
/** Only the first line of a root blockquote may introduce a Tetrad. Scanning
 * inside an unknown quote would mistake its quoted code examples for notes. */
export function tetradBlocks(note:string,patterns:readonly TetradPattern[]):TetradBlock[]{
 const known=new Set(patterns.map(pattern=>pattern.id)),result:TetradBlock[]=[],all=sourceLines(note),context=new MarkdownContext();
 let yaml=all[0]?.text.replace(/^\uFEFF/u,'').trim()==='---';
 for(let i=0;i<all.length;i++){
  const row=all[i]!;
  if(yaml){if(i>0&&/^(?:---|\.\.\.)[ \t]*$/u.test(row.text))yaml=false;continue;}
  if(!context.take(row.text,true)||!/^ {0,3}>/u.test(row.text))continue;
  let end=i,lazy=false;
  while(end+1<all.length){
   const text=all[end+1]!.text;
   if(/^ {0,3}>/u.test(text)){end++;continue;}
   if(text.trim()&&!interruptsParagraph(text)){lazy=true;end++;continue;}
   break;
  }
  const match=calloutHeader.exec(row.text);
  // This editor's source contract requires an explicit > on every line.
  if(match&&known.has(match[1]!.toLowerCase())&&!lazy){
   const to=all[end]!.to;result.push({from:row.from,to,line:i,index:result.length,type:match[1]!.toLowerCase(),source:note.slice(row.from,to)});
  }
  i=end;
 }
 return result;
}
