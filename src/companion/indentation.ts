/*! Subtree boundary and reindentation rules adapted from Excerpt Outline Mindmap Editor,
 * src/domain/mindmap-file.ts, commit ed1cb93a3432675b7409ff1ebfc742fe31c254b6.
 * Copyright (c) 2025 Kornelius Paede. MIT; see third-party/companion-outline-LICENSE.txt.
 * The adapter uses indentation columns for mixed tabs/spaces and preserves line endings. */
export const indentColumns=(indent:string):number=>[...indent].reduce((sum,ch)=>sum+(ch==='\t'?4-sum%4:1),0);
export function subtreeEnd(raw:string,from:number,indent:string):number{
 const base=indentColumns(indent);let offset=from,first=true;
 for(const line of raw.slice(from).split(/(?<=\n)/u)){
  if(!first&&line.trim()&&indentColumns(/^[ \t]*/u.exec(line)![0])<=base)return offset;
  first=false;offset+=line.length;
 }
 return raw.length;
}
export function reindentSubtree(raw:string,oldIndent:string,newIndent:string):string{
 return raw.split(/(?<=\n)/u).map(line=>{
  if(!line.trim())return line;
  // The normal prefix-preserving path is the original EOME move rule.
  if(line.startsWith(oldIndent)&&(indentColumns(newIndent)-indentColumns(oldIndent))%4===0)return newIndent+line.slice(oldIndent.length);
  // Equivalent mixed whitespace must preserve its depth as well.
  const indent=/^[ \t]*/u.exec(line)![0],columns=Math.max(0,indentColumns(indent)-indentColumns(oldIndent));
  return newIndent+' '.repeat(columns)+line.slice(indent.length);
 }).join('');
}

export const childIndent=(indent:string):string=>indent+(indentColumns(indent)%4===0?'\t':'    ');
