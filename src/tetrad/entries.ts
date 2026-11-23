import {parser,GFM,type MarkdownConfig} from '@lezer/markdown';
import {t} from '../i18n';
import type {TetradPattern} from './patterns';
import type {LawId} from './render/laws';
import {editSection,parseSource} from './source';

export interface TetradEntry {
 index:number;
 kind:'core'|'gloss';
 block:string;
 from:number;
 to:number;
 /** Complete source block, including an outer list marker when present. */
 markdown:string;
 /** Editable Markdown content without the outer list marker/indentation. */
 content:string;
 /** Effective displayed number in the original top-level ordered list. */
 order?:number;
}
export interface TetradEntries {
 body:string;
 entries:TetradEntry[];
 core?:TetradEntry;
 glosses:TetradEntry[];
 /** Non-visible definitions, used as rendering context only. */
 references:string;
 footnotes:string;
}
export type TetradEntryChange=
 |{kind:'edit';index:number;markdown:string}
 |{kind:'insert';at:number;markdown:string}
 |{kind:'delete';indices:number[]}
 |{kind:'move';index:number;to:number}
 |{kind:'setCore';markdown:string};
export type TetradEntryOperation=TetradEntryChange&{expectedBody:string;corePlaceholder?:string};

/** Extend the actual CommonMark parser at its block hook. Native Obsidian math
 * and footnote definitions must not be mistaken for the first prose paragraph. */
const nativeBlocks:MarkdownConfig={
 defineNodes:[{name:'BlockMath',block:true},{name:'FootnoteDefinition',block:true}],
 parseBlock:[{
  name:'BlockMath',before:'FencedCode',
  parse(context,line){
   const text=line.text.slice(line.pos);if(!text.startsWith('$$')||line.indent>=line.baseIndent+4)return false;
   const from=context.lineStart+line.pos;
   if(text.slice(2).includes('$$'))context.nextLine();
   else while(context.nextLine()){if(line.text.slice(line.pos).includes('$$')){context.nextLine();break;}}
   context.addElement(context.elt('BlockMath',from,context.prevLineEnd()));return true;
  },
 },{
  name:'FootnoteDefinition',before:'LinkReference',
  parse(context,line){
   const text=line.text.slice(line.pos),end=text.indexOf(']:',2);
   if(!text.startsWith('[^')||end<3||line.indent>=line.baseIndent+4)return false;
   const from=context.lineStart+line.pos;
   while(context.nextLine()){if(line.text.trim()&&line.indent<line.baseIndent+4)break;}
   context.addElement(context.elt('FootnoteDefinition',from,context.prevLineEnd()));return true;
  },
 }],
};
const markdownParser=parser.configure([GFM,nativeBlocks]);
type SyntaxNode=ReturnType<typeof markdownParser.parse>['topNode'];
const lineStart=(body:string,from:number):number=>body.lastIndexOf('\n',from-1)+1;
function blockFrom(body:string,node:SyntaxNode):number{
 const start=lineStart(body,node.from);return /^[ \t]*$/u.test(body.slice(start,node.from))?start:node.from;
}
// Lezer treats CR as the last character of a CRLF line. Keep that CR with its
// newline separator instead of attaching half a newline to the editable block.
function blockTo(body:string,node:SyntaxNode):number{return body[node.to-1]==='\r'&&body[node.to]==='\n'?node.to-1:node.to;}
function removeIndent(text:string,columns:number):string{
 let at=0,width=0;while(at<text.length&&width<columns){if(text[at]===' ')width++;else if(text[at]==='\t')width+=4-width%4;else return text;at++;}return width>=columns?text.slice(at):text;
}
function listContent(body:string,node:SyntaxNode,from:number):string{
 const mark=node.getChild('ListMark');if(!mark)return body.slice(from,blockTo(body,node));
 let start=mark.to;while(body[start]===' '||body[start]==='\t')start++;
 const columns=body.slice(from,start).replace(/\t/gu,'    ').length,lines=body.slice(start,blockTo(body,node)).split(/\r?\n/u);
 return lines.map((line,index)=>index?removeIndent(line,columns):line).join(body.includes('\r\n')?'\r\n':'\n');
}
/** Source-order entries, with list descendants owned by their direct ListItem. */
export function tetradEntries(body:string):TetradEntries{
 const entries:TetradEntry[]=[],references:string[]=[],footnotes:string[]=[];let core:TetradEntry|undefined;
 const add=(node:SyntaxNode,order?:number):void=>{
  const from=blockFrom(body,node),to=blockTo(body,node),markdown=body.slice(from,to),entry:TetradEntry={index:entries.length,kind:!core&&node.name==='Paragraph'?'core':'gloss',block:node.name,from,to,markdown,content:node.name==='ListItem'?listContent(body,node,from):markdown,order};
  if(entry.kind==='core')core=entry;entries.push(entry);
 };
 const tree=markdownParser.parse(body);
 tree.iterate({enter(node){if(node.name==='LinkReference')references.push(body.slice(node.from,node.to));else if(node.name==='FootnoteDefinition')footnotes.push(body.slice(node.from,node.to));}});
 for(let node=tree.topNode.firstChild;node;node=node.nextSibling){
  const markdown=body.slice(node.from,node.to);
  if(node.name==='LinkReference'||node.name==='FootnoteDefinition'||node.name==='CommentBlock'||node.name==='ProcessingInstructionBlock')continue;
  if(node.name==='HTMLBlock'&&markdown.trim().startsWith('<!--')&&markdown.trim().endsWith('-->'))continue;
  if(node.name==='BulletList'||node.name==='OrderedList'){
   let order=node.name==='OrderedList'?Number.parseInt(body.slice(node.from),10):undefined;
   for(let item=node.firstChild;item;item=item.nextSibling)if(item.name==='ListItem'){add(item,order);if(order!==undefined)order++;}
  }else add(node);
 }
 return {body,entries,core,glosses:entries.filter(entry=>entry!==core),references:references.join('\n\n'),footnotes:footnotes.join('\n\n')};
}

