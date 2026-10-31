import type {GraphSnapshot} from '../types';

export interface GraphPath {nodes: string[]; stopped: 'leaf' | 'cycle' | 'depth' | 'budget'}
/** Like Breadcrumbs' traversal: branch-local ancestors preserve multiple parents while stopping return loops. */
export function boundedPaths(graph: GraphSnapshot, start: string, field: string, includeImplied = false, maxDepth = 8, maxPaths = 40, maxVisits = 1000): GraphPath[] {
 const adjacency = new Map<string, Set<string>>();
 for (const edge of graph.edges) if (edge.layer === 'breadcrumbs' && edge.field === field && (edge.explicit || includeImplied)) {
  const targets = adjacency.get(edge.source) ?? new Set<string>(); targets.add(edge.target); adjacency.set(edge.source, targets);
 }
 const results: GraphPath[] = [], stack = [[start]]; let visits = 0;
 while (stack.length && results.length < maxPaths && visits++ < maxVisits) {
  const nodes = stack.pop()!, last = nodes.at(-1)!;
  if (nodes.slice(0, -1).includes(last)) {results.push({nodes, stopped: 'cycle'}); continue;}
  if (nodes.length - 1 >= maxDepth) {results.push({nodes, stopped: 'depth'}); continue;}
  const targets = adjacency.get(last);
  if (!targets?.size) {results.push({nodes, stopped: 'leaf'}); continue;}
  for (const target of [...targets].sort().reverse()) {
   if (stack.length + results.length >= maxVisits) break;
   stack.push([...nodes, target]);
  }
 }
 if (stack.length) results.push({nodes: [start], stopped: 'budget'});
 return results;
}

export interface ConnectionPath {nodes: string[]; steps: {field: string; reverse: boolean}[][]}
/** Breadth-first predecessor DAG: shortest paths, no cycle expansion, bounded work/results. */
export function connectionPaths(graph: GraphSnapshot, start: string, target: string, maxDepth = 6, maxVisits = 4000, maxPaths = 5) {
 const adjacency = new Map<string, Map<string, {field: string; reverse: boolean}[]>>();
 for (const e of graph.edges) if (e.layer === 'breadcrumbs' && e.explicit && e.source !== e.target) for (const reverse of [false, true]) {
  const a = reverse ? e.target : e.source, b = reverse ? e.source : e.target;
  if (!adjacency.has(a)) adjacency.set(a, new Map());
  const roles = adjacency.get(a)!.get(b) ?? [];
  if (!roles.some(r => r.field === e.field && r.reverse === reverse)) roles.push({field: e.field, reverse});
  adjacency.get(a)!.set(b, roles);
 }
 const distance = new Map([[start, 0]]), previous = new Map<string, string[]>(), queue = [start];
 let limited = false, depthLimited = false;
 for (let index = 0; index < queue.length; index++) {
  const id = queue[index]!, depth = distance.get(id)!;
  if (distance.has(target) && depth >= distance.get(target)!) break;
  if (depth >= maxDepth) {if ([...adjacency.get(id)?.keys() ?? []].some(n => !distance.has(n))) depthLimited = true; continue;}
  for (const neighbor of adjacency.get(id)?.keys() ?? []) {
   if (!distance.has(neighbor)) {
    if (distance.size >= maxVisits) {limited = true; continue;}
    distance.set(neighbor, depth + 1); previous.set(neighbor, [id]); queue.push(neighbor);
   } else if (distance.get(neighbor) === depth + 1) previous.get(neighbor)!.push(id);
  }
 }
 const paths: ConnectionPath[] = [], stack = distance.has(target) ? [[target]] : [];
 while (stack.length && paths.length < maxPaths) {
  const reverse = stack.pop()!, first = reverse.at(-1)!;
  if (first === start) {const nodes = [...reverse].reverse(); paths.push({nodes, steps: nodes.slice(1).map((id, i) => adjacency.get(nodes[i]!)!.get(id)!)});}
  else for (const id of previous.get(first) ?? []) {if (stack.length >= maxVisits) {limited = true; break;} stack.push([...reverse, id]);}
 }
 return {paths, limited, depthLimited, more: stack.length > 0};
}
