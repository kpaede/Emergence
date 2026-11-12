import {describe, it, expect} from 'vitest';
import {ArgdownEngine} from '../src/argdown/engine';
import {createSection, editSection, reverseRelation} from '../src/argdown/actions';
import {moveSection, closeSection} from '../src/argdown/sections';
import {isGroup, nodeKey, edgeKey, type ArgdownModel} from '../src/argdown/model';
const engine = new ArgdownEngine(), parse = (source: string) => engine.parse(source);
const group = (model: ArgdownModel, title: string) => model.nodes.filter(isGroup).find(node => node.title === title)!;
const key = (model: ArgdownModel, title: string) => nodeKey(group(model, title));
describe('Nested Argdown sections remain native and preserve meaning', () => {
 it('retains visible ancestors when creating a third and fourth level', () => {
  let model = parse('# Root\n\n[A]: Alpha\n\n## Child\n\n[B]: Beta');
  model = parse(createSection(engine, model, new Set(['s:B']), 'Third', key(model, 'Child')));
  expect(model.nodes.filter(isGroup).map(node => node.title)).toEqual(['Root', 'Child', 'Third']);
  model = parse(createSection(engine, model, new Set(['s:B']), 'Fourth', key(model, 'Third')));
  expect(model.nodes.filter(isGroup).map(node => node.title)).toEqual(['Root', 'Child', 'Third', 'Fourth']);
  expect(group(model, 'Fourth')).toMatchObject({children: [expect.objectContaining({title: 'B'})]});
 });
 it('moves the whole subtree and adjusts its headings without losing cross references', () => {
  const model = parse('# Root {isGroup: true}\n\n[A]: Alpha\n\n## Child {isGroup: true}\n\n[B]: Beta\n  +> [A]\n\n### Grandchild {isGroup: true}\n\n<C>: Gamma\n\n# Target {isGroup: true}\n\n[D]: Delta');
  const source = moveSection(engine, model, key(model, 'Child'), key(model, 'Target')), next = parse(source);
  expect(group(next, 'Target').children?.some(node => isGroup(node) && node.title === 'Child')).toBe(true);
  expect(group(next, 'Child').children?.some(node => isGroup(node) && node.title === 'Grandchild')).toBe(true);
  expect(next.edges.map(edgeKey)).toEqual(model.edges.map(edgeKey));
  expect(source).toContain('### Grandchild');
  const root = parse(moveSection(engine, next, key(next, 'Child')));
  expect(root.response.map?.nodes.some(node => node.title === 'Child')).toBe(true); expect(root.source).toContain('\n# Child'); expect(root.source).toContain('\n## Grandchild');
 });
 it('rejects a cycle before producing a candidate', () => {
  const model = parse('# Root {isGroup: true}\n\n[A]: A\n\n## Child {isGroup: true}\n\n[B]: B');
  expect(() => moveSection(engine, model, key(model, 'Root'), key(model, 'Child'))).toThrow('Unterabschnitte');
  const deep = parse('###### Last {isGroup: true}\n\n[A]: A'), seventh = parse(createSection(engine, deep, new Set(['s:A']), 'Seventh', key(deep, 'Last'))); expect(seventh.source).toContain('####### Seventh'); expect(group(seventh, 'Seventh')).toBeDefined();
 });
 it('closes and reopens a group while preserving hidden children and outward relations', () => {
  const model = parse('[X]: Outside\n\n# Root {isGroup: true, custom: 42}\n\n[A]: Alpha\n  +> [X]\n\n## Child {isGroup: true}\n\n<B>: Beta');
  const closed = parse(closeSection(engine, model, key(model, 'Root'), true));
  expect(group(closed, 'Root')).toMatchObject({isClosed: true, children: []}); expect(closed.source).toContain('custom: 42');
  const open = parse(closeSection(engine, closed, key(closed, 'Root'), false)); expect(open.nodes.map(nodeKey)).toEqual(model.nodes.map(nodeKey)); expect(open.edges.map(edgeKey)).toEqual(model.edges.map(edgeKey));
 });
 it('keeps heading tags and data while renaming', () => {
  const model = parse('# Root #tag {isGroup: true, custom: 42}\n\n[A]: Alpha');
  const source = editSection(engine, model, nodeKey(model.nodes.filter(isGroup)[0]!), 'Renamed'); expect(source).toContain('#tag'); expect(source).toContain('custom: 42'); expect(group(parse(source), 'Renamed #tag')).toBeDefined();
 });
 it('distinguishes same-named section owners while moving', () => {
  const model = parse('# Same {isGroup: true}\n\n[A]: Alpha\n\n# Same {isGroup: true}\n\n[B]: Beta\n\n# Target {isGroup: true}\n\n[C]: Gamma');
  const first = model.nodes.filter(isGroup).filter(node => node.title === 'Same')[0]!;
  const next = parse(moveSection(engine, model, nodeKey(first), key(model, 'Target')));
  expect(group(next, 'Target').children?.some(node => isGroup(node) && node.children?.some(child => child.title === 'A'))).toBe(true);
  expect(next.response.map?.nodes.some(node => isGroup(node) && node.title === 'Same' && node.children?.some(child => child.title === 'B'))).toBe(true);
 });
 it('refuses heading edits when regroup config owns the group hierarchy', () => {
  const model = parse('===\ngroup:\n  regroup:\n    - title: Configured\n      statements: [A]\n===\n\n[A]: Alpha');
  expect(() => createSection(engine, model, new Set(['s:A']), 'New')).toThrow('regroup');
  expect(() => moveSection(engine, model, key(model, 'Configured'))).toThrow('regroup');
  expect(() => editSection(engine, model, key(model, 'Configured'), 'Changed')).toThrow('regroup');
 });
 it('rejects a close operation when native configuration ignores its data flag', () => {
  const model = parse('===\ngroup:\n  ignoreIsClosed: true\n===\n\n# Root\n\n[A]: Alpha');
  expect(() => closeSection(engine, model, key(model, 'Root'), true)).toThrow('Konfiguration');
 });
});
describe('Explicit arrow reversal', () => {
 for (const op of ['+', '<+', '+>', '-', '<-', '->', '_', '<_', '_>']) it('reverses ' + op + ' without changing node content', () => {
  const model = parse('<A>: Alpha\n  ' + op + ' <B>: Beta'), edge = model.edges[0]!, next = parse(reverseRelation(engine, model, edgeKey(edge)));
  expect(next.edges).toHaveLength(1); expect(nodeKey(next.edges[0]!.from)).toBe(nodeKey(edge.to)); expect(nodeKey(next.edges[0]!.to)).toBe(nodeKey(edge.from));
 });
 it('does not offer an illegal reversal of an undercut from a statement', () => {
  const model = parse('[A]: Alpha\n  _> <B>: Beta'); expect(() => reverseRelation(engine, model, edgeKey(model.edges[0]!))).toThrow('Argument');
 });
});
