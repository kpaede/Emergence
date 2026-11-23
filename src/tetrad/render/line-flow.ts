import {solveFlowHeight} from './flow-metrics';
import {createElement} from './dom';

/** Native CSS Shapes lay text around two complementary triangles. Markdown
 * nodes, links and their handlers stay intact; no visual breaks enter the file. */
interface Flow {root:HTMLElement;left:HTMLElement;right:HTMLElement}
const refreshers=new WeakMap<HTMLElement,()=>void>();
const measurers=new WeakMap<HTMLElement,()=>void>();

export function refreshTetradFlow(host:HTMLElement):void{
 const grid=host.matches('.tetrader-grid')?host:host.closest<HTMLElement>('.tetrader-grid')??host.querySelector<HTMLElement>('.tetrader-grid');
 if(grid)refreshers.get(grid)?.();
}
export function measureTetradFlow(host:HTMLElement):void{const grid=host.closest<HTMLElement>('.tetrader-grid');if(grid)measurers.get(grid)?.();}
export function mountLineFlow(grid:HTMLElement):{destroy():void}{
 const win=grid.ownerDocument.defaultView;
 if(!win?.CSS?.supports('shape-outside','polygon(0 0, 100% 0, 0 100%)'))return {destroy(){}};
 const flows:Flow[]=[];
 for(const root of grid.querySelectorAll<HTMLElement>('.tetrader-glosses')){
  const left=createElement(root.ownerDocument,'span','tetrader-flow-edge tetrader-flow-left'),right=createElement(root.ownerDocument,'span','tetrader-flow-edge tetrader-flow-right');
  for(const edge of [left,right])edge.setAttribute('aria-hidden','true');
  root.prepend(left,right);root.classList.add('tetrader-line-flow');flows.push({root,left,right});
 }
 let alive=true,frame:number|undefined,lastWidth=-1,lastHeight=-1;
 const rows=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss')];
 const contentHeight=(elements:HTMLElement[]):number=>{
  const first=elements[0]?.getBoundingClientRect(),last=elements.at(-1)?.getBoundingClientRect();
  return first&&last?last.bottom-first.top:0;
 };
 const measure=():void=>{
  frame=undefined;if(!alive||grid.getBoundingClientRect().width===0)return;
  // Measure a rectangular text column at the same width as the shaped lines,
  // then let the browser perform its own shaping and line breaking. Bound the
  // refinement: narrow wrap thresholds must never cause an observer loop.
  for(const {root}of flows){
   if(root.classList.contains('has-active-edit'))continue;
   const elements=rows(root);if(!elements.length)continue;root.style.removeProperty('--tetrader-flow-content-height');
   root.classList.add('is-measuring');root.classList.remove('is-single-line');
   const height=contentHeight(elements);root.classList.remove('is-measuring');
   const lineHeight=Number.parseFloat(win.getComputedStyle(elements[0]!).lineHeight);
   const single=elements.length===1&&Number.isFinite(lineHeight)&&height<=lineHeight*1.2;
   root.classList.toggle('is-single-line',single);
   if(single){root.style.removeProperty('--tetrader-flow-height');continue;}
   const solved=solveFlowHeight(height,next=>{root.style.setProperty('--tetrader-flow-height',next+'px');return contentHeight(elements);});
   root.style.setProperty('--tetrader-flow-height',solved.height+'px');
   root.style.setProperty('--tetrader-flow-content-height',contentHeight(elements)+'px');
  }
  const box=grid.getBoundingClientRect();lastWidth=box.width;lastHeight=box.height;
 };
 const schedule=():void=>{if(alive&&frame===undefined)frame=win.requestAnimationFrame(measure);};
 const observer=new win.ResizeObserver(()=>{
  const box=grid.getBoundingClientRect();if(Math.abs(box.width-lastWidth)>.5||Math.abs(box.height-lastHeight)>.5)schedule();
 });
 observer.observe(grid);refreshers.set(grid,schedule);measurers.set(grid,measure);schedule();
 const fonts=grid.ownerDocument.fonts;fonts?.addEventListener('loadingdone',schedule);void fonts?.ready.then(()=>{if(alive)schedule();});
 return {destroy(){
  alive=false;observer.disconnect();if(frame!==undefined)win.cancelAnimationFrame(frame);fonts?.removeEventListener('loadingdone',schedule);refreshers.delete(grid);measurers.delete(grid);
  for(const {root,left,right}of flows){left.remove();right.remove();root.classList.remove('tetrader-line-flow','is-measuring','is-single-line');root.style.removeProperty('--tetrader-flow-height');root.style.removeProperty('--tetrader-flow-content-height');}
 }};
}
