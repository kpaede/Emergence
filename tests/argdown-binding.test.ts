import {describe, it, expect} from 'vitest';
import type {App, TFile} from 'obsidian';
import {ChangeSet, Text} from '@codemirror/state';
import {MermaidBinding, notifyMermaidEditorChange} from '../src/mermaid/binding';
import {MermaidLibrary} from '../src/mermaid/library';
import {ARGDOWN_EXAMPLES, ARGDOWN_LANGUAGE, argdownBlocks, argdownFence} from '../src/argdown/blocks';
function fixture() {
 const fence = argdownFence('[A]: Gleich'), file = {path: 'Test.md'} as TFile;
 let text = fence + '\n\n' + fence, writes = 0;
 const app = {workspace: {getLeavesOfType: () => []}, vault: {read: () => Promise.resolve(text), process: (_file: TFile, action: (s: string) => string) => {text = action(text); writes++; return Promise.resolve(text);}}} as unknown as App;
 return {app, file, text: () => text, writes: () => writes, edit: (from: number, to: number, insert: string) => {const change = ChangeSet.of({from, to, insert}, text.length), next = change.apply(Text.of(text.split('\n'))).toString(); notifyMermaidEditorChange(app, file, text, next, change); text = next;}};
}
describe('Argdown exact block identity and local templates', () => {
 it('tracks the second of identical blocks through a preceding note edit', async () => {
  const h = fixture(), binding = new MermaidBinding(h.app, h.file, h.text(), argdownBlocks(h.text())[1]!, ARGDOWN_LANGUAGE);
  try {h.edit(0, 0, 'Einleitung\n\n'); await binding.save('[A]: Geändert'); expect(argdownBlocks(h.text()).map(b => b.source)).toEqual(['[A]: Gleich', '[A]: Geändert']); expect(h.text()).toMatch(/^Einleitung/u);} finally {binding.dispose();}
 });
 it('never overwrites the following identical block when the open block is deleted', async () => {
  const h = fixture(), block = argdownBlocks(h.text())[0]!, binding = new MermaidBinding(h.app, h.file, h.text(), block, ARGDOWN_LANGUAGE);
  try {h.edit(block.from, block.to, ''); await expect(binding.pending).rejects.toThrow('entfernt'); await expect(binding.save('[A]: Geändert')).rejects.toThrow(); expect(h.writes()).toBe(0); expect(argdownBlocks(h.text())[0]?.source).toBe('[A]: Gleich');} finally {binding.dispose();}
 });
 it('keeps Argdown defaults, deletions and custom templates separate from Mermaid', async () => {
  const library = new MermaidLibrary(undefined, () => Promise.resolve(), ARGDOWN_EXAMPLES), mermaid = new MermaidLibrary(undefined, () => Promise.resolve());
  await library.remove(ARGDOWN_EXAMPLES[0]!.id); await library.add('Eigene Debatte', '[A]: Alpha');
  const restored = new MermaidLibrary(library.snapshot(), () => Promise.resolve(), ARGDOWN_EXAMPLES);
  expect(restored.list()).toHaveLength(ARGDOWN_EXAMPLES.length); expect(restored.list().some(t => t.id === ARGDOWN_EXAMPLES[0]!.id)).toBe(false); expect(restored.list().some(t => t.name === 'Eigene Debatte')).toBe(true); expect(mermaid.list()).toHaveLength(60);
 });
});
