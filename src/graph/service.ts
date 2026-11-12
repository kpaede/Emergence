import {t as tr} from '../i18n';
import type {App} from 'obsidian';
import type {GraphSnapshot, Settings} from '../types';
import {detectBreadcrumbs, readBreadcrumbs} from './breadcrumbs';
import {readObsidianLinks} from './links';
import {parseFrontmatter} from '../review/frontmatter';
import {assert} from '../util';
import {ZotlitGraphAdapter} from './zotlit';
import {frontmatterOrder} from './frontmatter-order';

export const emptySnapshot = (): GraphSnapshot => ({version: 0, builtAt: 0, nodes: [], edges: [],
 fields: [], groups: [], rules: {}, partial: true, diagnostics: [], unresolved: [], breadcrumbsVersion: tr("graph.unavailable")});
export class GraphService {
 snapshot = emptySnapshot();
 resolved = false;
 private lastSignature = '';
 private refreshing?: Promise<void>;
 private zotlit: ZotlitGraphAdapter;
 constructor(private app: App, private settings: () => Settings, changed: () => void = () => {}) {
  this.zotlit = new ZotlitGraphAdapter(app, () => {this.rebuild(); changed();});
 }
 dispose(): void {this.zotlit.dispose();}
 rebuild(): GraphSnapshot {
  this.zotlit.ensure();
  const files = this.app.vault.getFiles();
  const markdown = files.filter(f => f.extension === 'md');
  const nodes = files.map(f => {
   const fm: Record<string, unknown> = this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
   const aliases = fm.aliases ?? fm.alias;
   const tags = fm.tags;
   return {id: f.path, title: f.basename, aliases: Array.isArray(aliases) ? aliases.filter((v): v is string => typeof v === 'string') : typeof aliases === 'string' ? [aliases] : [],
    tags: Array.isArray(tags) ? tags.filter((v): v is string => typeof v === 'string') : typeof tags === 'string' ? [tags] : [],
    type: typeof fm.type === 'string' ? fm.type : f.extension, exists: true, mtime: f.stat.mtime, size: f.stat.size, properties: Object.keys(fm)};
  });
  const api = detectBreadcrumbs();
  const bc = readBreadcrumbs(api, files.map(f => f.path), this.settings().rules);
  bc.edges = frontmatterOrder(bc.edges, {
   cache: path => {const file = this.app.vault.getFileByPath(path); return file ? this.app.metadataCache.getFileCache(file) : null;},
   resolve: (link, source) => this.app.metadataCache.getFirstLinkpathDest(link, source)?.path,
  });
  for (const field of bc.fields) {
   if (!Object.prototype.hasOwnProperty.call(this.settings().fieldDescriptions, field)) continue;
   const description = this.settings().fieldDescriptions[field]!.trim();
   bc.rules[field] = {...bc.rules[field]!, description, provenance: 'user', writable: !!description && (this.settings().rules[field]?.writable ?? true), targetProperty: field};
  }
  for (const path of bc.unresolvedPaths) nodes.push({id: path, title: path.split('/').at(-1)?.replace(/\.md$/u, '') ?? path,
   aliases: [], tags: [], type: 'md', exists: false, mtime: 0, size: 0, properties: []});
  const links = readObsidianLinks({
   resolvedLinks: this.app.metadataCache.resolvedLinks, unresolvedLinks: this.app.metadataCache.unresolvedLinks,
   cache: path => {const f = this.app.vault.getFileByPath(path); return f ? this.app.metadataCache.getFileCache(f) : null;},
   resolve: (link, source) => this.app.metadataCache.getFirstLinkpathDest(link, source)?.path,
  }, new Set(nodes.map(n => n.id)), bc.edges);
  const partial = markdown.some(f => !this.app.metadataCache.getFileCache(f)
   || !(Object.prototype.hasOwnProperty.call(this.app.metadataCache.resolvedLinks, f.path)
    || Object.prototype.hasOwnProperty.call(this.app.metadataCache.unresolvedLinks, f.path)));
  const next = {version: this.snapshot.version + 1, builtAt: Date.now(), nodes: [...nodes, ...this.zotlit.data.nodes], edges: [...bc.edges, ...links.edges, ...this.zotlit.data.edges], zotlit: this.zotlit.state,
   fields: bc.fields, groups: bc.groups, rules: bc.rules, inferenceRules: bc.inferenceRules, partial, unresolved: links.unresolved,
   diagnostics: [...bc.diagnostics, ...(partial ? [tr("graph.link_resolution_is_not_fully_confirmed_the_snapshot_is_marked_as")] : [])],
   breadcrumbsVersion: api?.plugin.manifest?.version ?? (api ? tr("labels.v4_api_detected") : tr("graph.unavailable"))};
  const signature = JSON.stringify({...next, version: 0, builtAt: 0});
  if (signature === this.lastSignature) return this.snapshot;
  this.lastSignature = signature; this.snapshot = next;
  return this.snapshot;
 }
 async refreshBreadcrumbs(path?: string): Promise<void> {
  if (path) {
   const f = this.app.vault.getFileByPath(path); assert(f, tr("labels.the_written_file_is_missing"));
   const expected = parseFrontmatter(await this.app.vault.read(f)).data;
   const deadline = Date.now() + 8000;
   for (;;) {
    const cached: Record<string, unknown> | undefined = this.app.metadataCache.getFileCache(f)?.frontmatter;
    if (Object.entries(expected).every(([key, value]) => JSON.stringify(cached?.[key]) === JSON.stringify(value))) break;
    assert(Date.now() < deadline, tr("graph.the_file_was_written_but_metadatacache_is_not_current_yet_refresh"));
    await new Promise(resolve => window.setTimeout(resolve, 40));
   }
  }
  if (this.refreshing) {await this.refreshing; if (!path) return;}
  const api = detectBreadcrumbs();
  if (path) assert(api, tr("graph.the_file_was_written_but_breadcrumbs_is_no_longer_available"));
  this.refreshing = (async () => {await api?.refresh(); this.rebuild();})();
  try {await this.refreshing;} finally {this.refreshing = undefined;}
 }
}
