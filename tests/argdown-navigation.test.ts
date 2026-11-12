import {describe, expect, it} from 'vitest';
import {ArgdownEngine} from '../src/argdown/engine';
import {derivationMode, setAllDerivations, setArgumentDerivation, derivationOverride} from '../src/argdown/derivation';
import {derivationScope, replaceDerivationSource, scopedRanges} from '../src/argdown/derivation-scope';
import {argdownMeaning, tryFormatArgdown} from '../src/argdown/source-layout';
import {isGroup, nodeKey, sourceRanges, keysAt} from '../src/argdown/model';
const engine = new ArgdownEngine();
const source = '<A>: First argument.\n\n(1) [P]: First reason.\n(2) Second reason.\n----\n(3) First result.\n\n<B>: Other argument.\n\n(1) [Q]: Other reason.\n----\n(2) Other result.\n\n[External]: Separate claim.';
describe('Distinct overview and focused reconstruction', () => {
 it('opens one reconstruction without writing or changing the overview visibility', async () => {
  const hidden = setArgumentDerivation(engine, engine.parse(source), 'A', false), model = engine.project(hidden, 'A');
  expect(model.source).toBe(hidden); expect(model.response.emergenceDerivation!.focus).toBe('A'); expect(derivationOverride(model.response.emergenceDerivation!.base,'A')).toBe(false);
  expect(model.nodes.filter(node=>String(node.type)==='statement-map-node')).toHaveLength(3); expect(model.nodes.some(node=>nodeKey(node)==='a:B'||nodeKey(node)==='s:External')).toBe(false); expect(model.nodes.some(node=>String(node.type)==='group-map-node')).toBe(false); expect(await engine.svg(model)).toContain('<svg');
 });
 it('keeps a focused argument accessible despite overview filters and closed sections', () => {
  const hidden='===\nselection:\n  selectedTags: [absent]\n  excludeStatements: [P]\n===\n\n# Closed {isClosed: true}\n\n'+source; const model=engine.project(hidden,'A');
  expect(model.nodes.filter(node=>String(node.type)==='statement-map-node')).toHaveLength(3); expect(model.nodes.some(node=>nodeKey(node)==='s:P')).toBe(true); expect(model.nodes.some(node=>String(node.type)==='group-map-node')).toBe(false); expect(model.source).toBe(hidden);
 });
 it('exposes only the selected reconstruction in the code pane and preserves every outside byte', () => {
  const base=engine.parse(source), scope=derivationScope(base,'A')!, code=source.slice(scope.from,scope.to); expect(code).toContain('<A>'); expect(code).toContain('(3) First result.'); expect(code).not.toContain('<B>');
  const changed=replaceDerivationSource(source,scope,code.replace('First reason.','Edited reason.')); expect(changed.startsWith(source.slice(0,scope.from))).toBe(true); expect(changed.endsWith(source.slice(scope.to))).toBe(true); expect(engine.parse(changed).response.arguments!.B!.pcs).toEqual(base.response.arguments!.B!.pcs);
 });
 it('maps highlighting and code cursor positions between scoped text and the original document', () => {
  const model=engine.project(source,'B'), scope=derivationScope(model.response.emergenceDerivation!.base,'B')!, key='s:Q', ranges=scopedRanges(sourceRanges(model,new Set([key])),scope);
  expect(ranges.length).toBeGreaterThan(0); expect(source.slice(scope.from,scope.to).slice(ranges[0]!.from,ranges[0]!.to)).toContain('Other reason.'); expect(keysAt(model,scope.from+ranges[0]!.from+3)).toContain(key);
 });
 it('allows incomplete scoped typing without altering surrounding source', () => {
  const scope=derivationScope(engine.parse(source),'A')!, changed=replaceDerivationSource(source,scope,'<A>\n\n(1) ['); expect(changed.slice(-source.slice(scope.to).length)).toBe(source.slice(scope.to)); expect(changed).toContain('<B>: Other argument.');
 });
 it('really hides all internal statements even when authored native selection is all or with-title', () => {
  for(const mode of ['all','with-title']) {const native='===\nselection:\n  statementSelectionMode: '+mode+'\nmap:\n  argumentLabelMode: none\ndot:\n  argument:\n    shape: circle\n===\n\n'+source; const model=engine.project(setAllDerivations(engine,native,false));
   expect(model.nodes.filter(node=>String(node.type)==='statement-map-node').map(nodeKey)).toEqual(['s:External']); expect(model.nodes.filter(node=>String(node.type)==='argument-map-node')).toHaveLength(2); expect(model.response.dot).toContain('First argument'); expect(model.response.dot).toContain('shape="box"');
  }
 });
 it('makes global show and hide override old individual exceptions in both directions', () => {
  let mixed=setArgumentDerivation(engine,engine.parse(source),'A',true); expect(derivationMode(engine.parse(mixed))).toBe('mixed');
  let changed=setAllDerivations(engine,mixed,false); expect(derivationMode(engine.parse(changed))).toBe('none'); expect(engine.project(changed).response.emergenceDerivation!.expanded.size).toBe(0);
  mixed=setArgumentDerivation(engine,engine.parse(changed),'A',false); changed=setAllDerivations(engine,mixed,true); expect(derivationMode(engine.parse(changed))).toBe('all'); expect(engine.project(changed).response.emergenceDerivation!.expanded.size).toBe(2); expect(derivationOverride(engine.parse(changed),'A')).toBeUndefined();
 });
 it('draws native labeled boundaries around each visible derivation', async () => {
  const model=engine.project(setAllDerivations(engine,source,true)); const boundaries=model.nodes.filter(node=>nodeKey(node).startsWith('d:')); expect(boundaries.map(nodeKey)).toEqual(['d:A','d:B']);
  expect(new Set(model.nodes.map(node=>node.id)).size).toBe(model.nodes.length); const svg=await engine.svg(model); expect(svg).toContain('Rekonstruktion: A'); expect(svg).toContain('Rekonstruktion: B');
 });
 it('automatically tidies relation layout without breaking reconstruction steps or comments', () => {
  const messy='[X]: Outer\n    + <Y>: Reason\n\n\n\n'+source, formatted=tryFormatArgdown(engine,messy); expect(formatted).toContain('\n  + <Y>: Reason'); expect(argdownMeaning(engine.parse(formatted))).toBe(argdownMeaning(engine.parse(messy))); expect(formatted).toContain('(2) Second reason.\n----\n(3) First result.');
 });
 it('keeps repeated occurrences of one statement inside its own argument boundary', () => {
  const model=engine.project(setAllDerivations(engine,'<A>\n\n(1) [P]: Reason.\n----\n(2) Middle.\n(3) [P]\n----\n(4) Result.',true)), boundary=model.nodes.find(node=>nodeKey(node)==='d:A');
  expect(boundary&&isGroup(boundary)&&boundary.children?.some(node=>nodeKey(node)==='s:P')).toBe(true);
 });

});
