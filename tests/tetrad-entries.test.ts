import {describe,expect,it} from 'vitest';
import {applyTetradEntry,editTetradEntries,tetradEntries,type TetradEntryChange} from '../src/tetrad/entries';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {editSection,parseSource,starter} from '../src/tetrad/source';

const apply=(body:string,change:TetradEntryChange):string=>applyTetradEntry(body,{...change,expectedBody:body});
const contents=(body:string):string[]=>tetradEntries(body).entries.map(entry=>entry.content);

describe('Tetrad AST entries',()=>{
 it('uses the first direct paragraph as core and retains independent rich Markdown blocks',()=>{
  const body='> Quote\n> continuation\n\nCore **bold**\nsecond line [[Notiz]]\n\nGloss\n\n```md\n## Enhances\n- code\n```\n\n| A | B |\n| - | - |\n| C | D |';
  const model=tetradEntries(body);expect(model.entries.map(entry=>entry.block)).toEqual(['Blockquote','Paragraph','Paragraph','FencedCode','Table']);expect(model.core?.index).toBe(1);expect(model.core?.content).toBe('Core **bold**\nsecond line [[Notiz]]');expect(model.glosses.map(entry=>entry.index)).toEqual([0,2,3,4]);
 });
 it('splits only direct list items and keeps continuations, paragraphs and descendants together',()=>{
  const body='Core\n\n- First [[Link]]\n  continuation\n\n  Next paragraph\n  - Child\n    - Grandchild\n\n  > Quote\n- Second';
  const model=tetradEntries(body);expect(model.entries.map(entry=>entry.block)).toEqual(['Paragraph','ListItem','ListItem']);expect(model.entries[1]?.content).toBe('First [[Link]]\ncontinuation\n\nNext paragraph\n- Child\n  - Grandchild\n\n> Quote');expect(model.entries[1]?.markdown).toContain('    - Grandchild');expect(model.entries[2]?.content).toBe('Second');
 });
 it('reports effective ordered list numbers without rewriting marker text',()=>{
  const model=tetradEntries('Core\n\n4. A\n1. B\n1. C');expect(model.glosses.map(entry=>entry.order)).toEqual([4,5,6]);expect(model.glosses.map(entry=>entry.content)).toEqual(['A','B','C']);expect(model.glosses[1]?.markdown).toBe('1. B');
 });
 it('keeps task markers in editable list content',()=>{
  const model=tetradEntries('Core\n\n- [x] Completed\n- [ ] Open');expect(model.glosses.map(entry=>entry.content)).toEqual(['[x] Completed','[ ] Open']);
 });
 it('returns exact UTF-16 ranges and code indentation, including CRLF',()=>{
  const body='Kern 🦋\r\n\r\n    literal [[Notiz]]\r\n    second line\r\n\r\n- Äußeres\r\n  - Kind';
  const model=tetradEntries(body);for(const entry of model.entries)expect(body.slice(entry.from,entry.to)).toBe(entry.markdown);expect(model.glosses[0]?.block).toBe('CodeBlock');expect(model.glosses[0]?.markdown).toBe('    literal [[Notiz]]\r\n    second line');expect(model.glosses[1]?.content).toBe('Äußeres\r\n- Kind');
 });
 it('preserves reference definitions and comments without inventing visible rows',()=>{
  const body='[ref]: Target.md "Title"\n\n<!-- invisible -->\n\nCore [link][ref]\n\n- Gloss\n\n[other]: Other.md';
  const model=tetradEntries(body);expect(model.entries).toHaveLength(2);expect(model.references).toContain('[ref]: Target.md "Title"');expect(model.references).toContain('[other]: Other.md');expect(model.core?.markdown).toBe('Core [link][ref]');
 });
 it('treats native math as a block and footnote definitions as shared invisible context',()=>{
  const body='$$\nx = 1\n\n+ 2\n$$\n\n[^foot]: Two words and [[Notiz]]\n\n    Second paragraph\n\nCore [^foot]\n\n$$x = 2$$';
  const model=tetradEntries(body);expect(model.entries.map(entry=>entry.block)).toEqual(['BlockMath','Paragraph','BlockMath']);expect(model.core?.markdown).toBe('Core [^foot]');expect(model.footnotes).toContain('    Second paragraph');expect(model.references).toBe('');
 });
 it('does not activate math or footnote hooks inside fenced code',()=>{
  const model=tetradEntries('```md\n$$\n[^foot]: Example\n```\n\nCore');expect(model.entries.map(entry=>entry.block)).toEqual(['FencedCode','Paragraph']);expect(model.footnotes).toBe('');expect(model.core?.index).toBe(1);
 });
});

