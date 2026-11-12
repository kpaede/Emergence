import {describe, expect, it} from 'vitest';
import {highlightMermaidRanges} from '../src/mermaid/highlighting';
import {labelSource, labelText} from '../src/mermaid/labels';
import {addMindChild, addMindSibling, editMindNode, mindLines, reorderMindBranch} from '../src/mermaid/mindmap';
import {flowDirection, hasOutsideConnection} from '../src/mermaid/direction';
import type {FlowModel, MindModel, MindNode} from '../src/mermaid/types';

function mind(indent = 1): MindModel {
 const b: MindNode = {id: 2, nodeId: 'B', level: indent, descr: 'B', type: 2, children: [], isRoot: false};
 const a: MindNode = {...b, id: 1, nodeId: 'A', descr: 'A'};
 const root: MindNode = {...b, id: 0, nodeId: 'root', level: 0, descr: 'Root', isRoot: true, children: [a, b]}; return {type: 'mindmap', nodes: [root, a, b]};
}
const source = 'mindmap\nroot[Root]\n A[A]\n B[B]\n';
describe('Mindmap insertion and sibling order', () => {
 it('uses the existing single-space child indentation instead of making a grandchild', () => {expect(addMindChild(source, mind(), 'root')).toBe(source + ' n1[Neuer Knoten]\n');});
 it('adds siblings immediately before or after the selected subtree', () => {
  expect(addMindSibling(source, mind(), 'B', 'before')).toBe('mindmap\nroot[Root]\n A[A]\n n1[Neuer Knoten]\n B[B]\n');
  expect(addMindSibling(source, mind(), 'A', 'after')).toBe('mindmap\nroot[Root]\n A[A]\n n1[Neuer Knoten]\n B[B]\n');
  expect(() => addMindSibling(source, mind(), 'root', 'before')).toThrow();
 });
 it('reorders a last sibling correctly without a trailing newline', () => {expect(reorderMindBranch(source.trimEnd(), mind(), 'B', -1)).toBe('mindmap\nroot[Root]\n B[B]\n A[A]\n');});
 it('associates multiline Markdown labels and preserves decorations', () => {
  const text = 'mindmap\nroot[Root]\n A["`**One**\nTwo`"]\n ::icon(fa fa-book)\n B[B]\n';
  expect(mindLines(text, mind()).map(l => l.node.nodeId)).toEqual(['root', 'A', 'B']);
  const changed = editMindNode(text, mind(), 'A', 'New **label**', undefined, 'markdown'); expect(changed).toContain(' A["`New **label**`"]\n ::icon(fa fa-book)'); expect(changed).toContain(' B[B]');
 });
});
describe('Text and Markdown labels', () => {
 it('encodes literal Markdown punctuation and round-trips it for the editor', () => {const raw = '**fett** _kursiv_ [Text](URL)'; expect(labelText(labelSource(raw, 'text').slice(1, -1))).toBe(raw); expect(labelSource(raw, 'text')).not.toContain('**'); expect(labelSource(raw, 'markdown')).toBe('"`' + raw + '`"');});
 it('decodes Pele model entity placeholders without inserting HTML', () => {expect(labelText('ﬂ°°42¶ßTestﬂ°°42¶ß<br/>#quot;')).toBe('*Test*\n"');});
});
describe('Pele website Mermaid highlighting', () => {
 it('distinguishes identifiers, shape labels, edge labels, directions, metadata, styles, YAML and comments', () => {
  const code = '---\nconfig:\n  theme: base\n---\nflowchart LR\n A[Start] -->|Ja| B{Entscheidung}\n B@{ shape: rect, label: "Text" }\n style A fill:#ff0000,stroke-width:2px\n %% Kommentar\n';
  const tokens = highlightMermaidRanges(code), has = (text: string, cls: string): boolean => tokens.some(t => t.className === cls && code.slice(t.from, t.to) === text);
  expect(has('config', 'syn-yaml-key')).toBe(true); expect(has('flowchart', 'syn-keyword')).toBe(true); expect(has('LR', 'syn-constant')).toBe(true);
  expect(has('A', 'syn-variable')).toBe(true); expect(has('Start', 'syn-string')).toBe(true); expect(has('Ja', 'syn-string')).toBe(true); expect(has('shape', 'syn-variable')).toBe(true);
  expect(has('#ff0000', 'syn-constant')).toBe(true); expect(has('2px', 'syn-number')).toBe(true); expect(has('%% Kommentar', 'syn-comment')).toBe(true);
 });
 it('preserves source offsets through escaped HTML, Unicode and multiline strings', () => {
  const code = 'flowchart TD\n A["Ä < > & \' text\nnext"] --> B[End]\n', tokens = highlightMermaidRanges(code);
  expect(tokens.every(t => t.from >= 0 && t.to <= code.length && t.to > t.from)).toBe(true);
  expect(tokens.some(t => code.slice(t.from, t.to).includes('Ä < > &'))).toBe(true); expect(tokens.some(t => t.className === 'syn-variable' && code.slice(t.from, t.to) === 'B')).toBe(true);
 });
});
describe('Flowchart direction directives', () => {
 const model: FlowModel = {type: 'flowchart', nodes: new Map([['A', {id: 'A', text: 'A', labelType: 'text', styles: [], classes: []}]]), edges: [], subgraphs: [{id: 'G', title: 'Group', nodes: ['A'], classes: [], labelType: 'text'}]};
 const code = 'flowchart TD\n subgraph G[Group]\n A\n end\n';
 it('sets the root direction and rejects unknown values', () => {expect(flowDirection(code, model, 'LR')).toMatch(/^flowchart LR\n/u); expect(() => flowDirection(code, model, 'other')).toThrow();});
 it('adds an explicit local direction and restores inheritance', () => {
  const explicit = flowDirection(code, model, 'RL', 'G'); expect(explicit).toContain('direction RL');
  const inherited = flowDirection(explicit, {...model, subgraphs: [{...model.subgraphs[0]!, dir: 'RL'}]}, '', 'G'); expect(inherited).not.toContain('direction');
 });
 it('distinguishes an outside node connection from a connection to the group itself', () => {
  const edge = {id: 'e', start: 'A', end: 'X', text: '', type: 'arrow_point', stroke: 'normal', length: 1, classes: [], isUserDefinedId: false, labelType: 'string'};
  expect(hasOutsideConnection({...model, edges: [edge]}, 'G')).toBe(true);
  expect(hasOutsideConnection({...model, edges: [{...edge, start: 'G'}]}, 'G')).toBe(false);
  expect(hasOutsideConnection({...model, edges: [{...edge, end: 'A'}]}, 'G')).toBe(false);
 });
 it('checks descendants when a subgraph contains nested subgraphs', () => {
  const nested: FlowModel = {...model, subgraphs: [{...model.subgraphs[0]!, nodes: ['H']}, {...model.subgraphs[0]!, id: 'H', nodes: ['A']}], edges: [{id: 'e', start: 'A', end: 'X', text: '', type: 'arrow_point', stroke: 'normal', length: 1, classes: [], isUserDefinedId: false, labelType: 'string'}]};
  expect(hasOutsideConnection(nested, 'G')).toBe(true); expect(hasOutsideConnection(nested, 'H')).toBe(true);
 });
});
