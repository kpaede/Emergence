import type {LawId} from './render/laws';

type Direction='ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown';
const left=['enhances','retrieves'] as const,right=['reverses','obsolesces'] as const;
function parts(host:HTMLElement,law:LawId){
 const wing=host.querySelector<HTMLElement>('[data-em-law='+law+']'),core=wing?.querySelector<HTMLElement>('[data-em-core]')??undefined,visual=[...wing?.querySelectorAll<HTMLElement>('.tetrader-gloss')??[]].filter(row=>row.tabIndex>=0),upper=law==='enhances'||law==='reverses',center=core?[core]:[];
 return {core,visual,outward:upper?[...visual].reverse():visual,ordered:upper?[...visual,...center]:[...center,...visual]};
}
/** Arrow keys visit actual text entries, never the invisible quadrant boxes. */
export function nextTetradTarget(host:HTMLElement,current:HTMLElement,direction:Direction):HTMLElement|undefined{
 const law=current.closest<HTMLElement>('[data-em-law]')?.dataset.emLaw as LawId|undefined;if(!law)return undefined;
 const column=(left as readonly string[]).includes(law)?left:right;
 if(direction==='ArrowUp'||direction==='ArrowDown'){
  const items=column.flatMap(law=>parts(host,law).ordered),at=items.indexOf(current);
  return at<0?undefined:items[at+(direction==='ArrowUp'?-1:1)];
 }
 const destination=direction==='ArrowRight'&&column===left?right[left.indexOf(law as typeof left[number])]:direction==='ArrowLeft'&&column===right?left[right.indexOf(law as typeof right[number])]:undefined;
 if(!destination)return undefined;const own=parts(host,law),other=parts(host,destination);
 if(current===own.core)return other.core;
 const at=own.outward.indexOf(current);return at<0?undefined:other.outward[Math.min(at,other.outward.length-1)]??other.core;
}
