/** Obsidian uses aria-label as a visual tooltip too. Containers and controls
 * with an evident caption use a real label reference instead. */
const labels=new WeakMap<HTMLElement,HTMLSpanElement>();
export function nameWithoutTooltip(element:HTMLElement,text:string,host=element.parentElement??element):void{
 let label=labels.get(element);if(!label){label=host.createSpan({cls:'em-sr-only',attr:{id:'em-name-'+crypto.randomUUID()}});labels.set(element,label);}else if(label.parentElement!==host)host.append(label);
 label.textContent=text;element.removeAttribute('aria-label');element.setAttribute('aria-labelledby',label.id);
}
export function nameByVisibleElement(element:Element,label:Element):void{
 if(!label.id)label.id='em-name-'+crypto.randomUUID();element.removeAttribute('aria-label');element.setAttribute('aria-labelledby',label.id);
}
export function nameSvgWithoutTooltip(element:SVGElement,text:string):void{
 let label=element.querySelector<SVGDescElement>(':scope > desc[data-em-name]');
 if(!label){label=(element.ownerDocument.win as Window&{createSvg:typeof createSvg}).createSvg('desc');label.id='em-name-'+crypto.randomUUID();label.dataset.emName='true';element.prepend(label);}
 label.textContent=text;nameByVisibleElement(element,label);
}

/** A full caption is useful only when the displayed caption is actually clipped. */
export function tooltipForClippedText(element:HTMLElement,text:string):void{
 element.removeAttribute('title');element.onmouseenter=()=>{if(element.scrollWidth>element.clientWidth+1)element.title=text;else element.removeAttribute('title');};
}
