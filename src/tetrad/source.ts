import {t} from '../i18n';
import {LAWS, type LawId} from './render/laws';
import {patternLaw, type TetradPattern} from './patterns';
export interface TetradBlock {from:number; to:number; line:number; index:number; type:string; source:string}
interface SourceLine {from:number;to:number;text:string}
function lines(source:string):SourceLine[]{let from=0;return source.split(/(?<=\n)/u).filter(Boolean).map(text=>{const line={from,to:from+text.length,text:text.replace(/\r?\n$/u,'')};from=line.to;return line;});}
function fence(text:string):string|undefined{return /^\s{0,3}(`{3,}|~{3,})/u.exec(text)?.[1];}
export function tetradBlocks(note:string,patterns:readonly TetradPattern[]):TetradBlock[]{
 const known=new Set(patterns.map(p=>p.id)),result:TetradBlock[]=[],all=lines(note);let fenced:string|undefined;
 for(let i=0;i<all.length;i++){
  const row=all[i]!,mark=fence(row.text);
  if(fenced){if(mark&&mark[0]===fenced[0]&&mark.length>=fenced.length&&new RegExp('^\\s{0,3}'+(mark[0]==='`'?'`':'~')+'+\\s*$','u').test(row.text))fenced=undefined;continue;}
  if(mark){fenced=mark;continue;}
  const match=/^ {0,3}>\s?\[!([a-z][a-z0-9-]*)\][+-]?(?:\s|$)/iu.exec(row.text);
  if(!match||!known.has(match[1]!.toLowerCase()))continue;
  let end=i;while(end+1<all.length&&/^ {0,3}>/u.test(all[end+1]!.text))end++;
  const to=all[end]!.to;
  result.push({from:row.from,to,line:i,index:result.length,type:match[1]!.toLowerCase(),source:note.slice(row.from,to)});i=end;
 }
 return result;
}
export interface TetradSection {from:number;to:number;headingFrom:number;body:string}
export interface TetradDocument {title:string;sections:Map<LawId,TetradSection>;preamble:string;newline:string}
export function parseSource(source:string,pattern:TetradPattern):TetradDocument{
 const all=lines(source),header=all[0],match=header&&/^ {0,3}>\s?\[!([a-z][a-z0-9-]*)\][+-]?[ \t]*(.*)$/iu.exec(header.text);
 if(!match||match[1]!.toLowerCase()!==pattern.id||all.slice(1).some(row=>!/^ {0,3}>/u.test(row.text)))throw new Error(t('tetrad.invalidSource'));
 const sections=new Map<LawId,TetradSection>();let current:TetradSection|undefined,fenced:string|undefined,preamble='';
 for(const row of all.slice(1)){
  const text=row.text.replace(/^ {0,3}> ?/u,''),mark=fence(text);
  let law:LawId|undefined;
  if(fenced){if(mark&&mark[0]===fenced[0]&&mark.length>=fenced.length&&/^\s*(?:`+|~+)\s*$/u.test(text))fenced=undefined;}
  else if(mark)fenced=mark;
  else {const heading=/^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/u.exec(text);if(heading)law=patternLaw(pattern,heading[1]!.replace(/[*_`]/gu,''));}
  if(law){if(sections.has(law))throw new Error(t('tetrad.duplicateSections'));if(current)current.to=row.from;current={from:row.to,to:source.length,headingFrom:row.from,body:''};sections.set(law,current);}
  else if(current)current.body+=text+'\n';else preamble+=text+'\n';
 }
 for(const section of sections.values())section.body=section.body.replace(/^\n+|\n+$/gu,'');
 return {title:match[2]!,sections,preamble,newline:source.includes('\r\n')?'\r\n':'\n'};
}
export function starter(pattern:TetradPattern,title=t('tetrad.subject')):string{
 return `> [!${pattern.id}] ${title}\n>\n`+LAWS.map(law=>`> ${'#'.repeat(pattern.level)} ${pattern.headings[law.id]}\n> ${t('tetrad.corePlaceholder')}\n`).join('>\n');
}
export function editSection(source:string,pattern:TetradPattern,law:LawId,body:string):string{
 const document=parseSource(source,pattern),section=document.sections.get(law),nl=document.newline;
 if(section?.body===body)return source;
 const quoted=body.replace(/\r\n/gu,'\n').split('\n').map(line=>line?'> '+line:'>').join(nl)+nl;
 if(section)return source.slice(0,section.from)+quoted+(section.to<source.length?'>'+nl:'')+source.slice(section.to);
 return source+(source.endsWith('\n')?'':nl)+'>'+nl+'> '+'#'.repeat(pattern.level)+' '+pattern.headings[law]+nl+quoted;
}
/** Only relocate an unchanged block with unique evidence. Never guess between copies. */
export function relocateTetrad(before:string,after:string,block:TetradBlock,patterns:readonly TetradPattern[]):TetradBlock{
 const candidates=tetradBlocks(after,patterns),same=candidates.filter(item=>item.source===block.source);
 if(before===after){const exact=candidates.find(item=>item.from===block.from&&item.source===block.source);if(exact)return exact;}
 if(tetradBlocks(before,patterns).filter(item=>item.source===block.source).length!==same.length)throw new Error(t('tetrad.conflict'));
 const prefix=before.slice(0,block.from),suffix=before.slice(block.to);
 const anchored=same.filter(item=>after.slice(0,item.from)===prefix||after.slice(item.to)===suffix);
 if(anchored.length===1)return anchored[0]!;
 if(same.length===1&&tetradBlocks(before,patterns).filter(item=>item.source===block.source).length===1)return same[0]!;
 throw new Error(t('tetrad.conflict'));
}

/** Insert a separated callout without replacing a selection in the note. */
export function createInsertion(before:string,after:string,pattern:TetradPattern,title=t('tetrad.subject')):{text:string;titleOffset:number}{
 const nl=(before+after).includes('\r\n')?'\r\n':'\n';
 const prefix=!before||before.endsWith(nl+nl)?'':before.endsWith(nl)?nl:nl+nl;
 const suffix=after.startsWith(nl+nl)?'':after.startsWith(nl)?nl:nl+nl;
 return {text:prefix+starter(pattern,title).trimEnd().replace(/\n/gu,nl)+suffix,titleOffset:prefix.length+`> [!${pattern.id}] `.length};
}
