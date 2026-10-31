import {afterEach, describe, expect, it, vi} from 'vitest';
import type {App} from 'obsidian';
import {GraphService} from '../src/graph/service';
import {defaults} from '../src/config';
import {readBreadcrumbs, type BCAPI} from '../src/graph/breadcrumbs';

afterEach(() => vi.unstubAllGlobals());
const appFixture = (frontmatter: Record<string, unknown> = {}) => {
 const file = {path: 'Quelle.md', basename: 'Quelle', extension: 'md', stat: {mtime: 1, size: 1}};
 const resolvedLinks: Record<string, Record<string, number>> = {};
 const app = {vault: {getFiles: () => [file], getFileByPath: () => file}, metadataCache: {
  getFileCache: () => ({links: [], frontmatterLinks: [], frontmatter}), resolvedLinks,
  unresolvedLinks: {}, getFirstLinkpathDest: () => undefined,
 }} as unknown as App;
 return {app, resolvedLinks};
};
describe('snapshot stability and loop protection', () => {
 it('records Frontmatter key presence even when its value is empty', () => {
  const service = new GraphService(appFixture({Überbau: null, Konzept: []}).app, defaults);
  expect(service.rebuild().nodes[0]?.properties).toEqual(['Überbau', 'Konzept']);
 });
 it('marks incomplete core-link coverage partial and later full', () => {
  const {app, resolvedLinks} = appFixture(), service = new GraphService(app, defaults);
  expect(service.rebuild().partial).toBe(true); resolvedLinks['Quelle.md'] = {};
  expect(service.rebuild().partial).toBe(false);
 });
 it('does not reconstruct or advance the snapshot when nothing changed', () => {
  const {app} = appFixture(), service = new GraphService(app, defaults);
  const first = service.rebuild(); expect(service.rebuild()).toBe(first); expect(service.snapshot.version).toBe(1);
 });
 it('coalesces concurrent public Breadcrumbs refresh requests', async () => {
  let release!: () => void;
  const refresh = vi.fn(() => new Promise<void>(resolve => {release = resolve;}));
  vi.stubGlobal('window', {BCAPI: {fields: [], field_groups: [], plugin: {graph: {}}, refresh, get_neighbours: () => undefined}});
  const service = new GraphService(appFixture().app, defaults), a = service.refreshBreadcrumbs(), b = service.refreshBreadcrumbs();
  expect(refresh).toHaveBeenCalledTimes(1); release(); await Promise.all([a, b]);
 });
 it('indexes unresolved inverse loops only once per node without inventing files', () => {
  const visits: string[] = [];
  const api: BCAPI = {fields: [{label: 'custom'}], field_groups: [], plugin: {graph: {}}, refresh: async () => {},
   get_neighbours: path => {visits.push(path); return {get_edges: () => [{edge_type: 'custom', source_path: () => path, target_path: () => path === 'Quelle.md' ? 'Fehlt.md' : 'Quelle.md', explicit: () => path === 'Quelle.md', edge_source: () => 'test'}]};},
  };
  const data = readBreadcrumbs(api, ['Quelle.md'], {});
  expect(visits).toEqual(['Quelle.md', 'Fehlt.md']); expect(data.edges).toHaveLength(2); expect(data.unresolvedPaths).toEqual(['Fehlt.md']);
 });
});
