import {t} from '../i18n';
import {LAWS,type LawId} from './render/laws';
import type {TetradPattern} from './patterns';
import type {TetradBlock,TetradDocument,TetradFormat} from './source-types';
import {parseSource} from './source-parse';
import {tetradBlocks} from './source-scan';
import {sourceLines,unquote} from './source-context';
export {parseSource,tetradBlocks};
export type {TetradBlock,TetradDocument,TetradFormat,TetradSection} from './source-types';

const normalizedBody=(body:string):string=>body.replace(/\r\n/gu,'\n').replace(/^\n+|\n+$/gu,'');
function titleLine(label:string,format:TetradFormat,level:number):string{return format==='bold'?'**'+label+'**':'#'.repeat(level)+' '+label;}
function quotedBody(body:string,newline:string):string{return body.replace(/\r\n/gu,'\n').split('\n').map(line=>line?'> '+line:'>').join(newline)+newline;}
function checkLevel(level:number):void{if(!Number.isInteger(level)||level<1||level>6)throw new Error(t('tetrad.invalidSource'));}
function checkFormat(format:TetradFormat):void{if(format!=='headings'&&format!=='bold')throw new Error(t('tetrad.invalidSource'));}
/** Validate both syntax and ownership: Markdown entered into one body must never
 * become another section or swallow a later section through an open literal block. */
function validateEdit(candidate:string,pattern:TetradPattern,before:TetradDocument,changed?:{law:LawId;body:string}):void{
 const after=parseSource(candidate,pattern),expected=new Map([...before.sections].map(([law,section])=>[law,section.body]));
 if(changed)expected.set(changed.law,normalizedBody(changed.body));
 if(after.sections.size!==expected.size||[...expected].some(([law,body])=>after.sections.get(law)?.body!==body))throw new Error(t('tetrad.sectionBoundaryInBody'));
}
export function starter(pattern:TetradPattern,title=t('tetrad.subject'),format:TetradFormat='headings',core=t('tetrad.corePlaceholder')):string{
 checkLevel(pattern.level);checkFormat(format);
 const gap=format==='bold'?'>\n':'';
 const source=`> [!${pattern.id}] ${title}\n>\n`+LAWS.map(law=>`> ${titleLine(pattern.headings[law.id],format,pattern.level)}\n${gap}> ${core}\n`).join('>\n');
 parseSource(source,pattern);return source;
}
export function editSection(source:string,pattern:TetradPattern,law:LawId,body:string):string{
 const document=parseSource(source,pattern),section=document.sections.get(law),nl=document.newline;
 if(section?.body===body)return source;
 const quoted=quotedBody(body,nl);
 let candidate:string;
 if(section)candidate=source.slice(0,section.from)+(document.format==='bold'?'>'+nl:'')+quoted+(section.to<source.length?'>'+nl:'')+source.slice(section.to);
 else candidate=source+(source.endsWith('\n')?'':nl)+'>'+nl+'> '+titleLine(pattern.headings[law],document.format,document.level??pattern.level)+nl+(document.format==='bold'?'>'+nl:'')+quoted;
 validateEdit(candidate,pattern,document,{law,body});return candidate;
}
/** Explicit conversion touches section marker lines only. Bodies retain their
 * source bytes; bold paragraphs receive separating blank lines where needed. */
export function editFormat(source:string,pattern:TetradPattern,format:TetradFormat,level=pattern.level):string{
 checkLevel(level);checkFormat(format);const document=parseSource(source,pattern),nl=document.newline;
 if(format===document.format&&(format==='bold'||level===document.level))return source;
 if(!document.sections.size)throw new Error(t('tetrad.missingSections'));
 let candidate=source;
 for(const section of [...document.sections.values()].reverse()){
  const marker='> '+titleLine(section.label,format,level)+nl;
  let before='',after='';
  if(format==='bold'){
   const previous=sourceLines(candidate.slice(0,section.headingFrom)),last=previous[previous.length-1],next=sourceLines(candidate.slice(section.from))[0];
   if(last&&last.from>0&&unquote(last.text).trim())before='>'+nl;
   if(next&&unquote(next.text).trim())after='>'+nl;
  }
  candidate=candidate.slice(0,section.headingFrom)+before+marker+after+candidate.slice(section.from);
 }
 const parsed=parseSource(candidate,pattern);
 if(document.sections.size&&parsed.format!==format)throw new Error(t('tetrad.invalidSource'));
 validateEdit(candidate,pattern,document);return candidate;
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
export function createInsertion(before:string,after:string,pattern:TetradPattern,title=t('tetrad.subject'),format:TetradFormat='headings',core=t('tetrad.corePlaceholder')):{text:string;titleOffset:number}{
 const insertion=sourceInsertion(before,after,starter(pattern,title,format,core));
 return {text:insertion.text,titleOffset:insertion.sourceOffset+`> [!${pattern.id}] `.length};
}
/** The editor and insert command use the same block boundaries and line endings. */
export function sourceInsertion(before:string,after:string,source:string):{text:string;sourceOffset:number}{
 const nl=(before+after).includes('\r\n')?'\r\n':'\n';
 const prefix=!before||before.endsWith(nl+nl)?'':before.endsWith(nl)?nl:nl+nl;
 const suffix=after.startsWith(nl+nl)?'':after.startsWith(nl)?nl:nl+nl;
 return {text:prefix+source.replace(/\r\n/gu,'\n').replace(/\n+$/u,'').replace(/\n/gu,nl)+suffix,sourceOffset:prefix.length};
}
