import type {GraphSnapshot, Settings} from '../types';
import {inverseFieldRules} from './field-relations';
import {synopsisFields} from './synopsis';

export interface StoredRelation {source: string; target: string; field: string}

/** Build once per render; large graphs must not be scanned for each term or dragover. */
export class SynopsisAssignmentIndex {
 private records = new Map<string, StoredRelation[]>();
 constructor(graph: GraphSnapshot, settings: Settings) {
  const mapped = synopsisFields(graph, settings), inverse = inverseFieldRules(graph);
  for (const from of mapped.broader) for (const to of mapped.narrower) inverse.push({from, to});
  for (const from of mapped.narrower) for (const to of mapped.broader) inverse.push({from, to});
  const reversed = new Map<string, Set<string>>();
  for (const {from, to} of inverse) {if (!reversed.has(from)) reversed.set(from, new Set()); reversed.get(from)!.add(to);}
  const add = (source: string, target: string, field: string, origin: StoredRelation) => {
   const key = JSON.stringify([source, target, field]);
   const records = this.records.get(key) ?? []; records.push(origin); this.records.set(key, records);
  };
  for (const {source, target, field, explicit, layer} of graph.edges) {
   if (!explicit || layer !== 'breadcrumbs') continue;
   const origin = {source, target, field}; add(source, target, field, origin);
   for (const opposite of reversed.get(field) ?? []) add(target, source, opposite, origin);
  }
 }
 get(source: string, target: string, fields: string[]): StoredRelation[] {
  const records = fields.flatMap(field => this.records.get(JSON.stringify([source, target, field])) ?? []);
  return [...new Map(records.map(record => [JSON.stringify(record), record])).values()];
 }
}

/** Resolve a visible one-hop relationship back to every explicit record supporting it. */
export function synopsisAssignments(graph: GraphSnapshot, settings: Settings, source: string, target: string, fields: string[]): StoredRelation[] {
 return new SynopsisAssignmentIndex(graph, settings).get(source, target, fields);
}
