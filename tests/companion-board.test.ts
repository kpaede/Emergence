import {describe,it,expect} from 'vitest';
import {thoughtIndex,branchPath,columnWindow,selectionRoots} from '../src/companion/board-model';
import {cachedOutline} from '../src/companion/native-outline';
import {validStorage,defaultCompanionStorage} from '../src/companion/preferences';
import type {Thought} from '../src/companion/model';
function node(id:string,parent?:string):Thought{return {id,parent,section:'section',from:0,to:0,lineFrom:0,lineTo:0,indent:'',text:id,marker:'-'};}
describe('Large companion thought branches',()=>{
 it('navigates a thousand levels without recursive rendering or losing ancestors',()=>{const nodes=Array.from({length:1000},(_,n)=>node(String(n),n?String(n-1):undefined)),index=thoughtIndex(nodes);expect(branchPath(index,'999')).toHaveLength(1000);expect(index.children.get('998')?.[0]?.id).toBe('999');expect(branchPath(index,'0').map(n=>n.id)).toEqual(['0']);});
 it('provides all sibling pages instead of truncating at 500 thoughts',()=>{const nodes=Array.from({length:1301},(_,n)=>node(String(n)));const visible:string[]=[];for(let start=0;start<nodes.length;start+=60){const page=columnWindow(nodes,'',start);expect(page.nodes.length).toBeLessThanOrEqual(60);visible.push(...page.nodes.map(n=>n.id));}expect(visible).toEqual(nodes.map(n=>n.id));expect(columnWindow(nodes,'1299').nodes.some(n=>n.id==='1299')).toBe(true);});
 it('moves a selected parent and sibling once while preserving their selected descendants',()=>{const nodes=[node('a'),node('b','a'),node('c','b'),node('d')];expect(selectionRoots(thoughtIndex(nodes),new Set(nodes.map(n=>n.id))).map(n=>n.id)).toEqual(['a','d']);});
});
describe('Companion metadata and defaults',()=>{
 it('builds the heading hierarchy from the native Obsidian heading cache',()=>{const source='# A\ntext\n### B\nchild\n# C\n',cache=[{heading:'A',level:1,position:{start:{line:0,col:0,offset:0},end:{line:0,col:3,offset:3}}},{heading:'B',level:3,position:{start:{line:2,col:0,offset:9},end:{line:2,col:5,offset:14}}},{heading:'C',level:1,position:{start:{line:4,col:0,offset:21},end:{line:4,col:3,offset:24}}}];expect(cachedOutline(source,cache).map(h=>[h.title,h.level,h.parent])).toEqual([['A',1,-1],['B',3,0],['C',1,-1]]);});
 it('validates default paths and single child-folder names',()=>{expect(validStorage(defaultCompanionStorage())).toBe(true);for(const subfolder of ['','../Notes','/Notes','Notes/Child','.hidden'])expect(validStorage({...defaultCompanionStorage(),subfolder})).toBe(false);});
});
