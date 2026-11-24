// @vitest-environment jsdom
import {beforeEach,describe,it,expect} from 'vitest';
import {readerTextOffset,readerPointer} from '../src/companion/reader-caret';
import {installDomHelpers} from './helpers/dom';

beforeEach(()=>{installDomHelpers();document.body.empty();});
function rendered(parts:string[]):HTMLElement{
 const content=document.body.createDiv();for(const part of parts)content.createSpan({text:part});return content;
}
describe('rendered card to Markdown caret',()=>{
 it('distinguishes repeated words across formatting and paragraphs',()=>{
  const source='Same **word**.\n\nSame word again.',content=rendered(['Same ','word','.','Same word again.']),target=content.lastChild!.firstChild!;
  expect(readerTextOffset(content,source,target,7)).toBe(source.lastIndexOf('word')+2);
  expect(readerTextOffset(content,source,content.children[1]!.firstChild!,4)).toBe(source.indexOf('word')+4);
 });
 it('skips syntax and link destinations while retaining labels, wiki aliases and internal lists',()=>{
  const source='[Label](https://example.org) and [[Target|Label]].\n\n- **Label** end',content=rendered(['Label',' and ','Label','.','Label',' end']);
  expect(readerTextOffset(content,source,content.children[2]!.firstChild!,2)).toBe(source.indexOf('|Label')+3);
  expect(readerTextOffset(content,source,content.children[4]!.firstChild!,2)).toBe(source.indexOf('**Label')+4);
 });
 it('maps entities and escaped punctuation, including non-BMP characters',()=>{
  const source='A &amp; B \\*literal\\* &#x1F642; end',content=rendered(['A & B *literal* 🙂 end']),target=content.firstChild!.firstChild!;
  expect(readerTextOffset(content,source,target,3)).toBe(source.indexOf(';')+1);
  expect(readerTextOffset(content,source,target,8)).toBe(source.indexOf('literal')+1);
  expect(readerTextOffset(content,source,target,target.textContent!.indexOf('end'))).toBe(source.indexOf('end'));
 });
 it('leaves Markdown characters and entities literal inside code',()=>{
  const source='`[[Target|alias]] &amp;`\n\n```md\n- **literal**\n```',content=rendered(['[[Target|alias]] &amp;','- **literal**\n']);
  expect(readerTextOffset(content,source,content.children[0]!.firstChild!,3)).toBe(4);
  expect(readerTextOffset(content,source,content.children[1]!.firstChild!,5)).toBe(source.indexOf('- **literal')+5);
 });
 it('ignores HTML comments and generated list markers',()=>{
  const source='First <!-- invisible --> word\n\n- word',content=rendered(['First ',' word','word']),last=content.lastChild,bullet=content.createSpan({cls:'list-bullet',text:'•'});content.insertBefore(bullet,last);
  expect(readerTextOffset(content,source,content.lastChild!.firstChild!,2)).toBe(source.lastIndexOf('word')+2);
 });
 it('returns a native-coordinate fallback for custom rendered content',()=>{
  const content=rendered(['custom widget']);expect(readerTextOffset(content,'![[Embedded note]]',content.firstChild!.firstChild!,2)).toBeUndefined();
  expect(readerPointer(content,'text',new MouseEvent('dblclick',{clientX:22,clientY:35}))).toEqual({x:22,y:35,offset:undefined});
 });
});
