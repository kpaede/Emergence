import {JSDOM} from 'jsdom';
/** The renderer creates elements through its owner window, as Obsidian does. */
export function tetradDom(html:string):JSDOM{
 const dom=new JSDOM(html),document=dom.window.document;
 Object.defineProperty(document,'win',{value:dom.window});
 Object.assign(dom.window,{createEl:(tag:string)=>document.createElement(tag),createSvg:(tag:string)=>document.createElementNS('http://www.w3.org/2000/svg',tag)});
 return dom;
}
