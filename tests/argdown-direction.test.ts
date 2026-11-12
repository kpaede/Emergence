import {describe,expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {ArgdownEngine} from '../src/argdown/engine';
import {effectiveGraphDirection,graphDirections} from '../src/argdown/direction';
import {graphDirection} from '../src/argdown/actions';
const engine=new ArgdownEngine(),source='[Thesis]: Main claim.\n  + <Reason>: Supporting reason.';
describe('Documented Argdown arrow direction',()=>{
 it('reads the native BT default without adding source configuration',()=>{const model=engine.project(source);expect(effectiveGraphDirection(model)).toBe('BT');expect(model.source).toBe(source);expect(model.edges[0]!.from.title).toBe('Reason');expect(model.edges[0]!.to.title).toBe('Thesis');});
 it.each(graphDirections)('lays out the reason-to-claim arrow in direction %s',async direction=>{
  const model=engine.project(graphDirection(source,direction));expect(effectiveGraphDirection(model)).toBe(direction);
  const document=new JSDOM(await engine.svg(model)).window.document;
  const point=(title:string)=>{const node=model.nodes.find(node=>node.title===title)!;const element=[...document.querySelectorAll('g.node')].find(el=>el.querySelector('title')?.textContent===node.id)!.querySelector('text')!;return {x:Number(element.getAttribute('x')),y:Number(element.getAttribute('y'))};};
  const reason=point('Reason'),claim=point('Thesis');
  expect(direction==='TB'?reason.y<claim.y:direction==='BT'?reason.y>claim.y:direction==='LR'?reason.x<claim.x:reason.x>claim.x).toBe(true);
  expect(model.edges[0]!.from.title).toBe('Reason');expect(model.edges[0]!.to.title).toBe('Thesis');
 });
 it('uses effective settings for a reconstruction instead of the overview source direction',()=>{const source='===\ndot:\n  graphVizSettings:\n    rankdir: LR\n===\n\n<Reason>\n\n(1) First premise.\n----\n(2) Main conclusion.';expect(effectiveGraphDirection(engine.project(source))).toBe('LR');expect(effectiveGraphDirection(engine.project(source,'Reason'))).toBe('TB');});
 it('preserves CRLF, comments, unrelated configuration and the original relation when changing direction',()=>{const original='===\r\n# Keep\r\ncustom: 42\r\n===\r\n\r\n'+source.replace(/\n/gu,'\r\n'),changed=graphDirection(original,'RL');expect(changed).toContain('# Keep\r\n');expect(changed).toContain('custom: 42');expect(changed.endsWith(source.replace(/\n/gu,'\r\n'))).toBe(true);expect(changed.replace(/\r\n/gu,'')).not.toContain('\n');expect(engine.project(changed).edges[0]!.to.title).toBe('Thesis');});
 it('does not claim a selection for an unknown setting or an unrendered map',()=>{expect(effectiveGraphDirection()).toBeUndefined();expect(effectiveGraphDirection(engine.project('===\ndot:\n  graphVizSettings:\n    rankdir: custom\n===\n\n'+source))).toBeUndefined();});
});
