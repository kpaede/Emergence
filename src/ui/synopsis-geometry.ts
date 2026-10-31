const ns = 'http://www.w3.org/2000/svg';
export interface Segment {x1: number; y1: number; x2: number; y2: number}
export interface TextEndpoint {x: number; y: number; side: 'left' | 'right'; kind: string; note: string}
const snap = (value: number) => Math.round(value * 2) / 2;
/** Merge overlapping collinear segments, so common rails are painted once. */
export function mergeSegments(segments: Segment[]): Segment[] {
 const axes = new Map<string, {horizontal: boolean; fixed: number; ranges: [number, number][]}>();
 for (const s of segments) {
  const horizontal = Math.abs(s.y1 - s.y2) < 0.1;
  const fixed = snap(horizontal ? s.y1 : s.x1), a = snap(horizontal ? s.x1 : s.y1), b = snap(horizontal ? s.x2 : s.y2);
  if (a === b) continue;
  const key = `${horizontal ? 'h' : 'v'}:${fixed}`, axis = axes.get(key) ?? {horizontal, fixed, ranges: []};
  axis.ranges.push([Math.min(a,b), Math.max(a,b)]); axes.set(key, axis);
 }
 const merged: Segment[] = [];
 for (const axis of axes.values()) {
  const ranges = axis.ranges.sort((a,b) => a[0]-b[0]); let start = ranges[0]![0], end = ranges[0]![1];
  const emit = () => merged.push(axis.horizontal ? {x1: start, y1: axis.fixed, x2: end, y2: axis.fixed} : {x1: axis.fixed, y1: start, x2: axis.fixed, y2: end});
  for (const [a,b] of ranges.slice(1)) {if (a <= end) end = Math.max(end,b); else {emit(); start=a; end=b;}} emit();
 }
 return merged;
}
export class SynopsisGeometry {
 private observer: ResizeObserver; private frame?: number; private disposed = false;
 private win: Window; private fontListener = () => this.schedule();
 last = {segments: [] as Segment[], endpoints: [] as TextEndpoint[]};
 constructor(private diagram: HTMLElement, private svg: SVGSVGElement) {
  this.win = diagram.ownerDocument.defaultView ?? window;
  this.observer = new ResizeObserver(() => this.schedule()); this.observer.observe(diagram);
  diagram.ownerDocument.fonts?.addEventListener('loadingdone', this.fontListener);
  void diagram.ownerDocument.fonts?.ready.then(() => this.schedule());
 }
 schedule(): void {
  if (this.disposed || this.frame !== undefined) return;
  this.frame = this.win.requestAnimationFrame(() => {this.frame = undefined; this.draw();});
 }
 draw(): void {
  if (this.disposed || !this.diagram.clientWidth) return;
  const base = this.diagram.getBoundingClientRect(), focus = this.diagram.querySelector<HTMLElement>('.em-syn-focus'); if (!focus) return;
  const f = focus.getBoundingClientRect(), center = f.left + f.width / 2 - base.left;
  const segments: Segment[] = [], endpoints: TextEndpoint[] = [];
  const wire = (x1:number,y1:number,x2:number,y2:number) => segments.push({x1,y1,x2,y2});
  const point = (el: HTMLElement, side: 'left' | 'right', kind: string) => {
   const range = el.ownerDocument.createRange(); range.selectNodeContents(el);
   const fragments = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
   const r = (side === 'right' ? fragments.at(-1) : fragments[0]) ?? el.getBoundingClientRect();
   const x = (side === 'right' ? r.right + 2 : r.left - 2) - base.left, y = (r.top+r.bottom)/2-base.top;
   endpoints.push({x,y,side,kind,note:el.dataset.emNote ?? ''}); return {x,y,bottom:r.bottom-base.top};
  };
  const parentTerms = [...this.diagram.querySelectorAll<HTMLElement>('[data-syn-parent-terminal]')].map(el => point(el,'right','broader'));
  if (parentTerms.length) {
   const textRight=[...this.diagram.querySelectorAll<HTMLElement>('.em-syn-parents a,.em-syn-crumb,.em-syn-parent-path > .em-syn-meta')].flatMap(el=>{const range=el.ownerDocument.createRange();range.selectNodeContents(el);return [...range.getClientRects()].map(rect=>rect.right-base.left+8);});
   const rail=Math.max(center,...textRight);
   const join=this.diagram.querySelector<HTMLElement>('.em-syn-join')!.getBoundingClientRect(),joinY=join.top+join.height/2-base.top;
   wire(rail,Math.min(...parentTerms.map(p=>p.y)),rail,rail===center?f.top-base.top:joinY);
   if(rail!==center){wire(rail,joinY,center,joinY);wire(center,joinY,center,f.top-base.top);}
   for (const p of parentTerms) wire(p.x,p.y,rail,p.y);
  }
  for (const [relation, side] of [['similar','left'],['friction','right']] as const) {
   const terms = [...this.diagram.querySelectorAll<HTMLElement>(`[data-syn-list="${relation}"] > li > a`)].map(el=>point(el,side,relation)); if (!terms.length) continue;
   const rail = side==='left' ? 3 : this.diagram.clientWidth-3, fy=f.top+f.height/2-base.top;
   wire(side==='left'?f.left-base.left:f.right-base.left,fy,rail,fy); wire(rail,fy,rail,Math.max(...terms.map(p=>p.y)));
   for (const p of terms) wire(rail,p.y,p.x,p.y);
  }
  const children = [...this.diagram.querySelectorAll<HTMLElement>('[data-syn-list="narrower"] > li > a')].map((el,i)=>point(el,i%2===0?'right':'left','narrower'));
  if (children.length) {
   wire(center,f.bottom-base.top,center,Math.max(...children.map(p=>p.y)));
   for (const p of children) wire(center,p.y,p.x,p.y);
  }
  // Explicit predecessor IDs keep deep, visually flattened steps semantically connected.
  const stepGroups=new Map<string,HTMLElement[]>();
  for(const link of this.diagram.querySelectorAll<HTMLElement>('a[data-syn-parent]')){
   const parent=link.dataset.synParent!;stepGroups.set(parent,[...stepGroups.get(parent)??[],link]);
  }
  for(const [id,links] of stepGroups){
   const parent=this.diagram.ownerDocument.getElementById(id);if(!parent)continue;
   const side=links[0]!.dataset.synSide==='right'?'right':'left',relation=links[0]!.dataset.synRelation??'';
   const source=point(parent,side,relation+'-step-source'),children=links.map(link=>point(link,side,relation));
   // Wrapped labels can extend beyond their final fragment. Keep the rail outside every fragment.
   const bounds=[parent,...links].flatMap(el=>{const range=el.ownerDocument.createRange();range.selectNodeContents(el);return [...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);});
   const x=side==='left'?Math.min(...bounds.map(r=>r.left-base.left))-8:Math.max(...bounds.map(r=>r.right-base.left))+8;
   wire(source.x,source.y,x,source.y);wire(x,source.y,x,Math.max(...children.map(p=>p.y)));
   for(const child of children)wire(x,child.y,child.x,child.y);
  }
  const merged=mergeSegments(segments); this.last={segments:merged,endpoints};
  this.svg.replaceChildren(); this.svg.setAttribute('viewBox',`0 0 ${base.width} ${this.diagram.scrollHeight}`);
  this.svg.setAttribute('width',String(base.width)); this.svg.setAttribute('height',String(this.diagram.scrollHeight));
  for(const s of merged){const path=this.svg.ownerDocument.createElementNS(ns,'path');path.setAttribute('d',`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`);this.svg.append(path);}
 }
 destroy(): void {this.disposed=true;this.observer.disconnect();if(this.frame!==undefined)this.win.cancelAnimationFrame(this.frame);this.diagram.ownerDocument.fonts?.removeEventListener('loadingdone',this.fontListener);}
}
