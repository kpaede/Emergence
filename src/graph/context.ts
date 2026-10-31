import type {Core} from 'cytoscape';
import type {GraphSnapshot, Settings} from '../types';
import {graphElements, visibleEdge, type Filters} from './render';

/** One hop, unique neighbors, no inferred expansion or global hub sampling. */
export function graphContext(graph: GraphSnapshot, focus: string, settings: Settings, filters: Filters, page = 0, pageSize = 4, crossEdges = false) {
 const incident = graph.edges.filter(e => (e.source === focus || e.target === focus) && visibleEdge(e, graph, filters));
 const scores = new Map<string, number>();
 for (const e of incident) {
  const id = e.source === focus ? e.target : e.source; if (id === focus) continue;
  scores.set(id, Math.max(scores.get(id) ?? 0, e.layer === 'breadcrumbs' && e.explicit ? 3 : e.explicit ? 2 : 1));
 }
 const concepts = new Map(graph.nodes.map(n => [n.id, n]));
 const neighbors = [...scores.keys()].filter(id => concepts.has(id)).sort((a, b) => scores.get(b)! - scores.get(a)! || concepts.get(a)!.title.localeCompare(concepts.get(b)!.title) || a.localeCompare(b));
 const size = Math.max(1, Math.min(pageSize, settings.maxGraphNodes - 1 || 1));
 const pages = Math.max(1, Math.ceil(neighbors.length / size)), currentPage = Math.max(0, Math.min(page, pages - 1));
 const shown = settings.maxGraphNodes <= 1 ? [] : neighbors.slice(currentPage * size, (currentPage + 1) * size);
 const ids = new Set([focus, ...shown]);
 const local: GraphSnapshot = {...graph, nodes: graph.nodes.filter(n => ids.has(n.id)), edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)
  && visibleEdge(e, graph, filters) && (crossEdges || e.source === focus || e.target === focus))};
 const data = graphElements(local, focus, {...settings, maxGraphNodes: ids.size});
 for (const element of data.elements) if (element.group === 'edges' && (element.data.source === focus || element.data.target === focus)) {
  const neighbor: unknown = element.data.source === focus ? element.data.target : element.data.source;
  if (typeof neighbor === 'string') {element.data.target = neighbor; element.data.source = focus;}
 }
 for (const element of data.elements) if (element.group === 'nodes') {
  const id = element.data.id!;
  element.classes = `${String(element.classes ?? '')} context-node ${id === focus ? 'context-focus' : ''}`;
  element.data.title = concepts.get(id)?.title ?? id;
  element.data.relation = [...new Set(incident.filter(e => e.source === id || e.target === id).map(e => e.layer === 'obsidian' ? 'Link' : `${e.source === focus ? '→' : '←'} ${e.field}`))].join(' · ');
 }
 return {...data, neighbors, shown, page: currentPage, pages, total: neighbors.length, graph: local};
}

/** A narrow sidebar gets a vertical route: distinct cards and a left-hand edge rail. */
export function arrangeContext(cy: Core, focus: string, order: string[]): void {
 cy.batch(() => {
  cy.getElementById(focus).position({x: 145, y: 45});
  order.forEach((id, index) => cy.getElementById(id).position({x: 175, y: 155 + index * 106}));
 });
}
