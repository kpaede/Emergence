import {describe, expect, it} from 'vitest';
import {associativeIdeasSchema, parseAssociativeIdeas} from '../src/llm/assignment-schema';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import type {LLMProvider} from '../src/llm/provider';
import {defaults} from '../src/config';
import {parseFrontmatter} from '../src/review/frontmatter';
import {graph, profile, result, suggestion, writerFixture} from './fixtures';

async function fixture() {
 const f = await writerFixture();
 f.snapshot.rules.Reibung = {...f.snapshot.rules.Überbau!, label: 'Reibung', targetProperty: 'Reibung'};
 f.files.set('Quelle.md', f.files.get('Quelle.md')!.replace('Überbau:', 'Reibung:\nÜberbau:'));
 f.review.set(await result({associative: true, fields: ['Überbau', 'Reibung'], suggestions: [
  await suggestion({field: '', property: '', contract: 'breadcrumbs-v2', evidenceSource: 'title', evidence: 'Quelle', targetSelected: true}),
 ]}));
 return f;
}
describe('unassigned associative terms', () => {
 it('accepts only one bounded term list, rejecting automatic field assignments and duplicate terms', () => {
  const schema = associativeIdeasSchema(2);
  expect(parseAssociativeIdeas('{"ideas":["A","B"]}', schema).suggestions).toEqual([{field: '', target: 'A', evidence: 'T'}, {field: '', target: 'B', evidence: 'T'}]);
  for (const bad of [{ideas: ['A', 'A']}, {ideas: ['A', 'B', 'C']}, {Überbau: ['A']}, {ideas: ['A'], field: 'Überbau'}, {ideas: [{field: 'Überbau', target: 'A'}]}]) expect(() => parseAssociativeIdeas(JSON.stringify(bad), schema)).toThrow();
 });
 it('uses all field descriptions as inspiration and resolves aliases without assigning or repeating targets', async () => {
  const g = graph(); g.rules.Reibung!.description = 'Gegenposition'; g.nodes = g.nodes.filter(n => n.id !== 'Ordner/Ziel.md');
  const provider: LLMProvider = {health: async () => ({models: [], thinking: false, metadata: {}, version: ''}), cancel: () => {}, chat: async request => {
   expect(request.messages[0]!.content).toContain('Ordne keinen Begriff einem Feld zu');
   expect(request.messages[1]!.content).toContain('Überbau: Oberbegriff');
   expect(request.messages[1]!.content).toContain('Reibung: Gegenposition');
   expect(request.format).toHaveProperty('properties.ideas');
   return JSON.stringify({ideas: ['Target', 'Ziel', 'Neuer Begriff']});
  }};
  const a = await new DocumentAnalyzer(provider).analyze('Quelle.md', '---\nÜberbau:\nReibung:\n---\nEine Notiz.', g, profile(), defaults(), new AbortController().signal, () => {}, {fields: g.fields, folders: [], allowNew: true, maxSuggestions: 8, associative: true, outputId: 'relations'});
  expect(a.status, a.errors.join('\n')).toBe('complete'); expect(a.associative).toBe(true);
  expect(a.suggestions.map(s => s.target)).toEqual(['Ziel.md', 'Neuer Begriff.md']);
  expect(a.suggestions.every(s => s.field === '' && s.property === '' && s.status === 'pending')).toBe(true);
 });
 it('requires an explicit destination and leaves the pending idea untouched on failure', async () => {
  const f = await fixture(); f.review.refreshTargets(f.snapshot); const before = f.review.analysis;
  await expect(f.writer.applyIdea('s1')).rejects.toThrow('Feld');
  await expect(f.writer.applyIdea('s1', 'Unbekannt')).rejects.toThrow('Feld');
  expect(f.stats().writes).toBe(0); expect(f.review.analysis).toEqual(before);
 });
 it('writes to the user-selected field only and undo restores the unassigned term', async () => {
  const f = await fixture(), before = parseFrontmatter(f.files.get('Quelle.md')!);
  const entry = await f.writer.applyIdea('s1', 'Reibung'), after = parseFrontmatter(f.files.get('Quelle.md')!);
  expect(after.data.Reibung).toEqual(['[[Ziel]]']); expect(after.data.Überbau).toEqual(before.data.Überbau); expect(after.parts.body).toBe(before.parts.body);
  expect(f.review.analysis?.suggestions).toEqual([]);
  await f.writer.undoIdea(entry.id);
  expect(f.review.analysis?.suggestions[0]).toMatchObject({field: '', property: '', status: 'pending'});
 });
 it('checks destination permissions, ambiguity and removed frontmatter fields before writing', async () => {
  const f = await fixture(); f.snapshot.rules.Reibung!.writable = false;
  await expect(f.writer.applyIdea('s1', 'Reibung')).rejects.toThrow('Schreibfreigabe');
  f.snapshot.rules.Reibung!.writable = true; f.files.set('Quelle.md', f.files.get('Quelle.md')!.replace('Reibung:\n', ''));
  await expect(f.writer.applyIdea('s1', 'Reibung')).rejects.toThrow('nicht mehr im Frontmatter');
  expect(f.stats().writes).toBe(0); expect(f.review.analysis?.suggestions[0]!.field).toBe('');
 });
});
