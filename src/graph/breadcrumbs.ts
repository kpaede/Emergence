import type {BreadcrumbsInference, Edge, RelationRule} from '../types';
import {unknownRule} from '../config';
import {errorMessage} from '../util';

export interface BCEdge {
 edge_type: string; source_path(graph: unknown): string; target_path(graph: unknown): string;
 explicit(graph: unknown): boolean; edge_source(graph: unknown): string | undefined;
 free?(): void;
}
export interface BCAPI {
 fields: {label: string}[]; field_groups: {label: string; fields: string[]}[];
 plugin: {graph: unknown; manifest?: {version: string}; settings?: {implied_relations?: {transitive?: unknown[]}}};
 get_neighbours(path: string): {get_edges(): BCEdge[]; free?(): void} | undefined;
 refresh(): Promise<void>;
}
export function detectBreadcrumbs(): BCAPI | undefined {
 const api = typeof window === 'undefined' ? undefined : (window as Window & {BCAPI?: BCAPI}).BCAPI;
 if (!api || !Array.isArray(api.fields) || !Array.isArray(api.field_groups)
  || typeof api.get_neighbours !== 'function' || typeof api.refresh !== 'function' || !api.plugin?.graph) return;
 return api;
}
export function readBreadcrumbs(api: BCAPI | undefined, paths: string[], overrides: Record<string, RelationRule>) {
 const edges: Edge[] = [], diagnostics: string[] = [];
 const fields = api?.fields.map(f => f.label).filter(f => typeof f === 'string') ?? [];
 const rules = Object.fromEntries(fields.map(label => [label, overrides[label] ?? unknownRule(label)]));
 if (!api) diagnostics.push('Breadcrumbs-API fehlt. Normale Obsidian-Links bleiben verfügbar.');
 const known = new Set(paths), seen = new Set<string>(), unresolvedPaths = new Set<string>();
 const queue = api ? [...paths] : [], visited = new Set(queue);
 for (let index = 0; index < queue.length; index++) {
  const path = queue[index]!;
  let list: ReturnType<BCAPI['get_neighbours']>;
  try {
   list = api!.get_neighbours(path);
   for (const raw of list?.get_edges() ?? []) {
    try {
     const source = raw.source_path(api!.plugin.graph), target = raw.target_path(api!.plugin.graph);
     const field = raw.edge_type, explicit = raw.explicit(api!.plugin.graph);
     const provenance = raw.edge_source(api!.plugin.graph) ?? 'implied';
     const id = JSON.stringify(['bc', source, target, field, explicit, provenance]);
     for (const node of [source, target]) {
      if (!known.has(node)) unresolvedPaths.add(node);
      if (!visited.has(node)) {visited.add(node); queue.push(node);}
     }
     if (!seen.has(id)) {
      seen.add(id); edges.push({id, source, target, field, explicit, provenance, layer: 'breadcrumbs', occurrences: []});
     }
    } finally { raw.free?.(); }
   }
  } catch (error) {
   if (diagnostics.length < 30) diagnostics.push(`Breadcrumbs ${path}: ${errorMessage(error)}`);
  } finally { list?.free?.(); }
 }
 if (unresolvedPaths.size) diagnostics.push(`${unresolvedPaths.size} Breadcrumbs-Ziele sind noch nicht angelegt; ihre typisierten Wiki-Link-Beziehungen bleiben sichtbar.`);
 return {edges, fields, rules, inferenceRules: readInferenceRules(api, fields), unresolvedPaths: [...unresolvedPaths], groups: api?.field_groups.map(g => ({label: g.label, fields: [...g.fields]})) ?? [], diagnostics};
}
/** Read the configured builder chains, never infer field meaning from neighboring notes. */
export function readInferenceRules(api: BCAPI | undefined, fields: string[]): BreadcrumbsInference[] {
 const result: BreadcrumbsInference[] = [];
 for (const raw of api?.plugin.settings?.implied_relations?.transitive ?? []) {
  if (!raw || typeof raw !== 'object') continue;
  const rule = raw as Record<string, unknown>;
  if (!Array.isArray(rule.chain) || typeof rule.close_field !== 'string' || !fields.includes(rule.close_field)
   || typeof rule.rounds !== 'number' || !Number.isInteger(rule.rounds) || rule.rounds < 1) continue;
  const chain = rule.chain.flatMap((part: unknown) => part && typeof part === 'object' && 'field' in part && typeof part.field === 'string' && fields.includes(part.field) ? [part.field] : []);
  if (!chain.length || chain.length !== rule.chain.length) continue;
  result.push({chain, field: rule.close_field, reversed: rule.close_reversed === true, rounds: rule.rounds});
 }
 return result;
}
