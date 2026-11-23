import {t} from '../i18n';
import {patternLaw,type TetradPattern} from './patterns';
import {MarkdownContext,interruptsParagraph,quotePrefix,sourceLines,unquote} from './source-context';
import {calloutHeader} from './source-scan';
import type {TetradDocument,TetradFormat,TetradSection} from './source-types';
import type {LawId} from './render/laws';

interface Marker {law:LawId; label:string; format:TetradFormat; level?:number}
function marker(text:string,previous:string|undefined,next:string|undefined,pattern:TetradPattern):Marker|undefined{
 const heading=/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/u.exec(text);
 if(heading){
  const label=heading[2]!.replace(/[*_`]/gu,''),law=patternLaw(pattern,label);
  if(law)return {law,label,format:'headings',level:heading[1]!.length};
 }
 // A bold line followed by prose is one paragraph, not a section title.
 const paragraphStart=previous===undefined||!previous.trim()||/^ {0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}[ \t]*$|~{3,}[ \t]*$|(?:[-*_][ \t]*){3,}$|=+[ \t]*$|-->[ \t]*$)/u.test(previous)||/^(?: {4}|\t)/u.test(previous);
 if(!paragraphStart||(next!==undefined&&next.trim()&&!interruptsParagraph(next)))return;
 const bold=/^ {0,3}(\*\*|__)(\S(?:.*?\S)?)\1[ \t]*$/u.exec(text);
 if(bold){const label=bold[2]!,law=patternLaw(pattern,label);if(law)return {law,label,format:'bold'};}
 return;
}
export function parseSource(source:string,pattern:TetradPattern):TetradDocument{
 const all=sourceLines(source),match=all[0]&&calloutHeader.exec(all[0].text);
 if(!match||match[1]!.toLowerCase()!==pattern.id||all.slice(1).some(row=>!quotePrefix.test(row.text)))throw new Error(t('tetrad.invalidSource'));
 const content=all.slice(1).map(row=>unquote(row.text)),context=new MarkdownContext(),sections=new Map<LawId,TetradSection>();
 let current:TetradSection|undefined,preamble='',format:TetradFormat|undefined,level:number|undefined;
 for(let i=0;i<content.length;i++){
  const text=content[i]!,row=all[i+1]!,found=context.take(text)?marker(text,content[i-1],content[i+1],pattern):undefined;
  if(found){
   if(format&&format!==found.format)throw new Error(t('tetrad.mixedSectionFormats'));
   if(found.format==='headings'&&level!==undefined&&found.level!==level)throw new Error(t('tetrad.inconsistentHeadingLevels'));
   if(sections.has(found.law))throw new Error(t('tetrad.duplicateSections'));
   format=found.format;level=found.level;
   if(current)current.to=row.from;
   current={from:row.to,to:source.length,headingFrom:row.from,label:found.label,body:''};sections.set(found.law,current);
  }else if(current)current.body+=text+'\n';else preamble+=text+'\n';
 }
 for(const section of sections.values())section.body=section.body.replace(/^\n+|\n+$/gu,'');
 return {title:match[2]!,sections,preamble,newline:source.includes('\r\n')?'\r\n':'\n',format:format??'headings',level:format==='bold'?undefined:level??pattern.level};
}
