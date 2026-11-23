import {describe,expect,it} from 'vitest';
import {editEdgeShape} from '../src/tetrad/edit-geometry';

/** Read the float's excluded width at a line's vertical midpoint. This catches
 * the former cutoff where text suddenly fell out of the diagonal on wrapping. */
function exclusion(shape:ReturnType<typeof editEdgeShape>,side:'left'|'right',y:number):number{
 const points=[...shape.polygon.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/gu)].map(match=>[Number(match[1]),Number(match[2])] as const),crossings:number[]=[];
 for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!;if(y>=Math.min(a[1],b[1])&&y<Math.max(a[1],b[1]))crossings.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}
 return side==='left'?Math.max(...crossings):shape.width-Math.min(...crossings);
}
describe('Tetrad text flow during editing',()=>{
 it.each(['left','right'] as const)('continues the %s edge beyond the original paragraph and stops at the quadrant boundary',side=>{
  const shape=editEdgeShape({side,start:20,slope:.5,limit:100,height:4096});
  expect(exclusion(shape,side,20)).toBeCloseTo(30);expect(exclusion(shape,side,150)).toBeCloseTo(95);expect(exclusion(shape,side,200)).toBeCloseTo(100);expect(exclusion(shape,side,4000)).toBeCloseTo(100);
 });
 it.each(['left','right'] as const)('lets the %s edge decrease smoothly to zero for the opposite direction',side=>{
  const shape=editEdgeShape({side,start:80,slope:-.5,limit:100,height:4096});
  expect(exclusion(shape,side,20)).toBeCloseTo(70);expect(exclusion(shape,side,150)).toBeCloseTo(5);expect(exclusion(shape,side,200)).toBe(0);expect(exclusion(shape,side,4000)).toBe(0);
 });
});
