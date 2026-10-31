import type {Concept, GraphSnapshot} from '../types';

export const normalize = (text: string): string => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export class ConceptRegistry {
 readonly concepts: Concept[];
 constructor(snapshot: GraphSnapshot, folders: string[] = []) {
  this.concepts = snapshot.nodes.filter(n => n.id.endsWith('.md') && (!folders.length || folders.some(f => f === '/' || n.id.startsWith(f.replace(/\/$/u, '') + '/'))));
 }
 search(query: string, limit = 30): {concept: Concept; score: number; matched: string}[] {
  const q = normalize(query), words = new Set(q.split(' ').filter(w => w.length > 2));
  return this.concepts.map(concept => {
   let score = 0, matched = '';
   for (const label of [concept.title, ...concept.aliases, ...concept.tags]) {
    const n = normalize(label);
    const s = q === n ? 100 : q.includes(n) && n.length > 2 ? 60 : n.includes(q) && q.length > 1 ? 50 : n.split(' ').filter(w => words.has(w)).length * 10;
    if (s > score) {score = s; matched = label;}
   }
   return {concept, score, matched};
  }).filter(v => !q || v.score > 0).sort((a, b) => b.score - a.score || a.concept.id.localeCompare(b.concept.id)).slice(0, limit);
 }
 duplicates(label: string): string[] {
  // Cross-language matches are proven aliases, never an invented translation equivalence.
  return this.search(label, 10).filter(v => v.score >= 50).map(v => v.concept.id);
 }
}
export function findPath(snapshot: GraphSnapshot, source: string, target: string, field: string, maxVisited = 10000): string[] | undefined {
 const adjacency = new Map<string, string[]>();
 const add = (source: string, target: string) => adjacency.set(source, [...adjacency.get(source) ?? [], target]);
 const rule = snapshot.rules[field];
 for (const e of snapshot.edges) if (e.layer === 'breadcrumbs' && e.explicit) {
  if (e.field === field) {add(e.source, e.target); if (rule?.symmetric) add(e.target, e.source);}
  else if (rule?.inverse === e.field || (snapshot.rules[e.field]?.provenance === 'user' && snapshot.rules[e.field]?.inverse === field)) add(e.target, e.source);
 }
 const queue = [source], previous = new Map<string, string | null>([[source, null]]);
 for (let i = 0; i < queue.length && i < maxVisited; i++) {
  const node = queue[i]!;
  for (const next of adjacency.get(node) ?? []) {
   if (previous.has(next)) continue;
   previous.set(next, node);
   if (next === target) {
    const path = [target]; let cursor: string | null = node;
    while (cursor !== null) {path.unshift(cursor); cursor = previous.get(cursor) ?? null;}
    return path;
   }
   queue.push(next);
  }
 }
 return undefined;
}
