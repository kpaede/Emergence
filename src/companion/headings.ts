import {fingerprint,type SourceHeading} from './model';
/** Parse top-level publication headings only. Quotes, lists, fences, YAML and HTML comments are not publication sections. */
export function sourceHeadings(source:string):SourceHeading[]{
 const lines=source.split(/(?<=\n)/u),result:SourceHeading[]=[],starts:number[]=[];let offset=0,fence='',comment=false,yaml=lines[0]?.trim()==='---',previous=-1;
 for(let i=0;i<lines.length;i++){
  const raw=lines[i]!.replace(/\r?\n$/u,'');starts[i]=offset;offset+=lines[i]!.length;
  if(yaml){if(i>0&&/^(?:---|\.\.\.)\s*$/u.test(raw))yaml=false;previous=-1;continue;}
  if(comment){if(raw.includes('-->'))comment=false;previous=-1;continue;}
  if(/^ {0,3}<!--/u.test(raw)){comment=!raw.includes('-->');previous=-1;continue;}
  const mark=/^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(raw);
  if(fence){if(mark&&mark[1]![0]===fence[0]&&mark[1]!.length>=fence.length&&!mark[2]!.trim())fence='';previous=-1;continue;}
  if(mark){fence=mark[1]!;previous=-1;continue;}
  const atx=/^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u.exec(raw);
  if(atx){result.push({title:(atx[2]??'').replace(/[ \t]+#+[ \t]*$/u,'').trim(),level:atx[1]!.length,from:starts[i]!,line:i,parent:-1,body:''});previous=-1;continue;}
  const setext=/^ {0,3}(=+|-+)[ \t]*$/u.exec(raw);
  if(setext&&previous===i-1){result.push({title:lines[previous]!.trim(),level:setext[1]![0]==='='?1:2,from:starts[previous]!,line:previous,parent:-1,body:''});previous=-1;continue;}
  previous=raw.trim()&&!/^(?: {4}|\t| {0,3}(?:>|[-+*]\s|\d+[.)]\s|<|#{1,6}\b))/u.test(raw)?i:-1;
 }
 const stack:number[]=[];
 for(let i=0;i<result.length;i++){
  const heading=result[i]!;while(stack.length&&result[stack[stack.length-1]!]!.level>=heading.level)stack.pop();heading.parent=stack[stack.length-1]??-1;stack.push(i);
  const end=result[i+1]?.from??source.length,tail=source.slice(heading.from,end).split(/\r?\n/u);tail.shift();if(/^\s*(?:=+|-+)\s*$/u.test(tail[0]??''))tail.shift();const text=tail.join('\n').trim();heading.body=text?fingerprint(text):'';
 }
 return result;
}
export const outlineKey=(headings:readonly SourceHeading[]):string=>JSON.stringify(headings.map(h=>[h.title,h.level]));
