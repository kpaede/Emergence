import {describe, expect, it} from 'vitest';
import {inHoverRegion} from '../src/diagrams/hover-region';
const node={left:200,right:220,top:200,bottom:220}, above={left:100,right:320,top:130,bottom:170};
describe('Stable path from diagram nodes to their controls', () => {
 it('protects the entire diagonal path to every button of a much wider toolbar', () => {
  for(const x of [105,150,210,270,315]) for(let step=0;step<=100;step++) expect(inHoverRegion({x:210+(x-210)*step/100,y:210+(150-210)*step/100},[node],[above])).toBe(true);
 });
 it('protects the gap where neither the node nor its controls are directly under the pointer', () => {expect(inHoverRegion({x:210,y:185},[node],[above],0)).toBe(true);});
 it('also protects controls below the node and at the side', () => {
  expect(inHoverRegion({x:210,y:240},[node],[{left:100,right:320,top:260,bottom:300}])).toBe(true); expect(inHoverRegion({x:180,y:210},[node],[{left:100,right:160,top:180,bottom:240}])).toBe(true);
 });
 it('keeps the route open when padded rectangles partly overlap', () => {expect(inHoverRegion({x:230,y:197},[node],[{left:180,right:300,top:160,bottom:190}])).toBe(true);});
 it('lets unrelated diagram areas and neighboring nodes leave the region', () => {
  for(const p of [{x:50,y:185},{x:350,y:185},{x:250,y:250},{x:80,y:100}]) expect(inHoverRegion(p,[node],[above])).toBe(false); expect(inHoverRegion({x:210,y:185},[],[])).toBe(false);
 });
});
