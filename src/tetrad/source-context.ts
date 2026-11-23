/** Source offsets always refer to the untouched, quoted Markdown. */
export interface SourceLine {from:number; to:number; text:string}
export function sourceLines(source:string):SourceLine[]{
 let from=0;
 return source.split(/(?<=\n)/u).filter(Boolean).map(raw=>{
  const line={from,to:from+raw.length,text:raw.replace(/\r?\n$/u,'')};from=line.to;return line;
 });
}
export const quotePrefix=/^ {0,3}>[ \t]?/u;
export const unquote=(text:string):string=>text.replace(quotePrefix,'');
const fenceStart=/^ {0,3}(`{3,}|~{3,})(.*)$/u;
const listStart=/^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+)(.*)$/u;
const rawHtml=/^ {0,3}<(script|pre|style|textarea)(?:\s|>|$)/iu;
const htmlBlock=/^ {0,3}<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/iu;
export function interruptsParagraph(text:string):boolean{
 return /^ {0,3}(?:#{1,6}(?:\s|$)|>|[-+*][ \t]+|1[.)][ \t]+|(?:\*[ \t]*){3,}$|(?:-[ \t]*){3,}$|(?:_[ \t]*){3,}$)/u.test(text)
  || fenceStart.test(text)||rawHtml.test(text)||htmlBlock.test(text)||/^ {0,3}<!--/u.test(text);
}
function withoutInlineCode(text:string):string{
 return text.replace(/(`+)(.*?)\1(?!`)/gu,match=>' '.repeat(match.length));
}
/** Recognize direct Markdown blocks only. Nested lists/quotes and literal blocks
 * cannot introduce Tetrad section markers, even if their text matches a label. */
export class MarkdownContext {
 private fence?:string;
 private comment=false;
 private htmlClose?:RegExp;
 private htmlUntilBlank=false;
 private listIndent?:number;
 private blank=true;
 take(text:string,allowQuote=false):boolean{
  const previousBlank=this.blank;this.blank=!text.trim();
  const mark=fenceStart.exec(text);
  if(this.fence){
   if(mark&&mark[1]![0]===this.fence[0]&&mark[1]!.length>=this.fence.length&&!mark[2]!.trim())this.fence=undefined;
   return false;
  }
  if(this.htmlClose){if(this.htmlClose.test(text))this.htmlClose=undefined;return false;}
  if(this.htmlUntilBlank){if(!text.trim())this.htmlUntilBlank=false;return false;}
  if(this.comment){this.comments(text);return false;}
  const indent=/^[ \t]*/u.exec(text)![0].replace(/\t/gu,'    ').length;
  if(this.listIndent!==undefined){
   if(!text.trim()||indent>=this.listIndent)return false;
   if(!previousBlank&&!interruptsParagraph(text)&&!listStart.test(text))return false;
   this.listIndent=undefined;
  }
  if(indent>=4)return false;
  if(/^ {0,3}>/u.test(text))return allowQuote;
  if(mark){
   if(mark[1]![0]!=='`'||!mark[2]!.includes('`'))this.fence=mark[1];
   return false;
  }
  const list=listStart.exec(text);
  if(list){this.listIndent=list[1]!.length+list[2]!.length+list[3]!.replace(/\t/gu,'    ').length;return false;}
  if(this.comments(text))return false;
  const raw=rawHtml.exec(text);
  if(raw){const close=new RegExp('</'+raw[1]+'\\s*>','iu');if(!close.test(text))this.htmlClose=close;return false;}
  if(htmlBlock.test(text)){this.htmlUntilBlank=true;return false;}
  return true;
 }
 private comments(text:string):boolean{
  const masked=withoutInlineCode(text);let offset=0,involved=this.comment;
  while(offset<text.length){
   if(this.comment){const end=text.indexOf('-->',offset);if(end<0)return true;this.comment=false;offset=end+3;}
   else {const start=masked.indexOf('<!--',offset);if(start<0)break;this.comment=true;involved=true;offset=start+4;}
  }
  return involved;
 }
}
