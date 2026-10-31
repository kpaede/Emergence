import type {Edge} from '../types';
import type {LinkIndex} from './links';

/** A transient ordering of existing edges; nothing is written to note metadata. */
export function frontmatterOrder(edges: Edge[], index: Pick<LinkIndex, 'cache' | 'resolve'>): Edge[] {
 const ranks = new Map<string, Map<string, number>>();
 const unresolved = new Map<string, {field: string; target: string; rank: number}[]>();
 const clean = (path: string) => path.split('|')[0]!.split('#')[0]!.replace(/\.md$/u, '');
 for (const source of new Set(edges.map(e => e.source))) {
  const fields = new Map<string, number>(); ranks.set(source, fields); unresolved.set(source, []);
  for (const [position, link] of (index.cache(source)?.frontmatterLinks ?? []).entries()) {
   const resolved = index.resolve(link.link, source), target = clean(resolved ?? link.link);
   // Obsidian exposes list positions as property.0, property.1, … .
   const match = /^(.*)\.(\d+)$/u.exec(link.key), field = match?.[1] ?? link.key;
   const key = JSON.stringify([field, target]);
   const rank = match ? Number(match[2]) : position;
   if (!fields.has(key)) fields.set(key, rank);
   if (!resolved) unresolved.get(source)!.push({field, target, rank});
  }
 }
 const rank = (edge: Edge) => ranks.get(edge.source)?.get(JSON.stringify([edge.field, clean(edge.target)]))
  ?? unresolved.get(edge.source)?.find(link => link.field === edge.field && clean(edge.target).endsWith('/' + link.target))?.rank
  ?? Number.MAX_SAFE_INTEGER;
 // Group sources/fields by first appearance, then retain the source's actual list order.
 const groups = new Map<string, number>();
 for (const edge of edges) {const key = JSON.stringify([edge.source, edge.field]); if (!groups.has(key)) groups.set(key, groups.size);}
 return [...edges].sort((a, b) => groups.get(JSON.stringify([a.source, a.field]))! - groups.get(JSON.stringify([b.source, b.field]))! || rank(a) - rank(b));
}