describe('Tetrad entry mutations',()=>{
 it('edits one legacy paragraph while retaining every other source block',()=>{
  const body='Core\n\nFirst\n\n> Quotation\n\nLast',edited=apply(body,{kind:'edit',index:1,markdown:'Changed [[Notiz]]'});
  expect(edited).toBe(body.replace('First','Changed [[Notiz]]'));expect(contents(edited)).toEqual(['Core','Changed [[Notiz]]','> Quotation','Last']);
 });
 it('edits a list item through its content and retains marker style and nested Markdown',()=>{
  const body='Core\n\n3. Original\n4. Other',content='Changed [[Notiz]]\n\nSecond paragraph\n\n- Child\n  - Grandchild\n\n```md\n## Reverses into\n```',edited=apply(body,{kind:'edit',index:1,markdown:content});
  expect(edited).toContain('3. Changed [[Notiz]]');expect(edited).toContain('4. Other');expect(tetradEntries(edited).entries).toHaveLength(3);expect(tetradEntries(edited).entries[1]?.content).toBe(content);
 });
 it('inserts plain paragraphs using the original Tetrader structure and retains line breaks',()=>{
  const body='Core\n\nExisting',edited=apply(body,{kind:'insert',at:1,markdown:'New first line\nSecond line\n\nAnother paragraph'}),model=tetradEntries(edited);
  expect(model.entries.map(entry=>entry.block)).toEqual(['Paragraph','Paragraph','Paragraph','Paragraph']);expect(contents(edited)).toEqual(['Core','New first line\nSecond line','Another paragraph','Existing']);expect(edited).not.toContain('- ');
 });
 it('appends a paragraph after an existing list without turning it into a bullet',()=>{
  const edited=apply('Core\n\n- A',{kind:'insert',at:2,markdown:'B'});expect(contents(edited)).toEqual(['Core','A','B']);expect(tetradEntries(edited).entries[2]!.block).toBe('Paragraph');
 });
 it('uses the agreed core text when the first edit is an outer paragraph, while preserving an existing core',()=>{
  const result=applyTetradEntry('',{kind:'insert',at:0,markdown:'A',expectedBody:'',corePlaceholder:'Enhances'});expect(contents(result)).toEqual(['Enhances','A']);expect(()=>apply('Core\n\nLegacy',{kind:'insert',at:0,markdown:'New'})).toThrow();
 });
 it('sets a missing core and edits an existing one without modifying glosses or definitions',()=>{
  const body='[ref]: Target.md\n\n- A\n- B',withCore=apply(body,{kind:'setCore',markdown:'Core [x][ref]'});expect(contents(withCore)).toEqual(['Core [x][ref]','A','B']);expect(withCore).toContain('[ref]: Target.md');expect(contents(apply(withCore,{kind:'setCore',markdown:'Changed'}))).toEqual(['Changed','A','B']);
 });
 it('resets a cleared core to its basic text without promoting a gloss',()=>{
  const body='Core\n\nLegacy\n\n- Item';expect(contents(applyTetradEntry(body,{kind:'setCore',markdown:'',expectedBody:body,corePlaceholder:'Enhances'}))).toEqual(['Enhances','Legacy','Item']);for(const change of [{kind:'delete',indices:[0]},{kind:'move',index:0,to:3}] as TetradEntryChange[])expect(()=>apply(body,change)).toThrow();expect(contents(body)).toEqual(['Core','Legacy','Item']);
 });
 it('moves individual list items, including every descendant and continuation',()=>{
  const body='Core\n\n- A [[Link]]\n\n  Second paragraph\n  - Child\n    - Grandchild\n- B\n- C',original=tetradEntries(body).entries[1]!.markdown,moved=apply(body,{kind:'move',index:1,to:4}),model=tetradEntries(moved);
  expect(model.entries.map(entry=>entry.content.split('\n')[0])).toEqual(['Core','B','C','A [[Link]]']);expect(model.entries[3]?.markdown).toBe(original);expect(contents(apply(moved,{kind:'move',index:3,to:1}))).toEqual(contents(body));
 });
 it('allows safe legacy gloss movement but rejects promotion before the core',()=>{
  const body='Core\n\nA\n\nB';expect(contents(apply(body,{kind:'move',index:2,to:1}))).toEqual(['Core','B','A']);expect(()=>apply(body,{kind:'move',index:2,to:0})).toThrow();
 });
 it('keeps adjacent self-drops as exact no-ops',()=>{
  const body='Core\n\n- A\n- B';expect(apply(body,{kind:'move',index:1,to:1})).toBe(body);expect(apply(body,{kind:'move',index:1,to:2})).toBe(body);
 });
 it('deletes selected entries once and preserves comments, footnotes and reference context',()=>{
  const body='Core [^f]\n\n- A\n- B\n\n<!-- keep -->\n\nLast\n\n[ref]: Target.md\n\n[^f]: Footnote text',edited=apply(body,{kind:'delete',indices:[1,2,1]});expect(contents(edited)).toEqual(['Core [^f]','Last']);expect(edited).toContain('<!-- keep -->');expect(tetradEntries(edited).references).toContain('[ref]: Target.md');expect(tetradEntries(edited).footnotes).toContain('[^f]: Footnote text');
 });
 it('preserves hidden source data when moving a block',()=>{
  const body='Core\n\n<!-- keep -->\n\n- A\n- B\n\n[ref]: Target.md',edited=apply(body,{kind:'move',index:1,to:3});expect(contents(edited)).toEqual(['Core','B','A']);expect(edited).toContain('<!-- keep -->');expect(edited).toContain('[ref]: Target.md');
 });
 it('rejects stale snapshots and invalid indexes before applying changes',()=>{
  const body='Core\n\n- A';for(const change of [{kind:'edit',index:1,markdown:'X'},{kind:'insert',at:2,markdown:'X'},{kind:'delete',indices:[1]},{kind:'move',index:1,to:0},{kind:'setCore',markdown:'X'}] as TetradEntryChange[])expect(()=>applyTetradEntry(body,{...change,expectedBody:body+'\nExtern'})).toThrow();
  for(const change of [{kind:'edit',index:5,markdown:'X'},{kind:'insert',at:-1,markdown:'X'},{kind:'delete',indices:[0.5]},{kind:'move',index:1,to:3}] as TetradEntryChange[])expect(()=>apply(body,change)).toThrow();
 });
 it('rejects an edit that would consume or split unrelated source entries',()=>{
  const body='Core\n\n> Legacy quote\n\nOther';expect(()=>apply(body,{kind:'edit',index:1,markdown:'```md'})).toThrow();expect(apply(body,{kind:'insert',at:1,markdown:''})).toBe(body);
 });
 it('splits edited paragraph text into paragraphs without changing the following entries',()=>{
  const body='Core\n\nLegacy\n\nOther',edited=apply(body,{kind:'edit',index:1,markdown:'One\nline two\n\nTwo'});
  expect(contents(edited)).toEqual(['Core','One\nline two','Two','Other']);expect(edited).not.toContain('- ');
 });
 it('keeps the first edited core paragraph at the center and adds following paragraphs outward',()=>{
  const edited=apply('Core\n\nExisting',{kind:'setCore',markdown:'One\nline two\n\nTwo\n\nThree'});expect(contents(edited)).toEqual(['One\nline two','Two','Three','Existing']);expect(tetradEntries(edited).core?.content).toBe('One\nline two');
 });
 it('does not accumulate blank lines through repeated paragraph moves',()=>{
  const original='Core\n\nOne\n\nTwo';let body=original;for(let n=0;n<20;n++){body=apply(body,{kind:'move',index:1,to:3});body=apply(body,{kind:'move',index:2,to:1});}expect(body).toBe(original);
 });
 it('keeps existing adjacent list items tight through repeated moves',()=>{
  const original='Core\n\n- One\n- Two';let body=original;for(let n=0;n<10;n++){body=apply(body,{kind:'move',index:1,to:3});body=apply(body,{kind:'move',index:2,to:1});}expect(body).toBe(original);
 });
 it('keeps CRLF throughout changed list entries and inserted rows',()=>{
  const body='Core\r\n\r\n- A\r\n- B',edited=apply(body,{kind:'edit',index:1,markdown:'Changed\n\n- Child'}),inserted=apply(edited,{kind:'insert',at:3,markdown:'C'});expect(inserted.replace(/\r\n/gu,'')).not.toContain('\n');expect(tetradEntries(inserted).entries).toHaveLength(4);
 });
});

