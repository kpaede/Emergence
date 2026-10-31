import {describe, expect, it} from 'vitest';
import cytoscape from 'cytoscape';
import {readBreadcrumbs, type BCAPI} from '../src/graph/breadcrumbs';
import {readObsidianLinks, type LinkIndex} from '../src/graph/links';
import {ConceptRegistry, findPath} from '../src/graph/registry';
import {graphElements, defaultFilters, applyLayers, runLayout, visibleEdge, highlightActive} from '../src/graph/render';
import {boundedPaths} from '../src/graph/paths';
import {defaults} from '../src/config';
import {edge, graph} from './fixtures';
import {arrangeContext, graphContext} from '../src/graph/context';
import {cardLabel} from '../src/ui/graph-label';

describe('Breadcrumbs V4 adapter', () => {
 it('preserves direction, custom labels, groups, and explicit/implied provenance', () => {
  const api: BCAPI = {fields: [{label: 'Überbau'}], field_groups: [{label: 'Gruppe', fields: ['Überbau']}], plugin: {graph: {}}, refresh: async () => {},
   get_neighbours: path => path === 'Quelle.md' ? {get_edges: () => [true, false].map(explicit => ({edge_type: 'Überbau', source_path: () => path, target_path: () => 'Ziel.md', explicit: () => explicit, edge_source: () => explicit ? 'typed_link' : 'transitive'}))} : undefined};
  const data = readBreadcrumbs(api, ['Quelle.md', 'Ziel.md'], {});
  expect(data.edges.map(e => [e.source, e.target, e.explicit])).toEqual([['Quelle.md', 'Ziel.md', true], ['Quelle.md', 'Ziel.md', false]]);
  expect(data.groups[0]?.label).toBe('Gruppe'); expect(data.rules['Überbau']?.hierarchical).toBe(false);
 });
 it('degrades without Ollama or Breadcrumbs', () => {expect(readBreadcrumbs(undefined, ['Quelle.md'], {}).diagnostics[0]).toContain('fehlt');});
});
describe('core MetadataCache multiplex provenance', () => {
 const index = (body = false): LinkIndex => ({resolvedLinks: {'Quelle.md': {'Ziel.md': 1}}, unresolvedLinks: {'Quelle.md': {'Fehlt': 1}},
  cache: () => ({links: body ? [{link: 'Ziel', position: {start: {line: 5}}}] : [], frontmatterLinks: [{link: 'Ziel', key: 'Überbau.0'}]}), resolve: () => 'Ziel.md'});
 const known = new Set(['Quelle.md', 'Ziel.md']);
 it('reuses resolvedLinks without a body rescan', () => {expect(readObsidianLinks(index(), known, []).edges).toHaveLength(1);});
 it('does not invent nodes for unresolvedLinks', () => {const data = readObsidianLinks(index(), known, []); expect(data.unresolved).toHaveLength(1); expect(data.edges.some(e => e.target === 'Fehlt')).toBe(false);});
 it('does not double count a typed frontmatter-only edge', () => {expect(readObsidianLinks(index(), known, [edge('Quelle.md', 'Ziel.md')]).edges).toHaveLength(0);});
 it('retains separately evidenced body occurrence of the same pair', () => {
  const e = readObsidianLinks(index(true), known, [edge('Quelle.md', 'Ziel.md')]).edges[0]!;
  expect(e.provenance).toBe('body-link'); expect(e.occurrences).toContainEqual({kind: 'body', line: 6});
 });
 it('does not claim body provenance from aggregates', () => {const idx = index(); idx.cache = () => null; expect(readObsidianLinks(idx, known, []).edges[0]?.occurrences).toEqual([{kind: 'aggregate'}]);});
 it('keeps layers independent and combines an identical pair into one displayed edge', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), ...readObsidianLinks(index(true), known, []).edges];
  expect(graphElements(g, 'Quelle.md', defaults()).elements.filter(e => e.group === 'edges')).toHaveLength(1);
  const f = defaultFilters(); f.links = false; expect(g.edges.filter(e => visibleEdge(e, g, f))).toHaveLength(1);
  f.hierarchy = false; f.links = true; expect(g.edges.filter(e => visibleEdge(e, g, f))[0]?.layer).toBe('obsidian');
 });
});
describe('registry and layouts', () => {
 it('shows unique direct neighbors instead of expanding inverse loops or unrelated hubs', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Ziel.md', 'Quelle.md', {id: 'inverse', explicit: false}), edge('Ziel.md', 'Alt.md')];
  const raw = JSON.stringify(g), context = graphContext(g, 'Quelle.md', defaults(), defaultFilters());
  expect(context.shown).toEqual(['Ziel.md']); expect(context.graph.nodes.map(n => n.id).sort()).toEqual(['Quelle.md', 'Ziel.md']);
  expect(context.graph.edges).toHaveLength(1); expect(JSON.stringify(g)).toBe(raw);
 });
 it('paginates all direct parents without duplicates and removes filtered orphan nodes', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Alt.md', 'Quelle.md')];
  const first = graphContext(g, 'Quelle.md', defaults(), defaultFilters(), 0, 1), second = graphContext(g, 'Quelle.md', defaults(), defaultFilters(), 1, 1);
  expect(new Set([...first.shown, ...second.shown]).size).toBe(2); expect(first.total).toBe(2);
  const filters = defaultFilters(); filters.hierarchy = false;
  expect(graphContext(g, 'Quelle.md', defaults(), filters).graph.nodes.map(n => n.id)).toEqual(['Quelle.md']);
 });
 it('places sidebar context cards without overlaps and keeps the focus first', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Alt.md', 'Quelle.md')];
  const context = graphContext(g, 'Quelle.md', defaults(), defaultFilters());
  const cy = cytoscape({headless: true, styleEnabled: true, elements: context.elements, style: [{selector: 'node', style: {width: 220, height: 72}}]});
  arrangeContext(cy, 'Quelle.md', context.shown);
  const boxes = cy.nodes().map(n => n.boundingBox());
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxes[i]!.y2).toBeLessThan(boxes[j]!.y1);
  cy.destroy();
 });
 it('bounds long titles and field combinations by available pixels, retaining Unicode characters', () => {
  const measure = (text: string) => Array.from(text).length * 15;
  const label = cardLabel('→ Überbau · Unterbau · Ähnlichkeit', '😀 Ein außergewöhnlich langer Titel ohne einen lesbaren Rand'.repeat(10), measure);
  const lines = label.split('\n'); expect(lines.length).toBeLessThanOrEqual(3);
  expect(lines.every(line => measure(line) <= 188)).toBe(true); expect(label).toContain('…'); expect(label).toContain('😀');
 });
 it('shows an isolated newly active note outside the display cap without moving the camera', () => {
  const g = graph(), s = defaults(); s.maxGraphNodes = 1;
  const cy = cytoscape({headless: true, elements: graphElements(g, 'Quelle.md', s).elements});
  cy.pan({x: 50, y: 70}); const pan = cy.pan(); highlightActive(cy, g, 'Isoliert.md');
  expect(cy.getElementById('Isoliert.md').hasClass('active-note')).toBe(true); expect(cy.pan()).toEqual(pan); cy.destroy();
 });
 it('bundles inverse and symmetric implied edges without repeating the same visible pair', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Ziel.md', 'Quelle.md', {id: 'inverse', field: 'Unterbau', explicit: false})];
  const data = graphElements(g, 'Quelle.md', defaults());
  expect(data.elements.filter(e => e.group === 'edges')).toHaveLength(1); expect(g.edges).toHaveLength(2);
 });
 it('stops inverse inference loops at a branch-local return marker', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Ziel.md', 'Quelle.md', {explicit: false})];
  const paths = boundedPaths(g, 'Quelle.md', 'Überbau', true);
  expect(paths).toEqual([{nodes: ['Quelle.md', 'Ziel.md', 'Quelle.md'], stopped: 'cycle'}]);
 });
 it('retains both legitimate multi-parent paths with branch-local cycle protection', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Alt.md'), edge('Quelle.md', 'Ziel.md'), edge('Alt.md', 'Isoliert.md'), edge('Ziel.md', 'Isoliert.md')];
  expect(boundedPaths(g, 'Quelle.md', 'Überbau').map(p => p.nodes)).toEqual([['Quelle.md', 'Alt.md', 'Isoliert.md'], ['Quelle.md', 'Ziel.md', 'Isoliert.md']]);
 });
 it('caps dense inference paths at visible depth and count budgets', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Alt.md'), edge('Alt.md', 'Ziel.md')];
  expect(boundedPaths(g, 'Quelle.md', 'Überbau', true, 1)[0]?.stopped).toBe('depth');
 });
 it('globally retrieves isolated concepts and DE/EN aliases without merging IDs', () => {
  const registry = new ConceptRegistry(graph());
  expect(registry.search('Isoliert')[0]?.concept.id).toBe('Isoliert.md');
  expect(registry.duplicates('Target')).toContain('Ziel.md'); expect(registry.concepts.filter(c => c.title === 'Ziel')).toHaveLength(2);
 });
 it('returns explicit evidence paths', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Alt.md'), edge('Alt.md', 'Ziel.md')];
  expect(findPath(g, 'Quelle.md', 'Ziel.md', 'Überbau')).toEqual(['Quelle.md', 'Alt.md', 'Ziel.md']);
 });
 it('bounds display without dropping raw relations and keeps the active isolated note', () => {
  const g = graph(), s = defaults(); s.maxGraphNodes = 1;
  expect(graphElements(g, 'Isoliert.md', s).elements[0]?.data.id).toBe('Isoliert.md'); expect(g.nodes).toHaveLength(5);
 });
 it('does not rearrange nodes on layer changes or active-note styling', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md')];
  const cy = cytoscape({headless: true, styleEnabled: true, elements: graphElements(g, '', defaults()).elements, layout: {name: 'grid'}});
  const positions = cy.nodes().map(n => n.position()); const f = defaultFilters(); f.hierarchy = false;
  applyLayers(cy, g, f); cy.getElementById('Isoliert.md').addClass('active-note');
  expect(cy.nodes().map(n => n.position())).toEqual(positions); cy.destroy();
 });
 it('does not apply an asynchronous hierarchy layout after its view was replaced', async () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md')];
  const cy = cytoscape({headless: true, styleEnabled: true, elements: graphElements(g, 'Quelle.md', defaults()).elements});
  cy.nodes().positions(() => ({x: 42, y: 84}));
  const positions = cy.nodes().map(n => n.position());
  await runLayout(cy, g, 'elk', false, () => false);
  expect(cy.nodes().map(n => n.position())).toEqual(positions); cy.destroy();
 });
 it('ELK preserves multiple parents and hierarchy ranks despite many ordinary links', async () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Quelle.md', 'Alt.md')];
  const make = () => cytoscape({headless: true, styleEnabled: true, elements: graphElements(g, '', defaults()).elements});
  const cy = make(); await runLayout(cy, g, 'elk', false);
  const positions = cy.nodes().map(n => ({id: n.id(), p: n.position()}));
  g.edges.push(edge('Ziel.md', 'Quelle.md', {id: 'ordinary', layer: 'obsidian', field: ''}));
  const cy2 = make(); await runLayout(cy2, g, 'elk', false);
  expect(cy2.nodes().map(n => ({id: n.id(), p: n.position()}))).toEqual(positions);
  expect(cy2.getElementById('Ziel.md').position('y')).toBeGreaterThan(cy2.getElementById('Quelle.md').position('y'));
  expect(cy2.getElementById('Alt.md').position('y')).toBeGreaterThan(cy2.getElementById('Quelle.md').position('y'));
  cy.destroy(); cy2.destroy();
 }, 15000);
 it('fCoSE and ELK show the same node count and preserve raw data', async () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md')]; const raw = JSON.stringify(g);
  const cy = cytoscape({headless: true, styleEnabled: true, elements: graphElements(g, '', defaults()).elements});
  await runLayout(cy, g, 'fcose', false); expect(cy.nodes().length).toBe(g.nodes.length);
  await runLayout(cy, g, 'elk', false); expect(cy.nodes().length).toBe(g.nodes.length); expect(JSON.stringify(g)).toBe(raw); cy.destroy();
 }, 15000);
});
