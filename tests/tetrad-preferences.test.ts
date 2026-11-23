import {tetradEntries} from '../src/tetrad/entries';
import {describe,expect,it} from 'vitest';
import {defaults,migrateSettings,validateSettings} from '../src/config';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {defaultTetradFormat,newTetrad,insertTetrad,validTetradFormat} from '../src/tetrad/preferences';
import {parseSource,tetradBlocks} from '../src/tetrad/source';

describe('tetrad creation defaults',()=>{
 it('keeps old settings compatible and validates the saved preference',()=>{
  expect(defaultTetradFormat(migrateSettings(defaults()))).toBe('headings-2');
  for(const invalid of [null,[],{},'headings-0','headings-7','headings','bold\n'])expect(validTetradFormat(invalid)).toBe(false);
  expect(()=>validateSettings({...defaults(),tetrad:{format:'broken' as never}})).toThrow();
 });
 it('creates all four core and gloss slots with the agreed replaceable text',()=>{
  for(const format of ['bold','headings-1','headings-6'] as const){
   const source=newTetrad(format),doc=parseSource(source,DEFAULT_PATTERN);
   expect(doc.format).toBe(format==='bold'?'bold':'headings');expect(doc.level).toBe(format==='bold'?undefined:Number(format.slice(-1)));
   for(const [law,section]of doc.sections){const model=tetradEntries(section.body);expect(model.core?.content).toBe(DEFAULT_PATTERN.headings[law]);expect(model.glosses.map(entry=>entry.content)).toEqual(['Gloss']);}
  }
 });
 it('uses the same default for insertion while retaining the selected title and CRLF',()=>{
  const title='My title',insert=insertTetrad('Before\r\n','After',title,'bold');
  expect(insert.text.slice(insert.titleOffset,insert.titleOffset+title.length)).toBe(title);
  const block=tetradBlocks(insert.text,[DEFAULT_PATTERN])[0]!;expect(parseSource(block.source,DEFAULT_PATTERN).format).toBe('bold');
  expect(insert.text).not.toMatch(/(?<!\r)\n/u);
 });
});