describe('Tetrad entry section ownership',()=>{
 it('changes only the selected body and retains the source format and other areas',()=>{
  const pattern=DEFAULT_PATTERN,original=editSection(starter(pattern,'Test','bold'),pattern,'enhances','Core\n\n- A\n- B'),body=parseSource(original,pattern).sections.get('enhances')!.body;
  const updated=editTetradEntries(original,pattern,'enhances',{kind:'move',index:1,to:3,expectedBody:body});expect(contents(parseSource(updated,pattern).sections.get('enhances')!.body)).toEqual(['Core','B','A']);expect(parseSource(updated,pattern).format).toBe('bold');for(const law of ['reverses','retrieves','obsolesces'] as const)expect(parseSource(updated,pattern).sections.get(law)?.body).toBe(parseSource(original,pattern).sections.get(law)?.body);
 });
 it('rejects section titles inserted as new paragraphs without affecting other sections',()=>{
  const pattern=DEFAULT_PATTERN,original=starter(pattern),body=parseSource(original,pattern).sections.get('enhances')!.body;
  expect(()=>editTetradEntries(original,pattern,'enhances',{kind:'insert',at:1,markdown:'## Reverses into\n\n[[Notiz]]',expectedBody:body})).toThrow();expect(parseSource(original,pattern).sections.size).toBe(4);
 });
});
