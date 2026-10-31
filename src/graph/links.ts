import type {Edge} from '../types';

export interface LinkCache {
 links?: {link: string; position: {start: {line: number}}}[];
 frontmatterLinks?: {link: string; key: string}[];
}
export interface LinkIndex {
 resolvedLinks: Record<string, Record<string, number>>;
 unresolvedLinks: Record<string, Record<string, number>>;
 cache(path: string): LinkCache | null;
 resolve(link: string, source: string): string | undefined;
}
/** resolvedLinks supplies connectivity. Cache occurrences only refine proven provenance. */
export function readObsidianLinks(index: LinkIndex, knownPaths: Set<string>, bc: Edge[]) {
 const edges: Edge[] = [];
 const unresolved: {source: string; link: string; count: number; occurrences?: Edge['occurrences']}[] = [];
 const bcPairs = new Set(bc.filter(e => e.explicit && e.provenance === 'typed_link').map(e => JSON.stringify([e.source, e.target])));
 for (const [source, targets] of Object.entries(index.resolvedLinks)) {
  if (!knownPaths.has(source)) continue;
  const cache = index.cache(source);
  const occurrences = new Map<string, Edge['occurrences']>();
  for (const link of cache?.links ?? []) {
   const target = index.resolve(link.link, source);
   if (target) occurrences.set(target, [...occurrences.get(target) ?? [], {kind: 'body', line: link.position.start.line + 1}]);
  }
  for (const link of cache?.frontmatterLinks ?? []) {
   const target = index.resolve(link.link, source);
   if (target) occurrences.set(target, [...occurrences.get(target) ?? [], {kind: 'frontmatter', property: link.key}]);
  }
  for (const [target] of Object.entries(targets)) {
   if (!knownPaths.has(target)) continue;
   const proven = occurrences.get(target) ?? [];
   // A frontmatter-only typed link is already represented by Breadcrumbs.
   if (bcPairs.has(JSON.stringify([source, target])) && !proven.some(o => o.kind === 'body')) continue;
   edges.push({id: JSON.stringify(['obs', source, target]), source, target, layer: 'obsidian', field: '',
    explicit: true, provenance: proven.some(o => o.kind === 'body') ? 'body-link' : 'metadata-index',
    occurrences: proven.length ? proven : [{kind: 'aggregate'}]});
  }
 }
 for (const [source, links] of Object.entries(index.unresolvedLinks)) {
  if (!knownPaths.has(source)) continue;
  const cache=index.cache(source),path=(link:string)=>link.split('|')[0]!.split('#')[0]!;
  for (const [link,count] of Object.entries(links)) {
   const occurrences:Edge['occurrences']=[...(cache?.links??[]).filter(entry=>path(entry.link)===path(link)).map(entry=>({kind:'body' as const,line:entry.position.start.line+1})),
    ...(cache?.frontmatterLinks??[]).filter(entry=>path(entry.link)===path(link)).map(entry=>({kind:'frontmatter' as const,property:entry.key}))];
   unresolved.push({source,link,count,occurrences});
  }
 }
 return {edges, unresolved};
}
