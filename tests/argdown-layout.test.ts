import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {ArgdownEngine} from '../src/argdown/engine';
import {addConnectedNode} from '../src/argdown/connected-node';
import {connectNodes, changeRelation} from '../src/argdown/actions';
import {argdownMeaning, formatArgdown} from '../src/argdown/source-layout';
import {isGroup, nodeKey, edgeKey} from '../src/argdown/model';
const engine = new ArgdownEngine();
describe('Readable Argdown creation and native relation meaning', () => {
 it('places a new supporting argument directly beneath its target with one definition', () => {
  const model = engine.parse('[These]: Den Park erhalten.'), result = addConnectedNode(engine, model, 's:These', 'support', 'argument');
  expect(result.source).toBe('[These]: Den Park erhalten.\n  + <Argument 1>: Neues Argument.');
  const edge = engine.parse(result.source).edges[0]!; expect(nodeKey(edge.from)).toBe(result.key); expect(nodeKey(edge.to)).toBe('s:These');
 });
 it('keeps multiple reasons together and creates counterarguments and statement reasons', () => {
  let model = engine.parse('<A>: Ausgangsargument');
  for (const [kind, type] of [['support', 'argument'], ['attack', 'argument'], ['support', 'statement'], ['undercut', 'statement']] as const) model = engine.parse(addConnectedNode(engine, model, 'a:A', kind, type).source);
  expect(model.source.match(/<A>/gu)).toHaveLength(1); expect(model.source).toBe('<A>: Ausgangsargument\n  + <Argument 1>: Neues Argument.\n  - <Argument 2>: Neues Argument.\n  + [Aussage 1]: Neue Aussage.\n  _ [Aussage 2]: Neue Aussage.');
  expect(model.edges.every(edge => nodeKey(edge.to) === 'a:A')).toBe(true);
 });
 it('preserves existing nested relations and inline comments', () => {
  const model = engine.parse('[A]: Alpha // keep parent\n  + <B>: Beta\n    - <C>: Gamma // keep descendant'), result = addConnectedNode(engine, model, 's:A', 'support', 'statement');
  expect(result.source).toContain('// keep parent'); expect(result.source).toContain('// keep descendant'); expect(engine.parse(result.source).edges).toHaveLength(3);
  expect(result.source).toContain('\n  + [Aussage 1]: Neue Aussage.');
 });
 it('indents a reason beneath an already nested argument', () => {
  const model = engine.parse('[A]: Alpha\n  + <B>: Beta\n    - <C>: Gamma'), result = addConnectedNode(engine, model, 'a:B', 'support', 'argument');
  expect(result.source).toContain('\n    + <Argument 1>: Neues Argument.'); expect(engine.parse(result.source).edges).toHaveLength(3); expect(result.source.match(/<B>/gu)).toHaveLength(1);
 });
 it('keeps cross-section definitions at the dropped scope while grouping the reference beneath the target', () => {
  const model = engine.parse('# First\n\n[A]: Alpha\n\n# Second\n\n<B>: Beta'), target = nodeKey(model.nodes.find(node => isGroup(node) && node.title === 'Second')!);
  const result = addConnectedNode(engine, model, 's:A', 'support', 'argument', target), next = engine.parse(result.source);
  expect(next.nodes.find(node => isGroup(node) && node.title === 'Second' && node.children?.some(child => nodeKey(child) === result.key))).toBeDefined();
  expect(next.edges.some(edge => nodeKey(edge.from) === result.key && nodeKey(edge.to) === 's:A')).toBe(true);
 });
 it('places repeated connections under the existing target and avoids duplicate operations', () => {
  const model = engine.parse('[A]: Alpha\n\n<B>: Beta'), source = connectNodes(engine, model, 'a:B', 's:A', 'support');
  expect(source).toBe('[A]: Alpha\n  + <B>\n\n<B>: Beta'); expect(connectNodes(engine, engine.parse(source), 'a:B', 's:A', 'support')).toBe(source);
 });
 it('changes an incoming support to a symmetric relation without losing it', () => {
  for (const [frontmatter, kind, actual] of [['', 'contradictory', 'contradictory'], ['===\nmodel:\n  mode: strict\n===\n\n', 'attack', 'contrary']] as const) {
   const model = engine.parse(frontmatter + '[A]: Alpha\n  + [B]: Beta'), next = engine.parse(changeRelation(engine, model, edgeKey(model.edges[0]!), kind));
   expect(next.edges).toHaveLength(1); expect(String(next.edges[0]!.relationType)).toBe(actual); expect([nodeKey(next.edges[0]!.from), nodeKey(next.edges[0]!.to)].sort()).toEqual(['s:A', 's:B']);
  }
 });
 it('formats relation indentation and blank lines without changing argument meaning', () => {
  const source = '[A]: Alpha\n    + <B>: Beta\n          - <C>: Gamma\n\n\n\n[D]: Delta', formatted = formatArgdown(engine, source);
  expect(formatted).toBe('[A]: Alpha\n  + <B>: Beta\n    - <C>: Gamma\n\n[D]: Delta'); expect(formatArgdown(engine, formatted)).toBe(formatted);
  expect(argdownMeaning(engine.parse(formatted))).toBe(argdownMeaning(engine.parse(source)));
 });
 it('preserves the full guide, metadata, inference details and comments through formatting', () => {
  const source = readFileSync(new URL('./fixtures/argdown-guide.argdown', import.meta.url), 'utf8'), formatted = formatArgdown(engine, source);
  expect(argdownMeaning(engine.parse(formatted))).toBe(argdownMeaning(engine.parse(source))); expect(formatArgdown(engine, formatted)).toBe(formatted);
 });
 it('does not reindent label continuation or block YAML and keeps CRLF', () => {
  const source = '[A]: A\r\n    + <B>: first line\r\n      continuation\r\n      {\r\ncolor: "#ff0000"\r\ncustom: 42\r\n}\r\n\r\n[C]: C';
  const formatted = formatArgdown(engine, source); expect(formatted).toContain('      continuation'); expect(formatted).toContain('custom: 42'); expect(formatted.replace(/\r\n/gu, '')).not.toContain('\n');
 });
});
