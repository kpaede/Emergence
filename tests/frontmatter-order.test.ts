import {describe, expect, it} from 'vitest';
import {frontmatterOrder} from '../src/graph/frontmatter-order';
import {SynopsisGraph} from '../src/graph/synopsis';
import {defaults} from '../src/config';
import {edge, graph} from './fixtures';

describe('Frontmatter order without additional saved metadata', () => {
 it('uses numeric list positions, including aliases, qualified paths and missing targets', () => {
  const targets = ['Alt.md', 'Ziel.md', 'Kontext/Fehlt.md', 'Ordner/Ziel.md'];
  const edges = targets.map(target => edge('Quelle.md', target));
  const ordered = frontmatterOrder(edges, {
   cache: () => ({frontmatterLinks: [
    {key: 'Überbau.2', link: 'Alt#Abschnitt'}, {key: 'Überbau.10', link: 'Target'},
    {key: 'Überbau.0', link: 'Fehlt'}, {key: 'Überbau.1', link: 'Ordner/Ziel|Titel'},
   ]}), resolve: link => link === 'Target' ? 'Ziel.md' : undefined,
  });
  expect(ordered.map(e => e.target)).toEqual(['Kontext/Fehlt.md', 'Ordner/Ziel.md', 'Alt.md', 'Ziel.md']);
  expect(edges.map(e => e.target)).toEqual(targets);
 });
 it('retains the same order through ancestor expansion and appends inverse-only relationships', () => {
  const g = graph();
  g.edges = [edge('Isoliert.md', 'Quelle.md', {field: 'Unterbau'}), edge('Quelle.md', 'Ziel.md'), edge('Quelle.md', 'Alt.md'), edge('Ziel.md', 'Ordner/Ziel.md')];
  const s = defaults(); s.graphStructure = {up:'Überbau', down:'Unterbau', left:'Reibung', right:'Ähnlichkeit', depth:3};
  const model = new SynopsisGraph(g, s);
  expect(model.neighbors('Quelle.md', 'broader')).toEqual(['Ziel.md', 'Alt.md', 'Isoliert.md']);
  expect([...model.ancestorPaths('Quelle.md', 3)].map(p => p.notes.map(n => n.id))).toEqual([['Ordner/Ziel.md', 'Ziel.md'], ['Alt.md'], ['Isoliert.md']]);
 });
 it('keeps source-specific list order at every depth and never alphabetizes lateral relations', () => {
  const g = graph(); g.fields.push('Ähnlichkeit');
  g.edges = [edge('Quelle.md', 'Ziel.md', {field:'Ähnlichkeit'}), edge('Quelle.md', 'Alt.md', {field:'Ähnlichkeit'}), edge('Ziel.md', 'Ordner/Ziel.md', {field:'Ähnlichkeit'}), edge('Ziel.md', 'Isoliert.md', {field:'Ähnlichkeit'})];
  const model = new SynopsisGraph(g, defaults()), entries = model.entries('Quelle.md', 'similar', 2);
  expect(entries.map(e => e.note.id)).toEqual(['Ziel.md', 'Alt.md']);
  expect(entries[0]!.children.map(e => e.note.id)).toEqual(['Ordner/Ziel.md', 'Isoliert.md']);
 });
});
