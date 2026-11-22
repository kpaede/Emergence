import {describe,it,expect} from 'vitest';
import {readerMoveTargets} from '../src/companion/reader-move-targets';
import {thoughtIndex,selectionRoots} from '../src/companion/board-model';
import {thoughts} from '../src/companion/thoughts';
import {validReaderDrop} from '../src/companion/reader-model';
import type {CompanionDocument,CompanionSection} from '../src/companion/model';

const section:CompanionSection={id:'s',title:'Section',level:1,state:'linked',format:2,raw:'- A <!-- em-note:a -->\n\t- B <!-- em-note:b -->\n\t\t- C <!-- em-note:c -->\n- D <!-- em-note:d -->\n\t- E <!-- em-note:e -->\n- F <!-- em-note:f -->\n'};
const document:CompanionDocument={id:'doc',source:'Main.md',sections:[section],preamble:'',newline:'\n',original:'',header:''};
describe('outline move destination shortlist',()=>{
 it('excludes a selected entry and every descendant without excluding other branches',()=>{const index=thoughtIndex(thoughts(section));expect(readerMoveTargets(index,new Set(['a'])).map(node=>node.id)).toEqual(['d','e','f']);});
 it('reduces nested selections to their outer roots and preserves destination order',()=>{const index=thoughtIndex(thoughts(section));expect(readerMoveTargets(index,new Set(['b','c','e'])).map(node=>node.id)).toEqual(['a','d','f']);});
 it('offers no destination when every branch is moving',()=>{const index=thoughtIndex(thoughts(section));expect(readerMoveTargets(index,new Set(['a','d','f']))).toEqual([]);expect(readerMoveTargets(index,new Set(['missing']))).toEqual([]);});
 it.each([['a'],['b'],['c'],['b','e'],['b','c','d']])('matches the full validator for selection %j',(...ids)=>{
  const index=thoughtIndex(thoughts(section)),selected=new Set(ids),roots=selectionRoots(index,selected),data={path:'Companion.md',id:roots[0]!.id,section:'s',nodes:roots.map(node=>({id:node.id,section:node.section,parent:node.parent}))};
  const expected=index.nodes.filter(node=>validReaderDrop(document,'Companion.md',data,'s',node.id,'last')||validReaderDrop(document,'Companion.md',data,'s',node.id,'before'));
  expect(readerMoveTargets(index,selected).map(node=>node.id)).toEqual(expected.map(node=>node.id));
 });
 it('handles a large chapter without reading or copying long entry text',()=>{
  const raw=Array.from({length:2000},(_,i)=>'- Entry '+i+' <!-- em-note:n'+i+' -->\n').join(''),index=thoughtIndex(thoughts({...section,raw}));
  for(const node of index.nodes)Object.defineProperty(node,'text',{get:()=>{throw Error('The structural shortlist must not process entry text');}});
  const targets=readerMoveTargets(index,new Set(['n0']));expect(targets).toHaveLength(1999);expect(targets[0]!.id).toBe('n1');expect(targets.at(-1)!.id).toBe('n1999');
 });
});
