import {idRanges} from './source';
import {isFlow, isMind, type DiagramModel, type SourceRange} from './types';
import {mindLines} from './mindmap';

export function elementKey(element: Element): string | undefined {
 const id = element.getAttribute('data-id'); if (id === null) return undefined;
 return (element.classList.contains('pele-cluster') ? 'g:' : element.classList.contains('pele-edge') || element.classList.contains('pele-edge-label') ? 'e:' : 'n:') + id;
}
export function selectionRanges(source: string, model: DiagramModel, keys: Iterable<string>): SourceRange[] {
 const selected = new Set(keys);
 if (isFlow(model)) {
  const ranges = idRanges(source, [...model.nodes.keys(), ...model.subgraphs.map(g => g.id)]), result: SourceRange[] = [];
  for (const key of selected) {
   if (key.startsWith('e:')) {const edge = model.edges.find(e => e.id === key.slice(2)); if (edge) result.push(...(ranges.get(edge.start) ?? []), ...(ranges.get(edge.end) ?? []));}
   else result.push(...(ranges.get(key.slice(2)) ?? []));
  }
  return result;
 }
 if (isMind(model)) {try {return mindLines(source, model).filter(l => selected.has('n:' + l.node.nodeId) || selected.has('m:' + l.node.nodeId));} catch {return [];}}
 return [];
}
export function keysAtPosition(source: string, model: DiagramModel, position: number): string[] {
 const lineStart = source.lastIndexOf('\n', Math.max(0, position - 1)) + 1, lineEnd = source.indexOf('\n', position), end = lineEnd < 0 ? source.length : lineEnd;
 if (isFlow(model)) {
  const map = idRanges(source, [...model.nodes.keys(), ...model.subgraphs.map(g => g.id)]);
  const exact = [...map].filter(([, ranges]) => ranges.some(r => r.from <= position && r.to >= position));
  const matches = exact.length ? exact : [...map].filter(([, ranges]) => ranges.some(r => r.from >= lineStart && r.from <= end));
  return matches.map(([id]) => (model.subgraphs.some(g => g.id === id) ? 'g:' : 'n:') + id);
 }
 if (isMind(model)) {try {const node = mindLines(source, model).find(l => position >= l.from && position <= l.to); return node ? ['n:' + node.node.nodeId] : [];} catch {return [];}}
 return [];
}
