import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {ArgdownEngine} from '../src/argdown/engine';
import {editNode, rawNodeText, nodeColor} from '../src/argdown/actions';
import {changePresentation, inferenceView, presentationSettings} from '../src/argdown/presentation';
const engine = new ArgdownEngine();
const source = '<A>: Begründung\n\n(1) [P]: Alle Menschen sind sterblich.\n(2) [Q]: Sokrates ist ein Mensch.\n----\n(3) [R]: Sokrates ist sterblich.';
describe('Native Argdown presentation configuration', () => {
 it('leaves an untouched settings dialog byte-for-byte unchanged', () => {expect(changePresentation(engine, source, [])).toBe(source);});
 it('preserves comments, unknown metadata and body while setting native label, shape and color options', async () => {
  const original = '===\n# Keep\ncustom:\n  value: 42\n===\n\n' + source;
  const changed = changePresentation(engine, original, [{path: ['map', 'statementLabelMode'], value: 'text'}, {path: ['dot', 'statement', 'shape'], value: 'ellipse'}, {path: ['color', 'statementFontColor'], value: '#ff0000'}]);
  expect(changed).toContain('# Keep'); expect(changed).toContain('value: 42'); expect(changed.endsWith(source)).toBe(true); const model = engine.parse(changed);
  expect(model.response.dot).toContain('shape="ellipse"'); expect(model.response.dot).toContain('fontcolor="#ff0000"'); expect(await engine.svg(model)).toContain('<svg');
 });
 it('can reset an explicit setting without deleting other configuration', () => {
  const changed = changePresentation(engine, '===\ncolor:\n  argumentFontColor: "#ffffff"\n  statementFontColor: "#ff0000"\n===\n\n' + source, [{path: ['color', 'statementFontColor'], value: undefined}]);
  expect(presentationSettings(changed).hasIn(['color', 'statementFontColor'])).toBe(false); expect(presentationSettings(changed).getIn(['color', 'argumentFontColor'])).toBe('#ffffff');
 });
 it('renders the internal grounds and conclusion using native inference-tree settings', async () => {
  const model = inferenceView(engine, source, 'A'); expect(model.nodes.filter(node => String(node.type) === 'statement-map-node')).toHaveLength(3); expect(model.response.arguments?.A?.pcs).toHaveLength(3); expect(model.edges).toHaveLength(3); expect(await engine.svg(model)).toContain('<svg');
 });
 it('renders several inference steps of one argument without including neighboring arguments', () => {
  const whole = source + '\n(4) [S]: Ein weiterer Grund.\n-- Modus ponens {uses: [3, 4]} --\n(5) [T]: Ein zweites Ergebnis.\n\n<Other>: Eine andere Begründung.\n  +> [X]: Etwas anderes.';
  const model = inferenceView(engine, whole, 'A'); expect(Object.keys(model.response.arguments ?? {})).toContain('A - 1'); expect(model.nodes.some(node => node.title === 'Other')).toBe(false); expect(model.nodes.some(node => node.title === 'X')).toBe(false); expect(model.nodes.filter(node => String(node.type) === 'statement-map-node')).toHaveLength(5);
 });
 it('does not let closed groups and hidden premises obscure an explicit structure preview', () => {
  const model = inferenceView(engine, '# Closed {isClosed: true}\n\n' + source.replace('[P]:', '[P]:').replace('sterblich.\n(2)', 'sterblich. {isInMap: false}\n(2)'), 'A'); expect(model.nodes.some(node => node.title === 'P')).toBe(true);
 });
 it('renders a reconstruction from the complete guide and leaves its source untouched', async () => {
  const whole = readFileSync(new URL('./fixtures/argdown-guide.argdown', import.meta.url), 'utf8'), model = inferenceView(engine, whole, 'Causal link questionable'); expect(model.nodes.length).toBeGreaterThan(3); expect(await engine.svg(model)).toContain('<svg'); expect(engine.parse(whole).source).toBe(whole);
 });
 it('edits the canonical caption shown by Argdown, including explicit canonical choices', () => {
  for (const [source, key, shown] of [['[A]: First\n\n[A]: Last', 's:A', 'Last'], ['<A>: First\n\n<A>: Last', 'a:A', 'Last'], ['[A]: First {isCanonical: true}\n\n[A]: Last', 's:A', 'First']] as const) {
   const model = engine.parse(source); expect(rawNodeText(model, key)).toBe(shown); const changed = editNode(engine, model, key, 'Visible change'); expect(engine.parse(changed).nodes.find(node => node.title === 'A')?.labelText?.trimEnd()).toBe('Visible change');
  }
 });
 it('changes native section fills and preserves the argument structure', () => {
  const model = engine.parse('# Group {custom: 42}\n\n' + source), group = model.nodes.find(node => String(node.type) === 'group-map-node')!;
  const next = engine.parse(nodeColor(engine, model, 'g:' + group.id, '#ff0000')); expect(next.nodes.find(node => node.id === group.id)?.color).toBe('#ff0000'); expect(next.source).toContain('custom: 42'); expect(next.response.arguments?.A?.pcs).toHaveLength(3);
 });
 it('keeps CRLF source configuration and body consistent', () => {const original = '===\r\ncustom: 1\r\n===\r\n\r\n[A]: Alpha', changed = changePresentation(engine, original, [{path: ['map', 'statementLabelMode'], value: 'title'}]); expect(changed.replace(/\r\n/gu, '')).not.toContain('\n'); expect(changed.endsWith('[A]: Alpha')).toBe(true);});
});
