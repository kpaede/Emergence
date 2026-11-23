import {describe,expect,it} from 'vitest';
import {rebaseTetradDrop} from '../src/tetrad/drag-rebase';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {editSection,starter} from '../src/tetrad/source';

const source=editSection(starter(DEFAULT_PATTERN),DEFAULT_PATTERN,'enhances','Core\n\nOne\n\nTwo\n\nThree');
function changed(body:string){return editSection(source,DEFAULT_PATTERN,'enhances',body);}
describe('Tetrad drops after saving a field during the drag',()=>{
 it('uses updated text when moving the edited entry',()=>{
  const current=changed('Core\n\nUpdated one\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',1,'enhances',4,{source:current,law:'enhances',at:1})).toEqual({index:1,slot:4});
 });
 it('keeps the intended entry and boundary when a preceding entry is removed',()=>{
  const current=changed('Core\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',3,'enhances',2,{source:current,law:'enhances',at:1})).toEqual({index:2,slot:1});
 });
 it('accounts for splitting a preceding edited paragraph into multiple blocks',()=>{
  const current=changed('Core\n\nOne A\n\nOne B\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',3,'enhances',2,{source:current,law:'enhances',at:1})).toEqual({index:4,slot:3});
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',1,'enhances',4,{source:current,law:'enhances',at:1})).toEqual({index:1,slot:5,count:2});
 });
 it('accounts for additional paragraphs entered in an existing core',()=>{
  const current=changed('Updated core\n\nAdditional paragraph\n\nOne\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',3,'enhances',2,{source:current,law:'enhances',at:0})).toEqual({index:4,slot:3});
 });
 it('accounts for a just-added paragraph and leaves other wings unchanged',()=>{
  const current=changed('Core\n\nAdded\n\nOne\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',1,'retrieves',1,{source:current,law:'enhances',at:1,inserted:true})).toEqual({index:2,slot:1});
 });
 it('identifies a new entry itself without mistaking its previous neighbor for the drag source',()=>{
  const current=changed('Core\n\nAdded A\n\nAdded B\n\nOne\n\nTwo\n\nThree');
  expect(rebaseTetradDrop(source,current,DEFAULT_PATTERN,'enhances',1,'enhances',4,{source:current,law:'enhances',at:1,inserted:true},true)).toEqual({index:1,slot:6,count:2});
  expect(rebaseTetradDrop(source,source,DEFAULT_PATTERN,'enhances',1,'retrieves',1,undefined,true).count).toBe(0);
 });
 it.each(['enhances','reverses','retrieves','obsolesces'] as const)('keeps a just-used insertion gap on its visible side in %s',law=>{
  const original=editSection(starter(DEFAULT_PATTERN),DEFAULT_PATTERN,law,'Core\n\nOne\n\nTwo'),current=editSection(original,DEFAULT_PATTERN,law,'Core\n\nAdded\n\nOne\n\nTwo');
  expect(rebaseTetradDrop(original,current,DEFAULT_PATTERN,law,2,law,1,{source:current,law,at:1,inserted:true})).toEqual({index:3,slot:law==='enhances'||law==='reverses'?1:2});
 });
 it('accounts for a core seeded in a legacy wing without promoting a gloss',()=>{
  const original=changed('> Quotation one\n\n> Quotation two'),current=changed('Core\n\nAdded\n\n> Quotation one\n\n> Quotation two');
  expect(rebaseTetradDrop(original,current,DEFAULT_PATTERN,'enhances',1,'enhances',0,{source:current,law:'enhances',at:0,inserted:true})).toEqual({index:3,slot:1});
 });
 it('rejects an external change instead of rebasing an unrecognized file version',()=>{
  const own=changed('Core\n\nUpdated one\n\nTwo\n\nThree'),external=changed('Core\n\nUnknown\n\nTwo\n\nThree');
  expect(()=>rebaseTetradDrop(source,external,DEFAULT_PATTERN,'enhances',3,'retrieves',1,{source:own,law:'enhances',at:1})).toThrow();
 });
});
