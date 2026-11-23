import {describe,expect,it} from 'vitest';
import {DEFAULT_PATTERN,type TetradPattern} from '../src/tetrad/patterns';
import {editFormat,editSection,parseSource,starter,tetradBlocks,type TetradFormat} from '../src/tetrad/source';

const pattern=DEFAULT_PATTERN;
const source=(body:string):string=>'> [!tetrad] Thema\n'+body.split('\n').map(line=>line?'> '+line:'>').join('\n')+'\n';
const bodies=(text:string):unknown=>[...parseSource(text,pattern).sections].map(([law,section])=>[law,section.body]);

describe('Tetrad source section formats',()=>{
 it('accepts each heading level and obtains its level from the source',()=>{
  for(let level=1;level<=6;level++){
   const document=parseSource(source('#'.repeat(level)+' Enhances\nA\n\n'+'#'.repeat(level)+' Reversal\nB'),pattern);
   expect(document.format).toBe('headings');expect(document.level).toBe(level);expect(document.sections.get('reverses')?.label).toBe('Reversal');
  }
 });
 it('refuses different levels among actual section headings',()=>{
  expect(()=>parseSource(source('## Enhances\nA\n### Reverses into\nB'),pattern)).toThrow();
  expect(parseSource(source('## Enhances\nA\n### An ordinary subheading\nB'),pattern).sections.size).toBe(1);
 });
 it('recognizes bold and underscore paragraphs with original label spelling',()=>{
  const document=parseSource(source('**ENHANCEMENT:**\n\nA\n\n__Reversal__\n\nB'),pattern);
  expect(document.format).toBe('bold');expect(document.level).toBeUndefined();expect(document.sections.get('enhances')?.label).toBe('ENHANCEMENT:');expect(document.sections.get('reverses')?.body).toBe('B');
 });
 it('does not treat bold spans or lines inside a longer paragraph as section markers',()=>{
  for(const body of ['**Enhances** is part of a sentence','**Enhances**\nThis continues the paragraph','A paragraph\n**Enhances**\n'])expect(parseSource(source(body),pattern).sections.size).toBe(0);
 });
 it('recognizes bold paragraphs adjacent to other Markdown blocks',()=>{
  const document=parseSource(source('```md\nExample\n```\n**Enhances**\n- Item\n\n**Reverses into**\n\nB'),pattern);expect(document.format).toBe('bold');expect(document.sections.get('enhances')?.body).toBe('- Item');expect(document.sections.get('reverses')?.body).toBe('B');
 });
 it('rejects mixed heading/bold formats and duplicate aliases',()=>{
  for(const body of ['## Enhances\nA\n\n**Reverses into**\n\nB','**Enhances**\n\nA\n## Reverses into\nB','**Enhances**\n\nA\n\n__Enhancement__\n\nB'])expect(()=>parseSource(source(body),pattern)).toThrow();
 });
 it('preserves rich Markdown, Setext, HTML and link headings inside their actual source body',()=>{
  const body='A\n\nReverses into\n---\nB\n\n<h2>Retrieves</h2>\nC\n\n## [Obsolesces](Target.md)\nD\n\n[[Notiz]]\n\n- Liste\n  - Unterpunkt';
  const document=parseSource(source('## Enhances\n'+body),pattern);
  expect([...document.sections.keys()]).toEqual(['enhances']);expect(document.sections.get('enhances')?.body).toBe(body);
 });
 it('ignores section-like text inside nested quotes, lists, code and HTML comments',()=>{
  const body='A\n\n> ## Reverses into\n\n- Item\n\n  ## Retrieves\n  nested\n\n```md\n## Obsolesces\n**Retrieves**\n\n```\n\n<!--\n## Reverses into\n-->\n\n<div>\n## Retrieves\n</div>\n';
  const document=parseSource(source('## Enhances\n'+body),pattern);expect([...document.sections.keys()]).toEqual(['enhances']);expect(document.sections.get('enhances')?.body).toContain('## Retrieves');
 });
 it('keeps inline code containing comment syntax from swallowing later sections',()=>{
  const document=parseSource(source('## Enhances\nLiteral `<!--`\n\n## Reverses into\nB'),pattern);expect(document.sections.size).toBe(2);
 });
 it('does not activate HTML comments written inside nested or indented code examples',()=>{
  for(const example of ['> ```html\n> <!--\n> ```','- Code:\n\n  ```html\n  <!--\n  ```','    <!--','```md <!--\nLiteral\n```']){
   const document=parseSource(source('## Enhances\nA\n\n'+example+'\n\n## Reverses into\nB'),pattern);expect(document.sections.get('reverses')?.body).toBe('B');
  }
 });
 it('retains CRLF source offsets and marker bytes when editing a body',()=>{
  const original=source('__Enhancement__\n\nA\n\n**Reversal**\n\nB').replace(/\n/gu,'\r\n'),section=parseSource(original,pattern).sections.get('enhances')!;
  const edited=editSection(original,pattern,'enhances','Neu\n\n[[Notiz]]');
  expect(edited.startsWith(original.slice(0,section.from))).toBe(true);expect(edited.endsWith(original.slice(section.to))).toBe(true);expect(edited.replace(/\r\n/gu,'')).not.toContain('\n');expect(parseSource(edited,pattern).sections.get('enhances')?.body).toBe('Neu\n\n[[Notiz]]');
 });
});

