import {describe, expect, it} from 'vitest';
import {ChangeSet, Text} from '@codemirror/state';
import {TFile,type App} from 'obsidian';
import {MermaidBinding, notifyMermaidEditorChange} from '../src/mermaid/binding';
import {mermaidBlocks, replaceBlock} from '../src/mermaid/blocks';
import {mindmapColors} from '../src/mermaid/mindmap-colors';

const fence = '```mermaid\nflowchart LR\n A --> B\n```\n';
function host(initial: string): {app: App; file: TFile; read: () => string; edit: (from: number, to: number, insert: string) => void; writes: () => number} {
 let text = initial, writes = 0;
 const file = new TFile();file.path='Note.md';
 const app = {workspace: {getLeavesOfType: () => []}, vault: {read: () => Promise.resolve(text), process: (_file: TFile, change: (text: string) => string) => {text = change(text); writes++; return Promise.resolve(text);}}} as unknown as App;
 return {app, file, read: () => text, writes: () => writes, edit: (from, to, insert) => {
  const changes = ChangeSet.of({from, to, insert}, text.length), next = changes.apply(Text.of(text.split('\n'))).toString();
  notifyMermaidEditorChange(app, file, text, next, changes); text = next;
 }};
}
describe('Mermaid binding transaction safety', () => {
 it('tracks a specific duplicate across an insertion exactly at its opening fence', async () => {
  const h = host(fence + fence), block = mermaidBlocks(h.read())[1]!, binding = new MermaidBinding(h.app, h.file, h.read(), block);
  h.edit(block.from, block.from, '\nDavor\n'); await binding.save('flowchart LR\n X --> Y');
  expect(mermaidBlocks(h.read()).map(b => b.source)).toEqual(['flowchart LR\n A --> B', 'flowchart LR\n X --> Y']); binding.dispose();
 });
 it('detects deletion even when the next complete block is identical', async () => {
  const h = host(fence + fence), binding = new MermaidBinding(h.app, h.file, h.read(), mermaidBlocks(h.read())[0]!);
  h.edit(0, fence.length, ''); await expect(binding.pending).rejects.toThrow('entfernt'); await expect(binding.save('flowchart LR\n X --> Y')).rejects.toThrow(); expect(h.read()).toBe(fence); expect(h.writes()).toBe(0); binding.dispose();
 });
 it('imports external edits and refuses to overwrite them with an unsaved competing edit', async () => {
  const h = host(fence), block = mermaidBlocks(h.read())[0]!, binding = new MermaidBinding(h.app, h.file, h.read(), block), at = h.read().indexOf('A --> B');
  h.edit(at, at + 1, 'C'); await expect(binding.save('flowchart LR\n X --> Y')).rejects.toThrow('gleichzeitig'); expect(h.read()).toContain('C --> B'); expect(h.writes()).toBe(0); binding.dispose();
 });
 it('continues safely after importing a note edit and preserves changes outside the block', async () => {
  const h = host('Intro\n' + fence + 'Ende\n'), block = mermaidBlocks(h.read())[0]!, binding = new MermaidBinding(h.app, h.file, h.read(), block), at = h.read().indexOf('A --> B');
  h.edit(at, at + 1, 'C'); expect(await binding.refresh()).toContain('C --> B');
  h.edit(0, 5, 'Neue Einleitung'); await binding.save('flowchart LR\n D --> E'); expect(h.read()).toMatch(/^Neue Einleitung\n/u); expect(h.read()).toContain('D --> E'); expect(h.read()).toMatch(/Ende\n$/u); binding.dispose();
 });
 it('serializes consecutive live writes', async () => {
  const h = host(fence), binding = new MermaidBinding(h.app, h.file, h.read(), mermaidBlocks(h.read())[0]!);
  await Promise.all([binding.save('flowchart LR\n X --> Y'), binding.save('flowchart LR\n Y --> Z')]); expect(h.writes()).toBe(2); expect(h.read()).toContain('Y --> Z'); binding.dispose();
 });
 it('matches a source replacement without rewriting surrounding Markdown', () => {
  const text = 'Intro\n' + fence + 'Ende\n'; expect(replaceBlock(text, mermaidBlocks(text)[0]!, 'mindmap\n Root')).toBe('Intro\n```mermaid\nmindmap\n Root\n```\nEnde\n');
 });
});
describe('portable Mindmap color palettes', () => {
 it('preserves existing configuration and comments when adding or removing a branch color', () => {
  const source = '---\n# Keep comment\ntitle: Idee\nconfig:\n  themeVariables:\n    cScale2: red\n---\nmindmap\n Root\n  Child\n';
  const added = mindmapColors(source, ['cScale1'], '#123abc'); expect(added).toContain('# Keep comment'); expect(added).toContain('title: Idee'); expect(added).toContain('cScale2: red'); expect(added).toContain('cScale1:'); expect(added).toContain('#123abc');
  const removed = mindmapColors(added, ['cScale1']); expect(removed).not.toContain('cScale1:'); expect(removed).toContain('cScale2: red'); expect(removed).toMatch(/---\nmindmap\n Root\n {2}Child\n$/u);
 });
 it('creates frontmatter only when needed and rejects invalid palette slots', () => {
  const source = 'mindmap\n Root\n'; expect(mindmapColors(source, ['cScale1'])).toBe(source); expect(mindmapColors(source, ['cScale8'], 'gold')).toContain('cScale8: gold'); expect(() => mindmapColors(source, ['other'], 'red')).toThrow();
 });
});
