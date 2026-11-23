import {Component,MarkdownRenderer,type App} from 'obsidian';
import {t} from '../i18n';
import type {TetradBlock} from './source';

export interface TetradFingerprint {title:string;body:string}
const normalize=(text:string|null):string=>(text??'').replace(/\s+/gu,' ').trim();
function signature(element:HTMLElement):string{
 return JSON.stringify([normalize(element.textContent),Array.from(element.querySelectorAll('a,img,.internal-embed')).map(link=>[link.getAttribute('data-href')??link.getAttribute('href')??link.getAttribute('src'),normalize(link.textContent)])]);
}
export function tetradFingerprint(callout:HTMLElement):TetradFingerprint{
 return {title:normalize(callout.querySelector('.callout-title-inner')?.textContent??callout.querySelector('.callout-title')?.textContent??''),body:signature(callout.querySelector<HTMLElement>(':scope > .callout-content')??callout)};
}
/** Obsidian may provide no section range for callouts. Compare their rendered content
 * rather than guessing an index. */
export async function resolveNoteTarget(app:App,path:string,blocks:TetradBlock[],type:string,fingerprint:TetradFingerprint,trustedRange=false):Promise<TetradBlock>{
 const candidates=blocks.filter(block=>block.type===type.toLowerCase());if(trustedRange&&candidates.length===1)return candidates[0]!;
 const matches:TetradBlock[]=[];
 for(const block of candidates){
  const lifecycle=new Component();lifecycle.load();
  try{
   const rendered=createDiv({cls:'em-tetrad-source-probe'});await MarkdownRenderer.render(app,block.source,rendered,path,lifecycle);
   const callout=rendered.querySelector<HTMLElement>('.callout');if(!callout)continue;
   const candidate=tetradFingerprint(callout);if(candidate.title===fingerprint.title&&candidate.body===fingerprint.body)matches.push(block);
  }finally{lifecycle.unload();}
 }
 if(matches.length===1)return matches[0]!;throw new Error(t('tetrad.useCursor'));
}
