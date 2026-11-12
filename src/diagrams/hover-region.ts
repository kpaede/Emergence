import type {DiagramRect} from './controls';
export interface DiagramPoint {x: number; y: number}
const padded = (r: DiagramRect, gap: number): DiagramRect => ({left: r.left - gap, right: r.right + gap, top: r.top - gap, bottom: r.bottom + gap});
const inside = (p: DiagramPoint, r: DiagramRect): boolean => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
function polygonContains(p: DiagramPoint, vertices: DiagramPoint[]): boolean {
 let sign = 0;
 for (let i = 0; i < vertices.length; i++) {
  const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!, cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) < 0.001) continue;
  if (sign && Math.sign(cross) !== sign) return false;
  sign = Math.sign(cross);
 }
 return true;
}
function hull(rectangles: DiagramRect[]): DiagramPoint[] {
 const points = rectangles.flatMap(r => [{x: r.left, y: r.top}, {x: r.right, y: r.top}, {x: r.right, y: r.bottom}, {x: r.left, y: r.bottom}]).sort((a, b) => a.x - b.x || a.y - b.y);
 const turn = (a: DiagramPoint, b: DiagramPoint, c: DiagramPoint): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
 const chain = (vertices: DiagramPoint[]): DiagramPoint[] => {const result: DiagramPoint[] = []; for (const point of vertices) {while (result.length > 1 && turn(result[result.length - 2]!, result[result.length - 1]!, point) <= 0) result.pop(); result.push(point);} return result;};
 const lower = chain(points), upper = chain([...points].reverse()); return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
/** Keep the full geometric path to the controls available, including diagonal travel and pauses. */
export function inHoverRegion(point: DiagramPoint, sources: DiagramRect[], controls: DiagramRect[], gap = 6): boolean {
 const origins = sources.map(r => padded(r, gap)), targets = controls.map(r => padded(r, gap));
 if ([...origins, ...targets].some(r => inside(point, r))) return true;
 return origins.some(source => targets.some(target => polygonContains(point, hull([source, target]))));
}
