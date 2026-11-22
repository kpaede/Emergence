import {describe,it,expect,vi} from 'vitest';
import {nativeSelection} from '../src/companion/native-selection';
import {lineageDocument} from '../src/companion/lineage-adapter';
import {markMultiline} from '../src/companion/multiline';
import {thoughts} from '../src/companion/thoughts';
import type {CompanionSection} from '../src/companion/model';
import type {NativeView} from '../src/companion/native-types';
const section:CompanionSection={id:'s',title:'Chapter',level:1,state:'linked',format:2,raw:markMultiline('- Duplicate\n\t- Duplicate\n- Other\n')};
describe('selection translation at original-view boundaries',()=>{
 it('maps EOME line selection to stable companion IDs without using text equality',()=>{
  const nodes=thoughts(section),selectNode=vi.fn(),view={getFlatNodes:()=>[{line:8},{line:9},{line:10}],selectedNodeLines:new Set([9]),selectNode} as unknown as NativeView;
  expect(nativeSelection(view,'eome',section)).toBe(nodes[1]!.id);nativeSelection(view,'eome',section,nodes[2]!.id);expect(selectNode).toHaveBeenCalledWith(10);
 });
 it('maps Lineage generated IDs through actual preorder and uses its original selection action',()=>{
  const document=lineageDocument('- Duplicate\n\t- Duplicate\n- Other\n'),id=document.columns[1]!.groups[0]!.nodes[0],dispatch=vi.fn(),view={documentStore:{getValue:()=>({document})},viewStore:{getValue:()=>({document:{activeNode:id}}),dispatch}} as unknown as NativeView;
  expect(nativeSelection(view,'lineage',section)).toBe(thoughts(section)[1]!.id);nativeSelection(view,'lineage',section,thoughts(section)[1]!.id);expect(dispatch).toHaveBeenCalledWith({type:'view/set-active-node/document',payload:{id}});
 });
 it('declines synchronization when an incompatible or still-loading view has a different node count',()=>{
  const selectNode=vi.fn(),view={getFlatNodes:()=>[{line:0}],selectedNodeLines:new Set([0]),selectNode} as unknown as NativeView;expect(nativeSelection(view,'eome',section)).toBeUndefined();nativeSelection(view,'eome',section,thoughts(section)[0]!.id);expect(selectNode).not.toHaveBeenCalled();
 });
});
