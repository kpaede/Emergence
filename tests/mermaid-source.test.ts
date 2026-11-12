import {describe, expect, it} from 'vitest';
import {fencedSource, mermaidBlocks, relocateBlock, replaceBlock} from '../src/mermaid/blocks';
import {MermaidHistory} from '../src/mermaid/history';
import {flowHeader, idRanges, statements} from '../src/mermaid/source';
import {moveToGroup, parents, rootSelection, validGroupTarget} from '../src/mermaid/groups';
import {addMindChild, deleteMindBranch, editMindNode, moveMindBranch} from '../src/mermaid/mindmap';
import type {FlowModel, MindModel, MindNode} from '../src/mermaid/types';
import {flowColor, flowEdgeColor} from '../src/mermaid/flow-actions';

const diagram = 'flowchart LR\n A --> B';
const note = (source = diagram): string => 'Vorher\n\n```mermaid\n' + source + '\n```\n\nNachher\n';
describe('Mermaid block identity and writes', () => {
 it('distinguishes identical diagrams and ignores Mermaid fences inside longer code fences', () => {
  const text = '````text\n' + note() + '````\n' + note() + note();
  const blocks = mermaidBlocks(text); expect(blocks).toHaveLength(2); expect(blocks[0]!.from).not.toBe(blocks[1]!.from);
  const updated = replaceBlock(text, blocks[1]!, 'mindmap\n Root'); expect(mermaidBlocks(updated).map(b => b.source)).toEqual([diagram, 'mindmap\n Root']);
 });
 it('maps a block across edits before and after it without changing its identity', () => {
  const before = note() + note(), block = mermaidBlocks(before)[1]!, next = 'Neue Zeile\n' + before;
  const moved = relocateBlock(before, next, block); expect(moved.index).toBe(1); expect(moved.from).toBe(block.from + 11);
  expect(relocateBlock(next, next + 'Ende', moved).from).toBe(moved.from);
 });
 it('detects external source edits but refuses removed fences instead of editing the next block', () => {
  const before = note() + note(), block = mermaidBlocks(before)[0]!, edited = replaceBlock(before, block, 'flowchart LR\n X --> Y');
  expect(relocateBlock(before, edited, block).source).toContain('X --> Y');
  expect(() => relocateBlock(before, before.slice(block.to), block)).toThrow();
 });
 it('preserves CRLF and surrounding note content', () => {
  const before = note().replace(/\n/gu, '\r\n'), block = mermaidBlocks(before)[0]!, after = replaceBlock(before, block, 'flowchart TD\n X --> Y');
  expect(after).not.toMatch(/(?<!\r)\n/u); expect(after.startsWith('Vorher\r\n\r\n')).toBe(true); expect(after.endsWith('\r\nNachher\r\n')).toBe(true);
 });
 it('uses a longer enclosing fence when the diagram contains backticks', () => {expect(fencedSource('flowchart LR\n A["```"]')).toMatch(/^````mermaid\n/u);});
 it('refuses to close an existing Markdown block through its source', () => {const before = note(); expect(() => replaceBlock(before, mermaidBlocks(before)[0]!, 'flowchart LR\n```\nOutside')).toThrow('Markdown-Zaun');});
});
describe('shared Mermaid undo history', () => {
 it('groups typing, records mouse actions separately and truncates redo after new edits', () => {
  const history = new MermaidHistory('a'); history.push('ab', true, 1000); history.push('abc', true, 1200); history.push('abc --> d', false, 1300);
  expect(history.undo()).toBe('abc'); expect(history.undo()).toBe('a'); expect(history.redo()).toBe('abc'); history.push('new'); expect(history.canRedo).toBe(false); expect(history.undo()).toBe('abc');
 });
 it('never coalesces the first edit after undo', () => {const history = new MermaidHistory('a'); history.push('b', true, 1000); history.undo(); history.push('c', true, 1100); expect(history.undo()).toBe('a');});
});
const model = (): FlowModel => ({type: 'flowchart', nodes: new Map(['A', 'B', 'C', 'D'].map(id => [id, {id, labelType: 'text', styles: [], classes: []}])), edges: [], subgraphs: [
 {id: 'Inner', title: 'Inner', nodes: ['A', 'B'], classes: [], labelType: 'text'},
 {id: 'Outer', title: 'Outer', nodes: ['Inner', 'C'], classes: [], labelType: 'text'},
]});
const nested = 'flowchart LR\nsubgraph Outer\n subgraph Inner\n  A --> B\n end\n C\nend\nB --> D\nlinkStyle 0 stroke:red\n%% Keep this comment\n';
describe('nested subgraph transformations', () => {
 it('normalizes a selected ancestor and descendant and excludes invalid hierarchy targets', () => {
  const graph = model(); expect(rootSelection(graph, ['Outer', 'A', 'D'])).toEqual(['Outer', 'D']);
  expect(validGroupTarget(graph, ['Outer'], 'Inner')).toBe(false); expect(validGroupTarget(graph, ['Inner'], 'Inner')).toBe(false); expect(validGroupTarget(graph, ['A', 'D'], 'Inner')).toBe(true);
 });
 it('preserves edge statements, comments and positional styles when moving across groups', () => {
  const after = moveToGroup(nested, model(), ['A', 'D'], 'Outer');
  expect(after).toContain('A --> B'); expect(after).toContain('B --> D'); expect(after).toContain('linkStyle 0 stroke:red'); expect(after).toContain('%% Keep this comment');
  expect(after.match(/subgraph Inner/gu)).toHaveLength(1); expect(after.indexOf('subgraph Inner')).toBeGreaterThan(after.indexOf('subgraph Outer'));
 });
 it('supports a new group nested inside an existing group and rejects id collisions', () => {
  expect(moveToGroup(nested, model(), ['A', 'B'], '', {id: 'New', title: 'Neue Gruppe', parent: 'Inner'})).toContain('      subgraph New ["Neue Gruppe"]');
  expect(() => moveToGroup(nested, model(), ['A'], '', {id: 'A', title: 'Bad'})).toThrow('bereits vergeben');
 });
 it('dissolves only the selected wrapper and retains nested groups and all nodes', () => {
  const after = moveToGroup(nested, model(), [], '', undefined, 'Outer'); expect(after).not.toContain('subgraph Outer'); expect(after).toContain('subgraph Inner'); expect(after).toContain('C'); expect(parents(model()).get('A')).toBe('Inner');
 });
 it('refuses ambiguous ownership', () => {const graph = model(); graph.subgraphs[1]!.nodes.push('A'); expect(() => parents(graph)).toThrow('nicht eindeutig');});
});
describe('lossless statement boundaries and source highlighting', () => {
 it('recognizes omitted directions and separates an inline header from the first statement', () => {expect(flowHeader('flowchart\n A --> B').text).toBe('flowchart\n'); expect(flowHeader('graph LR A-->B').text).toBe('graph LR ');});
 it('keeps semicolons and newlines inside labels, metadata and directives', () => {
  const source = 'flowchart LR; A["One; Two\nThree"] --> B@{label: "A; B"}; %% comment; untouched\nstyle A fill:red\n';
  const items = statements(source); expect(items.map(s => s.text).join('')).toBe(source); expect(items).toHaveLength(4); expect(items[1]!.text).toContain('Three');
 });
 it('does not mistake quoted labels, bare label text, comments or arrows for ids', () => {
  const source = 'flowchart LR\nA[A]-->B["A"]\n%% A\nstyle B fill:red\n'; const ranges = idRanges(source, ['A', 'B']);
  expect(ranges.get('A')).toHaveLength(1); expect(ranges.get('B')).toHaveLength(2); expect(source.slice(ranges.get('A')![0]!.from, ranges.get('A')![0]!.to)).toBe('A');
 });
});
describe('portable per-element color edits', () => {
 it('preserves other node properties and removes previous explicit values on reset', () => {
  const source = 'flowchart LR\n A --> B\n style A fill:red,stroke:blue\n style A color:white\n';
  const next = flowColor(source, ['A'], 'fill', '#123abc'); expect(next).toContain('stroke:blue'); expect(next).toContain('color:white'); expect(next).toContain('fill:#123abc'); expect(next).not.toContain('fill:red');
  expect(flowColor(next, ['A'], 'fill')).not.toContain('fill:');
 });
 it('splits shared link styles without changing an unselected connection', () => {
  const graph = model(); graph.edges = ['A', 'B'].map(start => ({start, end: 'C', text: '', labelType: 'text', classes: [], isUserDefinedId: false, style: ['stroke:red', 'color:navy']}));
  const source = 'flowchart LR\n A --> C\n B --> C\n linkStyle 0,1 stroke:red,color:navy\n';
  const next = flowEdgeColor(source, graph, [0], 'stroke', 'gold'); expect(next).toContain('linkStyle 1 stroke:red,color:navy'); expect(next).toContain('linkStyle 0 color:navy,stroke:gold');
  graph.edges[0]!.style = ['color:navy', 'stroke:gold']; const reset = flowEdgeColor(next, graph, [0], 'stroke'); expect(reset).toContain('linkStyle 0 color:navy'); expect(reset).not.toContain('stroke:gold'); expect(reset).toContain('linkStyle 1 stroke:red,color:navy');
 });
});
function mind(): MindModel {
 const leaf = (id: number, nodeId: string, level: number, children: MindNode[] = []): MindNode => ({id, nodeId, level, descr: nodeId, type: 2, children, isRoot: id === 0});
 const b = leaf(2, 'B', 4), a = leaf(1, 'A', 2, [b]), c = leaf(3, 'C', 2), root = leaf(0, 'Root', 0, [a, c]); return {type: 'mindmap', nodes: [root, a, b, c]};
}
const mindSource = 'mindmap\nRoot[Root]\n  A[A]\n    B[B]\n  C[C]\n';
describe('Mindmap tree editing', () => {
 it('adds a child before the next sibling without moving that sibling', () => {expect(addMindChild(mindSource, mind(), 'A')).toContain('    B[B]\n    n1[Neuer Knoten]\n  C[C]');});
 it('moves an entire branch and rejects self, descendant and root moves', () => {
  expect(moveMindBranch(mindSource, mind(), 'A', 'C')).toBe('mindmap\nRoot[Root]\n  C[C]\n    A[A]\n      B[B]\n');
  for (const [from, to] of [['A', 'A'], ['A', 'B'], ['Root', 'C']]) expect(() => moveMindBranch(mindSource, mind(), from!, to!)).toThrow();
 });
 it('preserves node ids when changing labels and removes exactly one subtree', () => {
  expect(editMindNode(mindSource, mind(), 'A', 'Andere Idee')).toContain('  A["Andere Idee"]');
  expect(deleteMindBranch(mindSource, mind(), 'A')).toBe('mindmap\nRoot[Root]\n  C[C]\n');
 });
});