const newline=(body:string):string=>body.includes('\r\n')?'\r\n':'\n';
const contentText=(text:string,nl:string):string=>text.replace(/\r\n/gu,'\n').replace(/^\n+|\n+$/gu,'').replace(/\n/gu,nl);
function fail(key:'tetrad.entryEmpty'|'tetrad.coreParagraph'|'tetrad.entryStructureChanged'|'tetrad.coreRequired'|'tetrad.conflict'):never{throw new Error(t(key));}
function requireEntry(model:TetradEntries,index:number):TetradEntry{
 const entry=Number.isInteger(index)&&model.entries[index];if(!entry)fail('tetrad.conflict');return entry;
}
function requireSlot(model:TetradEntries,at:number):void{if(!Number.isInteger(at)||at<0||at>model.entries.length)fail('tetrad.conflict');}
function listBlock(content:string,nl:string,prefix='- '):string{
 const indent=' '.repeat(prefix.replace(/\t/gu,'    ').length);
 return contentText(content,nl).split(nl).map((line,index)=>index?(line?indent+line:''):prefix+line).join(nl);
}
function itemPrefix(entry:TetradEntry):string{
 const item=markdownParser.parse(entry.markdown).topNode.firstChild?.getChild('ListItem'),mark=item?.getChild('ListMark');
 return mark?entry.markdown.slice(0,mark.to)+' ':'- ';
}
function singleEntry(markdown:string,core=false):TetradEntry{
 if(!markdown.trim())fail(core?'tetrad.coreRequired':'tetrad.entryEmpty');
 const model=tetradEntries(markdown),entry=model.entries[0];
 if(!entry||model.entries.length!==1||entry.markdown!==markdown||model.references||model.footnotes)fail(core?'tetrad.coreParagraph':'tetrad.entryStructureChanged');
 if(core&&entry.block!=='Paragraph')fail('tetrad.coreParagraph');return entry;
}
interface ExpectedEntry {block:string;markdown:string;kind:'core'|'gloss'}
function validateEntries(body:string,expected:readonly ExpectedEntry[]):string{
 const model=tetradEntries(body);
 if(model.entries.length!==expected.length||expected.some((entry,index)=>{
  const actual=model.entries[index];return !actual||actual.block!==entry.block||actual.markdown!==entry.markdown||actual.kind!==entry.kind;
 }))fail('tetrad.entryStructureChanged');
 return body;
}
function removeEntries(body:string,entries:readonly TetradEntry[]):string{
 for(const entry of [...entries].sort((a,b)=>b.from-a.from)){
  body=joinBlocks(body.slice(0,entry.from),body.slice(entry.to),newline(body));
 }return body;
}
/** Normalize only the separators touched by a mutation. Repeated moves must
 * not accumulate blank lines; adjacent existing list items can remain tight. */
