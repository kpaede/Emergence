import {describe, expect, it} from 'vitest';
import {ArgdownEngine} from '../src/argdown/engine';
import {nodeKey} from '../src/argdown/model';
import {addLogicalObjection, addLogicalPremise, logicalTarget} from '../src/argdown/logical-editor';
import {ensureNodeReference} from '../src/argdown/statement-reference';
import {readReconstruction} from '../src/argdown/reconstruction';
const engine = new ArgdownEngine();
const source = '<A>: Reasoning.\n\n(1) First reason. {custom: 42}\n(2) [Named]: Second reason.\n----\n(3) Result.\n\n[Aussage 1]: Existing name.\n\n<B>\n\n(1) Other reason.\n----\n(2) Other result.';
const keyAt = (display: ReturnType<ArgdownEngine['project']>, index: number) => [...display.response.emergenceDerivation!.statements].find(([,roles]) => roles.some(role => role.argument === 'A' && role.index === index))![0];
describe('Automatic references in diagram operations', () => {
 it('reuses an already named internal statement without touching its definition', () => {const display=engine.project(source,'A'); expect(ensureNodeReference(engine,display,'s:Named')).toEqual({source,key:'s:Named'});});
 it('gives an anonymous statement a collision-free name and preserves text, data and other arguments', () => {
  const display=engine.project(source,'A'), reference=ensureNodeReference(engine,display,keyAt(display,0)); expect(reference.key).toBe('s:Aussage 2'); expect(reference.source).toContain('(1) [Aussage 2]: First reason. {custom: 42}'); expect(reference.source.slice(reference.source.indexOf('<B>'))).toBe(source.slice(source.indexOf('<B>'))); expect(ensureNodeReference(engine,engine.project(reference.source,'A'),reference.key).source).toBe(reference.source);
 });
 it('connects a named statement as an objection within the same reconstruction', () => {
  const display=engine.project(source,'A'), changed=addLogicalObjection(engine,display,logicalTarget(display,keyAt(display,0))!,'s:Named','attack'), next=engine.project(changed,'A');
  expect(changed).toContain('<- [Named]'); const first=keyAt(next,0); expect(next.edges.some(edge=>nodeKey(edge.from)==='s:Named'&&nodeKey(edge.to)===first&&String(edge.relationType)==='attack')).toBe(true);
 });
 it('names and connects an anonymous statement as one source change', () => {
  const display=engine.project(source,'A'), changed=addLogicalObjection(engine,display,logicalTarget(display,'s:Named')!,keyAt(display,0),'attack'), next=engine.project(changed,'A');
  expect(changed).toContain('(1) [Aussage 2]: First reason. {custom: 42}'); expect(changed).toContain('<- [Aussage 2]'); expect(next.edges.some(edge=>nodeKey(edge.from)==='s:Aussage 2'&&nodeKey(edge.to)==='s:Named'&&String(edge.relationType)==='attack')).toBe(true); expect(readReconstruction(engine.parse(changed),'a:A').steps).toHaveLength(3);
 });
 it('uses an existing statement to undercut an inference without requiring a name', () => {
  const display=engine.project(source,'A'), changed=addLogicalObjection(engine,display,logicalTarget(display,'a:A')!,keyAt(display,0),'undercut'), next=engine.project(changed,'A');
  expect(next.edges.some(edge=>nodeKey(edge.from)==='s:Aussage 2'&&nodeKey(edge.to)==='a:A'&&String(edge.relationType)==='undercut')).toBe(true);
 });
 it('uses the conclusion of a rendered inference instead of writing generated argument IDs', () => {
  const original='<A>\n\n(1) First.\n----\n(2) Middle.\n(3) Second.\n----\n(4) Last.', display=engine.project(original,'A'), changed=addLogicalObjection(engine,display,logicalTarget(display,keyAt(display,2))!,'a:A - 1','attack');
  expect(changed).toContain('(2) [Aussage 1]: Middle.'); expect(changed).toContain('<- [Aussage 1]'); expect(changed).not.toContain('<A - 1>'); expect(engine.project(changed,'A').edges.some(edge=>nodeKey(edge.from)==='s:Aussage 1'&&String(edge.relationType)==='attack')).toBe(true);
 });
 it('does not duplicate a relation on repeated drops', () => {
  const display=engine.project(source,'A'), first=addLogicalObjection(engine,display,logicalTarget(display,keyAt(display,0))!,'s:Named','attack'), next=engine.project(first,'A'); expect(addLogicalObjection(engine,next,logicalTarget(next,keyAt(next,0))!,'s:Named','attack')).toBe(first);
 });
 it('can reference an anonymous premise from another argument and preserve dependencies', () => {
  const display=engine.project(source), other=engine.parse(source).response.arguments!.B!.pcs[0]!.title!, added=addLogicalPremise(engine,display,{argument:'A',index:2,inference:true},'s:'+other), next=engine.parse(added.source);
  expect(next.response.arguments!.A!.pcs).toHaveLength(4); expect(next.response.arguments!.B!.pcs[0]!.title).toBe('Aussage 2'); expect(added.source).toContain('(3) [Aussage 2]');
 });
});
