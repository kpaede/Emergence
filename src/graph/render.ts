import cytoscape, {type Core, type ElementDefinition, type LayoutOptions} from 'cytoscape';
import elk from 'cytoscape-elk';
import fcose from 'cytoscape-fcose';
import type {Edge, GraphSnapshot, Settings} from '../types';
cytoscape.use(elk); cytoscape.use(fcose);

export interface Filters {hierarchy: boolean; cross: boolean; links: boolean; citations?: boolean; implied: boolean; field: string}
export const defaultFilters = (): Filters => ({hierarchy: true, cross: true, links: true, citations: true, implied: false, field: ''});
export function themeFont(container: HTMLElement): string {
 const stack = container.ownerDocument.defaultView?.getComputedStyle(container).fontFamily ?? '';
 // Ignore unavailable placeholder names; Cytoscape rejects some quoted CSS stacks.
 return stack.split(',').map(f => f.trim().replace(/^["']|["']$/gu, '')).filter(f => /^[\p{L}\p{N} _-]+$/u.test(f)).join(', ') || 'sans-serif';
}
/** Themes may use calc()/nested vars inside HSL. Let Chromium resolve them to actual colors before Cytoscape sees them. */
export function themeColor(container: HTMLElement, variable: string, fallback: string): string {
 const probe = container.createSpan(); probe.hidden = true; probe.style.color = `var(${variable}, ${fallback})`;
 const color = container.ownerDocument.defaultView?.getComputedStyle(probe).color ?? fallback; probe.remove();
 if (/^rgba?\(/u.test(color)) return color;
 const canvas = createEl('canvas'); canvas.width = canvas.height = 1;
 const context = canvas.getContext('2d', {willReadFrequently: true});
 if (!context) return fallback;
 context.fillStyle = color; context.fillRect(0, 0, 1, 1);
 const pixel = context.getImageData(0, 0, 1, 1).data;
 return `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]! / 255})`;
}
export function visibleEdge(e: Edge, graph: GraphSnapshot, f: Filters): boolean {
 if (e.layer === 'obsidian') return f.links;
 if (e.layer === 'zotlit') return f.citations !== false;
 if (f.field && e.field !== f.field) return false;
 if (!e.explicit && !f.implied) return false;
 return graph.rules[e.field]?.hierarchical ? f.hierarchy : f.cross;
}
export function graphElements(graph: GraphSnapshot, active: string, settings: Settings): {elements: ElementDefinition[]; limited: boolean} {
 const degree = new Map<string, number>();
 const primaryEdges = graph.edges.filter(e => e.layer === 'breadcrumbs' && e.explicit);
 for (const edge of primaryEdges) {degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1); degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);}
 const neighbors = new Set(primaryEdges.filter(e => e.source === active || e.target === active).flatMap(e => [e.source, e.target]));
 const sorted = [...graph.nodes].sort((a, b) => Number(b.id === active) - Number(a.id === active)
  || Number(neighbors.has(b.id)) - Number(neighbors.has(a.id)) || (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id));
 const selected = sorted.slice(0, settings.maxGraphNodes), ids = new Set(selected.map(n => n.id));
 const pairs = new Map<string, Edge[]>();
 // Explicit BC first; inferred edges get a bounded display, raw snapshot stays intact.
 const ordered = [...graph.edges].sort((a, b) => Number(b.layer === 'breadcrumbs' && b.explicit) - Number(a.layer === 'breadcrumbs' && a.explicit) || Number(b.explicit) - Number(a.explicit));
 let count = 0;
 for (const e of ordered) {
  if (!ids.has(e.source) || !ids.has(e.target)) continue;
  if (count++ >= settings.maxGraphEdges) break;
  const key = JSON.stringify([e.source, e.target].sort()); pairs.set(key, [...pairs.get(key) ?? [], e]);
 }
 const elements: ElementDefinition[] = selected.map(n => ({group: 'nodes', data: {id: n.id, label: n.exists || n.citation ? n.title : `${n.title} (noch nicht angelegt)`}, classes: `${n.id === active ? 'active-note' : ''} ${n.citation ? 'citation-node' : n.exists ? '' : 'unresolved-node'}`}));
 for (const [id, edges] of pairs) {const [source, target] = [edges[0]!.source, edges[0]!.target].sort();
  elements.push({group: 'edges', data: {id: 'pair:' + id, source, target, raw: edges, label: ''}});
 }
 return {elements, limited: selected.length < graph.nodes.length || count > settings.maxGraphEdges};
}
/** Always layout the same nodes with explicit hierarchical BC edges only. Overlays cannot change ranks. */
export function layoutElements(cy: Core, graph: GraphSnapshot) {
 return cy.nodes().union(cy.edges().filter(e => (e.data('raw') as Edge[]).some(r => r.layer === 'breadcrumbs' && r.explicit && graph.rules[r.field]?.hierarchical)));
}
export function applyLayers(cy: Core, graph: GraphSnapshot, filters: Filters): void {
 cy.batch(() => cy.edges().forEach(edge => {
  if (edge.hasClass('proposal')) return;
  const visible = (edge.data('raw') as Edge[]).filter(e => visibleEdge(e, graph, filters));
  edge.style('display', visible.length ? 'element' : 'none');
  edge.toggleClass('ordinary-link', visible.every(e => e.layer === 'obsidian'));
  edge.toggleClass('citation-edge', visible.some(e => e.layer === 'zotlit'));
  edge.toggleClass('implied-edge', visible.length > 0 && visible.every(e => !e.explicit));
  edge.toggleClass('mixed-edge', visible.some(e => e.layer === 'obsidian') && visible.some(e => e.layer === 'breadcrumbs'));
  edge.style('target-arrow-shape', visible.some(e => e.layer !== 'obsidian' && e.source === edge.source().id()) ? 'triangle' : 'none');
  edge.style('source-arrow-shape', visible.some(e => e.layer !== 'obsidian' && e.source === edge.target().id()) ? 'triangle' : 'none');
  edge.data('label', [...new Set(visible.map(e => e.field || 'Link'))].join(' · '));
 }));
}
export function highlightActive(cy: Core, graph: GraphSnapshot, path: string): void {
 if (path && cy.getElementById(path).empty()) {
  const n = graph.nodes.find(n => n.id === path);
  if (n) {const extent = cy.extent(); cy.add({group: 'nodes', data: {id: n.id, label: n.title}, position: {x: (extent.x1 + extent.x2) / 2, y: (extent.y1 + extent.y2) / 2}});}
 }
 cy.nodes().removeClass('active-note'); cy.getElementById(path).addClass('active-note');
}
export function createGraph(container: HTMLElement): Core {
 const variable = (key: string, fallback: string) => themeColor(container, key, fallback);
 const cy = cytoscape({container, wheelSensitivity: 0.2, minZoom: 0.08, maxZoom: 4,
  style: [
   {selector: 'node', style: {'background-color': variable('--interactive-accent', '#8876d4'), 'label': 'data(label)', 'font-size': 11,
    'color': variable('--text-normal', '#ddd'), 'width': 14, 'height': 14, 'text-valign': 'bottom', 'text-margin-y': 5, 'text-max-width': '150px', 'text-wrap': 'ellipsis'}},
   {selector: 'edge', style: {'width': 1.5, 'line-color': variable('--interactive-accent', '#8876d4'), 'source-arrow-color': variable('--interactive-accent', '#8876d4'), 'target-arrow-color': variable('--interactive-accent', '#8876d4'),
    'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': 8, 'color': variable('--text-muted', '#aaa'), 'text-rotation': 'autorotate'}},
   {selector: '.ordinary-link', style: {'line-color': variable('--text-faint', '#777'), 'line-style': 'dotted', 'target-arrow-shape': 'none', 'width': 1}},
   {selector: '.citation-edge', style: {'line-color': variable('--text-accent', '#8876d4'), 'line-style': 'dashed', 'width': 2}},
   {selector: '.citation-node', style: {'shape': 'diamond', 'border-width': 2, 'border-color': variable('--text-accent', '#8876d4')}},
   {selector: '.implied-edge', style: {'line-style': 'dashed', 'opacity': 0.4}},
   {selector: '.mixed-edge', style: {'width': 3}},
   {selector: '.active-note', style: {'border-width': 4, 'border-color': variable('--text-accent', '#e6ba77'), 'width': 24, 'height': 24}},
   {selector: '.proposal', style: {'line-style': 'dashed', 'line-color': variable('--text-accent', '#e6ba77'), 'target-arrow-color': variable('--text-accent', '#e6ba77'), 'width': 2, 'curve-style': 'unbundled-bezier', 'control-point-distances': 50, 'control-point-weights': 0.5}},
   {selector: '.unresolved-proposal', style: {'background-opacity': 0, 'border-width': 2, 'border-style': 'dashed', 'border-color': variable('--text-accent', '#e6ba77')}},
   {selector: '.unresolved-node', style: {'background-opacity': 0.15, 'border-width': 1.5, 'border-style': 'dashed', 'border-color': variable('--text-muted', '#aaa')}},
   {selector: ':selected', style: {'border-width': 3, 'border-color': variable('--text-normal', '#fff')}},
   {selector: '.em-compact-label', style: {label: ''}},
   {selector: '.em-compact-label.active-note, .em-compact-label:selected, .em-hover', style: {label: 'data(label)'}},
   {selector: '.context-node', style: {shape: 'round-rectangle', width: 220, height: 72,
    'background-color': variable('--background-secondary', '#222'), 'border-width': 1, 'border-color': variable('--interactive-accent', '#8876d4'),
    'font-family': themeFont(container),
    'font-size': 13, 'text-valign': 'center', 'text-halign': 'center', 'text-margin-y': 0, 'text-wrap': 'wrap', 'text-max-width': '196px', label: 'data(label)'}},
   {selector: '.context-focus', style: {'border-width': 3, 'font-weight': 'bold'}},
   {selector: '.context-node.active-note', style: {'border-width': 3, 'font-weight': 'bold'}},
   {selector: '.context-node.unresolved-node', style: {'border-style': 'dashed', 'background-opacity': 0.65}},
   {selector: 'edge', style: {'text-background-color': variable('--background-primary', '#222')}},
   {selector: 'edge.context-route', style: {'curve-style': 'taxi', 'taxi-direction': 'leftward', 'taxi-turn': 28, 'taxi-radius': 10,
    'source-endpoint': '-50% 0%', 'target-endpoint': '-50% 0%', label: ''}},
   {selector: 'edge:not(.context-route)', style: {label: ''}},

  ], layout: {name: 'preset'}, elements: [],
 });
 return cy;
}
export function runLayout(cy: Core, graph: GraphSnapshot, name: Settings['layout'], fit = true, isCurrent: () => boolean = () => true): Promise<void> {
 const options = name === 'elk' ? {name, elk: {algorithm: 'layered', 'elk.direction': 'DOWN', 'elk.spacing.nodeNode': 90, 'elk.layered.spacing.nodeNodeBetweenLayers': 110}, fit, animate: false, padding: 40, nodeDimensionsIncludeLabels: true}
  : name === 'fcose' ? {name, quality: 'default', randomize: true, animate: false, fit, numIter: 1000, packComponents: false,
   nodeDimensionsIncludeLabels: true, nodeSeparation: 90, idealEdgeLength: 160, nodeRepulsion: 15000}
   : {name, animate: false, fit, padding: 40, nodeDimensionsIncludeLabels: true, minNodeSpacing: 30, avoidOverlap: true};
 // Layout computation ignores display filters. Restore hidden styles after stopping.
 const ids = new Set(cy.nodes().map(n => n.id()));
 const layoutGraph = name === 'elk' ? cytoscape({headless: true, styleEnabled: true, elements: [
  ...cy.nodes().filter(n => !n.hasClass('unresolved-proposal')).sort((a, b) => a.id().localeCompare(b.id())).map(n => ({data: {id: n.id(), layoutWidth: n.width(), layoutHeight: n.height()}})),
  ...graph.edges.filter(e => e.layer === 'breadcrumbs' && e.explicit && graph.rules[e.field]?.hierarchical && ids.has(e.source) && ids.has(e.target)).map(e => ({data: {
   id: e.id, source: graph.rules[e.field]?.direction === 'reverse' ? e.target : e.source,
   target: graph.rules[e.field]?.direction === 'reverse' ? e.source : e.target,
  }})),
 ], style: [{selector: 'node', style: {width: 'data(layoutWidth)', height: 'data(layoutHeight)'}}]}) : undefined;
 const elements = layoutGraph?.elements() ?? cy.elements().filter(e => !e.hasClass('proposal') && !e.hasClass('unresolved-proposal'));
 const display = cy.edges().map(e => ({edge: e, value: String(e.style('display'))}));
 if (!layoutGraph) cy.edges().style('display', 'element');
 return new Promise((resolve, reject) => {
  let timer: number | undefined;
  const finish = () => {window.clearTimeout(timer); layoutGraph?.destroy();};
  try {
   const layout = elements.layout({...options, fit: layoutGraph ? false : fit} as LayoutOptions);
   timer = window.setTimeout(() => {layout.stop(); finish(); reject(new Error('Layout-Zeitlimit erreicht; globale Suche und Datenansicht bleiben verfügbar.'));}, 25000);
   layout.one('layoutstop', () => {
    if (!cy.destroyed() && isCurrent()) {
     if (layoutGraph) for (const n of layoutGraph.nodes()) cy.getElementById(n.id()).position(n.position());
     for (const item of display) item.edge.style('display', item.value);
     if (fit) cy.fit(undefined, 40);
    }
    finish(); resolve();
   });
   layout.run();
  } catch (error) {finish(); reject(error instanceof Error ? error : new Error(String(error)));}
 });
}