function joinBlocks(before:string,after:string,nl:string):string{
 before=before.replace(/(?:\r?\n[ \t]*)+$/u,'');after=after.replace(/^(?:[ \t]*\r?\n)+/u,'');
 if(!before||!after)return before+after;
 const left=tetradEntries(before).entries.at(-1),right=tetradEntries(after).entries[0];
 const tight=left?.block==='ListItem'&&left.to===before.length&&right?.block==='ListItem'&&right.from===0;
 return before+nl.repeat(tight?1:2)+after;
}
function insertBlock(body:string,at:number,markdown:string):string{
 const nl=newline(body);return joinBlocks(joinBlocks(body.slice(0,at),markdown,nl),body.slice(at),nl);
}
function slotOffset(model:TetradEntries,at:number):number{return model.entries[at]?.from??model.entries[model.entries.length-1]?.to??0;}
function replacementEntries(markdown:string,core=false):ExpectedEntry[]{
 if(!markdown.trim())fail(core?'tetrad.coreRequired':'tetrad.entryEmpty');
 const model=tetradEntries(markdown);
 if(!model.entries.length||model.references||model.footnotes||model.entries[0]!.from!==0||model.entries.at(-1)!.to!==markdown.length)fail('tetrad.entryStructureChanged');
 if(core&&model.entries[0]!.block!=='Paragraph')fail('tetrad.coreParagraph');
 return model.entries.map((entry,index)=>({block:entry.block,markdown:entry.markdown,kind:core&&index===0?'core':'gloss'}));
}
/** The original Tetrader contract: first paragraph = core, further paragraphs
 * = outward glosses. Soft/hard line breaks stay inside their paragraph. */
export function applyTetradEntry(body:string,operation:TetradEntryOperation):string{
 if(body!==operation.expectedBody)fail('tetrad.conflict');
 const model=tetradEntries(body),nl=newline(body),expected:ExpectedEntry[]=model.entries.map(entry=>({block:entry.block,markdown:entry.markdown,kind:entry.kind}));
 switch(operation.kind){
  case 'setCore':{
   const value=operation.markdown.trim()?operation.markdown:operation.corePlaceholder??t('tetrad.corePlaceholder');
   if(model.core)return applyTetradEntry(body,{kind:'edit',index:model.core.index,markdown:value,expectedBody:body,corePlaceholder:operation.corePlaceholder});
   const markdown=contentText(value,nl),entries=replacementEntries(markdown,true);
   return validateEntries(insertBlock(body,0,markdown),[...entries,...expected]);
  }
  case 'edit':{
   const entry=requireEntry(model,operation.index);
   if(!operation.markdown.trim()){if(entry.kind==='core')return applyTetradEntry(body,{kind:'setCore',markdown:operation.corePlaceholder??t('tetrad.corePlaceholder'),expectedBody:body});return applyTetradEntry(body,{kind:'delete',indices:[entry.index],expectedBody:body});}
   const markdown=entry.block==='ListItem'?listBlock(operation.markdown,nl,itemPrefix(entry)):contentText(operation.markdown,nl);
   const replacements=entry.block==='ListItem'?[{block:singleEntry(markdown).block,markdown,kind:entry.kind}]:replacementEntries(markdown,entry.kind==='core');
   expected.splice(entry.index,1,...replacements);
   return validateEntries(body.slice(0,entry.from)+markdown+body.slice(entry.to),expected);
  }
  case 'insert':{
   requireSlot(model,operation.at);if(!operation.markdown.trim())return body;
   if(!model.core){const anchored=applyTetradEntry(body,{kind:'setCore',markdown:operation.corePlaceholder??t('tetrad.corePlaceholder'),expectedBody:body});return applyTetradEntry(anchored,{...operation,at:operation.at+1,expectedBody:anchored});}
   const markdown=contentText(operation.markdown,nl),entries=replacementEntries(markdown);
   expected.splice(operation.at,0,...entries);
   return validateEntries(insertBlock(body,slotOffset(model,operation.at),markdown),expected);
  }
  case 'delete':{
   const selected=[...new Set(operation.indices)].map(index=>requireEntry(model,index));
   if(selected.some(entry=>entry.kind==='core'))fail('tetrad.coreRequired');
   const removed=new Set(selected.map(entry=>entry.index));
   return validateEntries(removeEntries(body,selected),expected.filter((_entry,index)=>!removed.has(index)));
  }
  case 'move':{
   const entry=requireEntry(model,operation.index);requireSlot(model,operation.to);
   if(entry.kind==='core')fail('tetrad.coreRequired');
   if(operation.to===entry.index||operation.to===entry.index+1)return body;
   const without=removeEntries(body,[entry]),remaining=tetradEntries(without),at=operation.to>entry.index?operation.to-1:operation.to;
   const [moved]=expected.splice(entry.index,1);expected.splice(at,0,moved!);
   return validateEntries(insertBlock(without,slotOffset(remaining,at),entry.markdown),expected);
  }
 }
}
/** Delegate final ownership validation to the existing Tetrad section writer. */
export function editTetradEntries(source:string,pattern:TetradPattern,law:LawId,operation:TetradEntryOperation):string{
 const body=parseSource(source,pattern).sections.get(law)?.body??'';
 return editSection(source,pattern,law,applyTetradEntry(body,{...operation,corePlaceholder:pattern.headings[law]}));
}
