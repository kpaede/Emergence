import {describe, expect, it} from 'vitest';
import {fieldAllowedForSource} from '../src/graph/field-scope';
import {SynopsisGraph} from '../src/graph/synopsis';
import {sourceFields} from '../src/llm/assignment-scope';
import {defaults} from '../src/config';
import {edge, graph, writerFixture} from './fixtures';

const roles = ['Konzept', 'Komponist_in', 'Autor_in', 'Künstler_in', 'Regisseur_in', 'Librettist_in'];
function fixture(tags: string[] = []) {
 const g = graph(); g.fields.push(...roles, 'Werk', 'Anderes Feld'); g.nodes[0]!.tags = tags; return g;
}
describe('additional fields follow source frontmatter tags', () => {
 it('shows every configured work role for any nested Werk tag, without genre assumptions', () => {
  for (const tag of ['Werk/Film', '#Werk/Musiktheater/Oper', 'Werk/Literatur', '#werk/Pop']) {
   const g = fixture([tag]), before = JSON.stringify(g);
   expect(new SynopsisGraph(g, defaults()).extraFields('Quelle.md')).toEqual(roles);
   expect(JSON.stringify(g)).toBe(before);
  }
 });
 it('does not expose empty fields or work roles on concept notes, even when they share names or relations', () => {
  for (const tags of [[], ['Begriff'], ['Werkzeug/Film'], ['Werk'], ['Anderes/Werk/Film']]) {
   const g = fixture(tags); g.nodes[0]!.title = 'Werk'; g.edges.push(edge('Quelle.md', 'Ziel.md', {field: 'Konzept'}));
   expect(new SynopsisGraph(g, defaults()).extraFields('Quelle.md')).toEqual([]);
  }
 });
 it('keeps existing connections in other fields visible and recognizes further configured creator roles', () => {
  const g = fixture(['Werk/Tanz']); g.fields.push('Choreograf_in'); g.inferenceRules = [{chain: ['Choreograf_in'], field: 'Werk', reversed: true, rounds: 1}];
  g.edges = [edge('Quelle.md', 'Ziel.md', {field: 'Werk'})];
  expect(new SynopsisGraph(g, defaults()).extraFields('Quelle.md')).toEqual([...roles, 'Werk', 'Choreograf_in']);
  expect(fieldAllowedForSource('Choreograf_in', ['Begriff'], g)).toBe(false);
 });
 it('uses frontmatter tags only for analysis scope, ignoring tags in the note body', () => {
  const g = fixture();
  expect(sourceFields('---\nÜberbau:\nKonzept:\nAutor_in:\n---\n#Werk/Literatur', g)).toEqual(['Überbau']);
  expect(sourceFields('---\ntags: ["#Werk/Literatur"]\nÜberbau:\nKonzept:\nAutor_in:\n---\nText', g)).toEqual(['Überbau', 'Konzept', 'Autor_in']);
 });
 it('checks current tags before a manual addition or move, leaving the note unchanged when the tag is missing', async () => {
  const f = await writerFixture(); f.snapshot.fields.push('Konzept');
  const before = f.files.get('Quelle.md');
  await expect(f.writer.addManualLink('Quelle.md', 'Konzept', 'Ziel.md', 'existing')).rejects.toThrow('Frontmatter-Tag unter Werk');
  await expect(f.writer.moveLinks([{source: 'Quelle.md', target: 'Alt.md', field: 'Überbau'}], 'Quelle.md', 'Konzept', 'Alt.md')).rejects.toThrow('Frontmatter-Tag unter Werk');
  expect(f.files.get('Quelle.md')).toBe(before); expect(f.stats().writes).toBe(0);
  f.files.set('Quelle.md', before!.replace('title: Original', 'title: Original\ntags: [Werk/Film]'));
  await f.writer.addManualLink('Quelle.md', 'Konzept', 'Ziel.md', 'existing'); expect(f.stats().writes).toBe(1);
 });
});
