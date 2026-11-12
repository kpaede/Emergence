import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {changeRelation, deleteRelation} from '../src/argdown/actions';
import {ArgdownEngine} from '../src/argdown/engine';
import {derivationOverride, setArgumentDerivation, setGlobalDerivation} from '../src/argdown/derivation';
import {nodeKey, edgeKey, sourceRanges, keysAt} from '../src/argdown/model';
import {readReconstruction, writeReconstruction} from '../src/argdown/reconstruction';
import {logicalTarget, logicalEdge, explicitDependencies, logicalStatementColor, addLogicalPremise, addLogicalConclusion, editLogicalText, removeLogical} from '../src/argdown/logical-editor';
const engine = new ArgdownEngine(), example = readFileSync(new URL('./fixtures/argdown-complex.argdown', import.meta.url), 'utf8');
const simple = '<A>: Main argument\n\n(1) First reason.\n(2) Second reason.\n----\n(3) Result.\n\n<B>: Other argument\n\n(1) Other premise.\n----\n(2) Other result.';
const expanded = (source = simple) => engine.project(setGlobalDerivation(engine, source, true));
const statementKey = (model: ReturnType<typeof expanded>, argument: string, index: number) => [...model.response.emergenceDerivation!.statements].find(([,roles]) => roles.some(role => role.argument === argument && role.index === index))![0];
describe('Editable native inference workspace', () => {
 it('roundtrips the exact user example with comments and both metadata locations', () => {
  const model = engine.parse(example), reconstruction = readReconstruction(model, 'a:My complex argument');
  expect(reconstruction.steps[5]!.uses).toEqual(['original-4','original-5']); expect(reconstruction.steps[6]!.uses).toEqual(['original-3','original-6']);
  expect(writeReconstruction(engine, model, 'a:My complex argument', reconstruction.steps)).toBe(example);
 });
 it('renders all seven statements and three native inferential steps without modifying source IDs', async () => {
  const model = engine.project(example), p = model.response.emergenceDerivation!;
  expect(model.source).toBe(example); expect(model.nodes.filter(node => String(node.type) === 'statement-map-node')).toHaveLength(7); expect(p.inferences.size).toBe(3); expect(model.edges).toHaveLength(9);
  expect(Object.keys(p.base.response.arguments!)).toEqual(['My complex argument']); expect(model.response.dot).toContain('shape="circle"'); expect(await engine.svg(model)).toContain('<svg');
 });
 it('maps generated step circles and code selection back to original inference lines', () => {
  const model = expanded(), key = 'a:A', target = logicalTarget(model,key)!; expect(target).toEqual({argument:'A',index:2,inference:true});
  const ranges = sourceRanges(model,new Set([key])); expect(ranges.some(range => model.source.slice(range.from,range.to).includes('----'))).toBe(true);
  expect(keysAt(model,model.source.indexOf('----')+2)).toContain(key);
 });
 it('expands one argument, preserves native groups, and collapses only its override', () => {
  let source = setArgumentDerivation(engine, engine.parse('# Section\n\n'+simple), 'A', true); let model = engine.project(source);
  expect([...model.response.emergenceDerivation!.expanded]).toEqual(['A']); expect(model.nodes.some(node=>nodeKey(node).startsWith('g:'))).toBe(true);
  source = setGlobalDerivation(engine,source,true); source = setArgumentDerivation(engine,engine.parse(source),'B',false); model = engine.project(source);
  expect([...model.response.emergenceDerivation!.expanded]).toEqual(['A']); expect(model.response.dot).toContain('Other argument');
  source = setArgumentDerivation(engine,engine.parse(source),'B',undefined); expect(derivationOverride(engine.parse(source),'B')).toBeUndefined(); expect(engine.project(source).response.emergenceDerivation!.expanded.has('B')).toBe(true);
 });
 it('preserves unknown argument metadata and edits the canonical occurrence', () => {
  const original = '<A>: Canonical {isCanonical: true, custom: 42}\n\n<A>: Other'; const changed = setArgumentDerivation(engine,engine.parse(original),'A',true);
  expect(changed).toContain('custom: 42'); expect(changed).toContain('<A>: Other'); expect(changed.indexOf('derivation')).toBeLessThan(changed.indexOf('<A>: Other'));
 });
 it('edits statement text and inference rules in the main source', () => {
  let model = expanded(); const target = logicalTarget(model,statementKey(model,'A',0))!;
  let source = editLogicalText(engine,model.response.emergenceDerivation!.base,target,'Changed reason.'); expect(source).toContain('(1) Changed reason.'); expect(source).toContain('Other premise.');
  model = expanded(source); source = editLogicalText(engine,model.response.emergenceDerivation!.base,logicalTarget(model,'a:A')!,'Modus ponens'); expect(source).toContain('Modus ponens');
 });
 it('adds an anonymous premise and preserves other arguments despite automatic ID shifts', () => {
  const model = expanded(), added = addLogicalPremise(engine,model,logicalTarget(model,'a:A')!); const next = engine.project(added.source), pcs=next.response.emergenceDerivation!.base.response.arguments!.A!.pcs;
  expect(pcs).toHaveLength(4); expect(pcs[2]!.text).toContain('Neue Prämisse'); expect(added.source).not.toContain('· Prämisse'); expect(next.response.emergenceDerivation!.base.response.arguments!.B!.pcs).toHaveLength(2);
 });
 it('creates an intermediary inference for an existing premise and preserves later uses', () => {
  const model=expanded(), key=statementKey(model,'A',0), added=addLogicalPremise(engine,model,logicalTarget(model,key)!); const next=engine.project(added.source);
  expect(next.response.emergenceDerivation!.inferences.size).toBe(3); const steps=readReconstruction(next.response.emergenceDerivation!.base,'a:A').steps; expect(steps[1]!.conclusion).toBe(true); explicitDependencies(steps); expect(steps[3]!.uses).toEqual(['original-2','original-3']);
 });
 it('connects an existing statement to an inference, and rejects circular uses', () => {
  const model=expanded(), key=statementKey(model,'A',0); const added=addLogicalPremise(engine,model,logicalTarget(model,'a:A')!,key); const steps=readReconstruction(engine.parse(added.source),'a:A').steps; explicitDependencies(steps); expect(steps[2]!.uses).toEqual(['original-1','original-2']);
  expect(()=>addLogicalPremise(engine,model,logicalTarget(model,key)!,statementKey(model,'A',2))).toThrow('Zirkelschluss');
 });
 it('uses named and anonymous external statements as references', () => {
  let model=expanded(simple+'\n\n[Named]: External reason.'); const added=addLogicalPremise(engine,model,logicalTarget(model,'a:A')!,'s:Named'); expect(added.source).toContain('(3) [Named]');
  model=expanded(); const referenced=addLogicalPremise(engine,model,logicalTarget(model,'a:A')!,statementKey(model,'B',0)); expect(engine.parse(referenced.source).response.arguments!.A!.pcs).toHaveLength(4);
 });
 it('creates a further conclusion from multiple selected statements', () => {
  const model=expanded(), targets=[logicalTarget(model,statementKey(model,'A',0))!,logicalTarget(model,statementKey(model,'A',2))!]; const added=addLogicalConclusion(engine,model,targets), steps=readReconstruction(engine.parse(added.source),'a:A').steps;
  expect(steps).toHaveLength(4); expect(steps[3]!.uses).toEqual(['original-1','original-3']);
 });
 it('removes a selected premise edge by changing uses, without deleting the statement', () => {
  const model=expanded(), key=statementKey(model,'A',0), edge=model.edges.find(edge=>nodeKey(edge.from)===key&&nodeKey(edge.to)==='a:A')!; expect(logicalEdge(model,edgeKey(edge))?.premise).toBe(0);
  const source=removeLogical(engine,model,new Set([edgeKey(edge)])), steps=readReconstruction(engine.parse(source),'a:A').steps; expect(steps[2]!.uses).toEqual(['original-2']); expect(source).toContain('First reason.'); const next=engine.project(source); expect(next.edges.filter(edge=>nodeKey(edge.to)==='a:A')).toHaveLength(1);
 });
 it('removes premises together and protects the main conclusion from accidental deletion', () => {
  const model=expanded(); const source=removeLogical(engine,model,new Set([statementKey(model,'A',0)])); expect(engine.parse(source).response.arguments!.A!.pcs).toHaveLength(2);
  expect(()=>removeLogical(engine,model,new Set([statementKey(model,'A',2)]))).toThrow('Hauptschlussfolgerung');
 });
 it('edits and deletes explicit attacks on expanded premises through their source occurrences', () => {
  const source='<A>\n\n(1) [P]: Reason.\n  <- <Objection>: Not so.\n----\n(2) Result.'; const model=expanded(source), edge=model.edges.find(edge=>nodeKey(edge.from)==='a:Objection'&&nodeKey(edge.to)==='s:P')!;
  const changed=engine.project(changeRelation(engine,model,edgeKey(edge),'support')); expect(changed.edges.some(edge=>nodeKey(edge.from)==='a:Objection'&&nodeKey(edge.to)==='s:P'&&String(edge.relationType)==='support')).toBe(true);
  const removed=engine.project(deleteRelation(engine,model,edgeKey(edge))); expect(removed.edges.some(edge=>nodeKey(edge.from)==='a:Objection')).toBe(false); expect(removed.nodes.some(node=>nodeKey(node)==='a:Objection')).toBe(true);
 });
 it('keeps undercuts attached to their specific generated inference', () => {
  const source='<A>\n\n(1) First.\n----\n  <_ <Objection>: This inference fails.\n(2) Middle.\n----\n(3) Last.'; const model=expanded(source);
  expect(model.edges.some(edge=>nodeKey(edge.from)==='a:Objection'&&nodeKey(edge.to)==='a:A - 1'&&String(edge.relationType)==='undercut')).toBe(true);
 });
 it('filters expanded statements with their argument while honoring excluded statements', () => {
  const source='===\nmodel:\n  explodeArguments: true\nselection:\n  selectedTags: [green]\n  excludeStatements: [P]\n===\n\n<A>: Included #green\n\n(1) [P]: Reason.\n----\n(2) Result.\n\n<B>: Excluded #red\n\n(1) Other.\n----\n(2) Other result.'; const model=engine.project(source);
  expect([...model.response.emergenceDerivation!.expanded]).toEqual(['A']); expect(model.nodes.some(node=>nodeKey(node)==='a:B')).toBe(false); expect(model.nodes.some(node=>nodeKey(node)==='s:P')).toBe(false); expect(model.nodes.filter(node=>String(node.type)==='statement-map-node')).toHaveLength(1);
 });
 it('preserves comments and remaps conclusion metadata when editing the exact example', () => {
  const model=engine.project(example), added=addLogicalPremise(engine,model,logicalTarget(model,'a:My complex argument - 2')!); expect(added.source).toContain('// statements used'); expect(added.source).toContain('// ...or');
  const steps=readReconstruction(engine.parse(added.source),'a:My complex argument').steps; expect(steps.at(-1)!.uses).toEqual(['original-3','original-7']); expect(steps[6]!.uses).toEqual(['original-4','original-5','original-6']);
 });
 it('creates a new reconstruction in its original section instead of the last section', () => {
  const source='# First\n\n<A>: First argument.\n\n# Second\n\n<B>: Second argument.', base=engine.parse(source), steps=readReconstruction(base,'a:A').steps;
  const changed=engine.parse(writeReconstruction(engine,base,'a:A',steps)); expect(changed.response.arguments!.A!.section?.title).toBe('First'); expect(changed.response.arguments!.B!.section?.title).toBe('Second'); expect(changed.source.indexOf('(1)')).toBeLessThan(changed.source.indexOf('# Second'));
 });
 it('preserves CRLF and orphaned HTML comments when removing a statement', () => {
  const source='<A>\r\n\r\n(1) First.\r\n<!-- Keep this comment -->\r\n(2) Second.\r\n----\r\n(3) Result.', model=expanded(source), changed=removeLogical(engine,model,new Set([statementKey(model,'A',1)]));
  expect(changed).toContain('<!-- Keep this comment -->'); expect(changed.replace(/\r\n/gu,'')).not.toContain('\n'); expect(engine.parse(changed).response.arguments!.A!.pcs).toHaveLength(2);
 });
 it('preserves comments inside an inference while adding its rule', () => {
  const source='<A>\n\n(1) Reason.\n--\n// Keep this rule comment\n{uses: [1], custom: 42}\n--\n(2) Result.', model=expanded(source), changed=editLogicalText(engine,model.response.emergenceDerivation!.base,logicalTarget(model,'a:A')!,'Modus ponens');
  expect(changed).toContain('// Keep this rule comment'); expect(changed).toContain('custom: 42'); expect(engine.parse(changed).response.arguments!.A!.pcs).toHaveLength(2);
 });
 it('colors an anonymous statement without overwriting its dependencies and metadata', () => {
  const model=engine.project(example), target=logicalTarget(model,statementKey(model,'My complex argument',6))!, source=logicalStatementColor(engine,model.response.emergenceDerivation!.base,target,'#ff0000'), next=engine.project(source);
  expect(next.nodes.find(node=>nodeKey(node)===statementKey(next,'My complex argument',6))?.color).toBe('#ff0000'); expect(readReconstruction(next.response.emergenceDerivation!.base,'a:My complex argument').steps[6]!.uses).toEqual(['original-3','original-6']);
 });
 it('colors a nonfinal anonymous premise without changing the following step', () => {
  const model=expanded(), target=logicalTarget(model,statementKey(model,'A',0))!, source=logicalStatementColor(engine,model.response.emergenceDerivation!.base,target,'#ff6347'), next=engine.project(source);
  expect(next.nodes.find(node=>nodeKey(node)===statementKey(next,'A',0))?.color).toBe('#ff6347'); expect(next.nodes.find(node=>nodeKey(node)===statementKey(next,'A',1))?.color).not.toBe('#ff6347');
 });
 it('honors explicit native shape and size settings when arguments are expanded', () => {
  const source='===\nmodel:\n  explodeArguments: true\ndot:\n  argument:\n    shape: diamond\n    minWidth: 0.4\n===\n\n<A>\n\n(1) Reason.\n----\n(2) Result.', model=engine.project(source);
  expect(model.response.dot).toContain('shape="diamond"'); expect(model.response.dot).toContain('width="0.4"');
 });

});