describe('Tetrad source writers preserve ownership',()=>{
 it('creates valid starters in both formats',()=>{
  for(const format of ['headings','bold'] as const){const text=starter(pattern,'Test',format),document=parseSource(text,pattern);expect(document.format).toBe(format);expect(document.sections.size).toBe(4);for(const [law,section]of document.sections)expect(editSection(text,pattern,law,section.body)).toBe(text);}
 });
 it('adds missing sections in the detected format and heading level',()=>{
  const headings=editSection(source('##### Enhancement\nA'),pattern,'retrieves','C');expect(headings).toContain('> ##### Retrieves');expect(parseSource(headings,pattern).level).toBe(5);
  const bold=editSection(source('__Enhances__\n\nA'),pattern,'retrieves','C');expect(bold).toContain('> **Retrieves**\n>\n> C');expect(parseSource(bold,pattern).format).toBe('bold');
 });
 it('converts formats explicitly, retaining all bodies, aliases, order, and CRLF',()=>{
  const original=source('Vorwort\n\n### Reversal\nB\n\n### ENHANCEMENT:\nA\n\n- Item\n  - Nested').replace(/\n/gu,'\r\n');
  const bold=editFormat(original,pattern,'bold'),headings=editFormat(bold,pattern,'headings',6);
  expect(parseSource(bold,pattern).format).toBe('bold');expect(bold).toContain('> **Reversal**');expect(bodies(bold)).toEqual(bodies(original));expect(bodies(headings)).toEqual(bodies(original));expect(headings).toContain('> ###### ENHANCEMENT:');expect(headings.replace(/\r\n/gu,'')).not.toContain('\n');expect(parseSource(headings,pattern).preamble.trim()).toBe('Vorwort');
 });
 it('does not rewrite unchanged formats or underscore markers',()=>{
  const original=source('__Enhances__\n\nA');expect(editFormat(original,pattern,'bold')).toBe(original);const heading=source('# Enhances\nA');expect(editFormat(heading,pattern,'headings',1)).toBe(heading);
 });
 it('refuses an invented format for a markerless callout',()=>{expect(()=>editFormat(source('Vorwort'),pattern,'bold')).toThrow();});
 it('rejects section markers injected through one body, including previously absent sections',()=>{
  for(const format of ['headings','bold'] as const){
   const original=format==='headings'?source('## Enhances\nA'):source('**Enhances**\n\nA');
   for(const body of ['Neu\n\n## Reverses into\nFremd','Neu\n\n**Reverses into**\n\nFremd'])expect(()=>editSection(original,pattern,'enhances',body)).toThrow();
  }
 });
 it('rejects literal blocks that would swallow a later section',()=>{
  for(const body of ['Neu\n```md','Neu\n<!--','Neu\n<pre>'])expect(()=>editSection(source('## Enhances\nA\n\n## Reverses into\nB'),pattern,'enhances',body)).toThrow();
 });
 it('accepts section-like examples protected by valid code, comments or quotes',()=>{
  const body='Neu\n\n```md\n## Reverses into\n```\n\n<!--\n## Retrieves\n-->\n\n> **Obsolesces**';
  const edited=editSection(starter(pattern),pattern,'enhances',body);expect(parseSource(edited,pattern).sections.get('enhances')?.body).toBe(body);expect(parseSource(edited,pattern).sections.size).toBe(4);
 });
 it('refuses appending a new section inside an unclosed literal block',()=>{
  for(const body of ['## Enhances\nA\n```md','## Enhances\nA\n<!--'])expect(()=>editSection(source(body),pattern,'retrieves','C')).toThrow();
 });
 it('rejects invalid runtime format and level arguments',()=>{
  expect(()=>starter(pattern,'X','other' as TetradFormat)).toThrow();expect(()=>editFormat(starter(pattern),pattern,'headings',7)).toThrow();
 });
});

describe('Tetrad scanner root block ownership',()=>{
 it('ignores YAML, comments, fences, quoted examples, nested quotes and lists',()=>{
  const real=starter(pattern,'Real'),examples=[
   '---\nexample: |\n'+real+'---\n',
   '<!--\n'+real+'-->\n',
   'text <!--\n'+real+'-->\n',
   '```md\n'+real+'```\n',
   '> [!example] Code\n> ```md\n'+real+'> ```\n',
   real.split('\n').filter(Boolean).map(line=>'> '+line).join('\n')+'\n',
   '- Example\n'+real.split('\n').filter(Boolean).map(line=>'  '+line).join('\n')+'\n',
   '<pre>\n'+real+'</pre>\n',
  ];
  for(const example of examples){expect(tetradBlocks(example,[pattern])).toHaveLength(0);const note=example+'\n'+real;expect(tetradBlocks(note,[pattern]).map(block=>block.source)).toEqual([real]);}
 });
 it('does not start a second callout halfway through a root blockquote',()=>{
  expect(tetradBlocks('> Quoted paragraph\n>\n'+starter(pattern),[pattern])).toHaveLength(0);
  expect(tetradBlocks('> Quoted paragraph\nlazy continuation\n'+starter(pattern),[pattern])).toHaveLength(0);
 });
 it('preserves exact ranges, types, and indexes for genuine callouts',()=>{
  const custom:TetradPattern={...pattern,id:'custom'},one=starter(pattern),two=starter(custom,'Other','bold'),note='# Header\n\n'+one+'\n'+two+'\nEnde';
  const blocks=tetradBlocks(note,[pattern,custom]);expect(blocks.map(block=>block.type)).toEqual(['tetrad','custom']);for(const block of blocks){expect(note.slice(block.from,block.to)).toBe(block.source);expect(block.index).toBe(blocks.indexOf(block));expect(parseSource(block.source,block.type==='custom'?custom:pattern).sections.size).toBe(4);}
 });
});
