import {describe, expect, it} from 'vitest';
import {synopsisAssignments} from '../src/graph/synopsis-assignments';
import {SynopsisGraph} from '../src/graph/synopsis';
import {parseFrontmatter} from '../src/review/frontmatter';
import {defaults} from '../src/config';
import {edge, graph, writerFixture} from './fixtures';

describe('moving stored graph relationships', () => {
 it('removes a direct link from its old field and appends it to an empty destination without touching other data', async () => {
  const f = await writerFixture(), before = parseFrontmatter(f.files.get('Quelle.md')!);
  await f.writer.moveLinks([{source: 'Quelle.md', field: 'Überbau', target: 'Alt.md'}], 'Quelle.md', 'Reibung', 'Alt.md');
  const after = parseFrontmatter(f.files.get('Quelle.md')!);
  expect(after.data.Überbau).toEqual([]); expect(after.data.Reibung).toEqual(['[[Alt]]']); expect(after.data.nested).toEqual(before.data.nested); expect(after.parts.body).toBe(before.parts.body);
  expect(f.writer.journal[0]).toMatchObject({kind: 'move', status: 'applied'}); expect(f.stats()).toMatchObject({writes: 1, saved: 1, refreshes: 1});
 });
 it('preserves list order and the alias of a moved scalar link', async () => {
  const f = await writerFixture(); f.files.set('Quelle.md', '---\nÜberbau: "[[Alt|Anderer Titel]]"\nReibung: ["[[Ziel]]"]\n---\nText');
  f.io.resolve = link => link.includes('Alt') ? 'Alt.md' : link === '[[Ziel]]' ? 'Ziel.md' : undefined;
  await f.writer.moveLinks([{source: 'Quelle.md', field: 'Überbau', target: 'Alt.md'}], 'Quelle.md', 'Reibung', 'Alt.md');
  expect(parseFrontmatter(f.files.get('Quelle.md')!).data).toEqual({Überbau: [], Reibung: ['[[Ziel]]', '[[Alt|Anderer Titel]]']});
 });
 it('moves an inverse-only relationship by updating the note that owns it and the displayed focus', async () => {
  const f = await writerFixture(); f.snapshot.fields.push('Unterbau'); f.snapshot.edges = [edge('Ziel.md', 'Quelle.md', {field: 'Unterbau'})];
  f.files.set('Ziel.md', '---\nUnterbau: ["[[Quelle]]"]\nprivate: behalten\n---\nZieltext');
  const origins = synopsisAssignments(f.snapshot, f.settings, 'Quelle.md', 'Ziel.md', ['Überbau']);
  expect(origins).toEqual([{source: 'Ziel.md', target: 'Quelle.md', field: 'Unterbau'}]);
  await f.writer.moveLinks(origins, 'Quelle.md', 'Reibung', 'Ziel.md');
  expect(parseFrontmatter(f.files.get('Ziel.md')!).data).toEqual({Unterbau: [], private: 'behalten'});
  expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Reibung).toEqual(['[[Ziel]]']); expect(f.writer.journal).toHaveLength(2);
  f.snapshot.edges = [edge('Quelle.md', 'Ziel.md', {field: 'Reibung'})];
  const model = new SynopsisGraph(f.snapshot, f.settings); expect(model.neighbors('Quelle.md', 'broader')).not.toContain('Ziel.md'); expect(model.neighbors('Quelle.md', 'friction')).toContain('Ziel.md');
 });
 it('resolves symmetric and configured inverse origins, without treating transitive or free links as editable', () => {
  const g = graph(); g.rules.Reibung!.symmetric = true;
  g.edges = [edge('Ziel.md', 'Quelle.md', {field: 'Reibung'}), edge('Quelle.md', 'Ziel.md', {field: 'Reibung', explicit: false}), edge('Quelle.md', 'Ziel.md', {field: 'Reibung', layer: 'obsidian'})];
  expect(synopsisAssignments(g, defaults(), 'Quelle.md', 'Ziel.md', ['Reibung'])).toEqual([{source: 'Ziel.md', target: 'Quelle.md', field: 'Reibung'}]);
  g.inferenceRules = [{chain: ['Reibung'], field: 'Überbau', reversed: true, rounds: 1}];
  expect(synopsisAssignments(g, defaults(), 'Quelle.md', 'Ziel.md', ['Überbau'])).toHaveLength(1);
 });
 it('removes both explicitly stored directions so the old displayed group does not persist', async () => {
  const f = await writerFixture(); f.snapshot.fields.push('Unterbau'); f.snapshot.edges = [edge('Quelle.md', 'Alt.md'), edge('Alt.md', 'Quelle.md', {field: 'Unterbau'})];
  f.files.set('Alt.md', '---\nUnterbau: ["[[Quelle]]"]\n---\nAlt');
  const origins = synopsisAssignments(f.snapshot, f.settings, 'Quelle.md', 'Alt.md', ['Überbau']); expect(origins).toHaveLength(2);
  await f.writer.moveLinks(origins, 'Quelle.md', 'Reibung', 'Alt.md');
  expect(parseFrontmatter(f.files.get('Alt.md')!).data.Unterbau).toEqual([]); expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Überbau).toEqual([]);
 });
 it('rejects duplicate destinations and mixed YAML values before making any changes', async () => {
  for (const destination of ['["[[Alt]]"]', '["[[Ziel]]", 1]', '{nested: value}']) {
   const f = await writerFixture(); f.files.set('Quelle.md', f.files.get('Quelle.md')!.replace('title: Original', `title: Original\nReibung: ${destination}`));
   const before = f.files.get('Quelle.md');
   await expect(f.writer.moveLinks([{source: 'Quelle.md', field: 'Überbau', target: 'Alt.md'}], 'Quelle.md', 'Reibung', 'Alt.md')).rejects.toThrow();
   expect(f.files.get('Quelle.md')).toBe(before); expect(f.stats().writes).toBe(0);
  }
 });
 it('rolls back an inverse removal if the destination changes concurrently, preserving the user edit', async () => {
  const f = await writerFixture(), process = f.io.process.bind(f.io); f.snapshot.fields.push('Unterbau');
  const original = '---\nUnterbau: ["[[Quelle]]"]\n---\nAlt'; f.files.set('Alt.md', original);
  f.io.process = (path, update) => {
   if (path === 'Quelle.md') f.files.set(path, f.files.get(path)! + '\nEigene Änderung.');
   return process(path, update);
  };
  await expect(f.writer.moveLinks([{source: 'Alt.md', field: 'Unterbau', target: 'Quelle.md'}], 'Quelle.md', 'Reibung', 'Alt.md')).rejects.toThrow('inzwischen verändert');
  expect(f.files.get('Alt.md')).toBe(original); expect(f.files.get('Quelle.md')).toContain('Eigene Änderung.'); expect(f.writer.journal).toHaveLength(0);
 });
 it('keeps missing targets as links and does not create files during a move', async () => {
  const f = await writerFixture(); f.files.set('Quelle.md', f.files.get('Quelle.md')!.replace('[[Alt]]', '[[Fehlt]]'));
  const count = f.files.size;
  await f.writer.moveLinks([{source: 'Quelle.md', field: 'Überbau', target: 'Fehlt.md'}], 'Quelle.md', 'Reibung', 'Fehlt.md');
  expect(f.files.size).toBe(count); expect(parseFrontmatter(f.files.get('Quelle.md')!).data.Reibung).toEqual(['[[Fehlt]]']);
 });
});
