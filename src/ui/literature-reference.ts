import type {LiteratureReference} from '../types';
import type {CitekeyFormat} from '../graph/citekey';
import type {FormattedReference} from '../graph/zotlit-bibliography';
import {cslContent} from './csl-content';
import {errorMessage} from '../util';
import {citekeyButton} from './citekey';
/** The bibliographic entry opens the Library. The adjacent copy control never navigates. */
export function literatureReference(parent: HTMLElement, reference: LiteratureReference, actions: {open(): void; format(): CitekeyFormat; bibliography?(reference:LiteratureReference):Promise<FormattedReference>}): HTMLElement {
 const row=parent.createDiv({cls:'em-literature-reference'});
 if(reference.title||reference.indexedKey){
  const link=row.createEl('a',{cls:'internal-link em-literature-link',attr:{href:'#','aria-label':(reference.title??'Literaturangabe')+' in ZotLit öffnen',...(reference.indexedKey?{'data-zotlit-item':reference.indexedKey}:{})}});
  const text=link.createSpan({text:reference.title??'Literaturangabe',cls:'em-literature-title'}),status=row.createDiv({cls:'em-muted em-caption em-literature-status',text:'ZotLit formatiert …'});
  if(actions.bibliography)void actions.bibliography(reference).then(entry=>{if(!row.isConnected)return;text.empty();cslContent(text,entry);text.dataset.zotlitFormatted='true';status.remove();}).catch(error=>{if(row.isConnected){status.setText('ZotLit-Format nicht verfügbar.');status.title=errorMessage(error);}});else status.remove();
  link.onclick=event=>{event.preventDefault();event.stopPropagation();actions.open();};
  link.onauxclick=event=>{if(event.button===1){event.preventDefault();event.stopPropagation();}};
 }else row.createDiv({text:reference.state==='ambiguous'?'Literaturangabe nicht eindeutig aufgelöst':reference.state==='missing'?'Literaturangabe in ZotLit nicht aufgelöst':'Literaturdaten nicht verfügbar',cls:'em-muted em-caption'});
 if(reference.citekey)citekeyButton(row,reference.citekey,()=>actions.format());
 return row;
}
