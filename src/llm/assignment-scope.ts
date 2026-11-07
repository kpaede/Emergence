import type {Concept, GraphSnapshot} from '../types';
import {normalize} from '../graph/registry';
import {parseFrontmatter} from '../review/frontmatter';
import {fieldAllowedForSource, frontmatterTags} from '../graph/field-scope';

export function inFolders(path: string, folders: string[]): boolean {
 return !folders.length || folders.some(folder => {
  const root = folder.replace(/^\/+|\/+$/gu, ''); return root === '' || path.startsWith(root + '/');
 });
}
export function sourceFields(content: string, graph: GraphSnapshot): string[] {
 const {data} = parseFrontmatter(content);
 return graph.fields.filter(field => Object.prototype.hasOwnProperty.call(data, field) && fieldAllowedForSource(field, frontmatterTags(data.tags), graph));
}
export function scopedTargets(source: string, graph: GraphSnapshot, folders: string[], properties: string[] = [], excludeExisting = false): Concept[] {
 const connected = new Set<string>();
 if (excludeExisting) for (const edge of graph.edges) if (edge.layer === 'breadcrumbs') {
  if (edge.source === source) connected.add(edge.target);
  if (edge.target === source) connected.add(edge.source);
 }
 return graph.nodes.filter(n => n.exists && n.id !== source && n.id.endsWith('.md') && inFolders(n.id, folders)
  && !connected.has(n.id) && (!properties.length || properties.some(property => n.properties?.includes(property))));
}
export function matchingTargets(label: string, targets: Concept[]): Concept[] {
 const name = normalize(label);
 return targets.filter(n => [n.title, ...n.aliases].some(alias => normalize(alias) === name));
}
