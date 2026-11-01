import {getIcon} from 'obsidian';
import type {LiteratureReference} from '../types';
import type {CitekeyFormat} from '../graph/citekey';
import type {FormattedReference} from '../graph/zotlit-bibliography';
import type {LiteratureActions} from '../graph/zotlit-actions';
import {cslContent} from './csl-content';
import {errorMessage} from '../util';
import {citekeyButton} from './citekey';
import {iconButton} from './panel';
/** CSL text is selectable and inert. All navigation and copying have explicit, separate controls. */
export function literatureReference(parent:HTMLElement,reference:LiteratureReference,actions:{open:()=>void;format:()=>CitekeyFormat;bibliography?(reference:LiteratureReference):Promise<FormattedReference>;load?:()=>Promise<LiteratureActions>;run?:(action:()=>unknown)=>void}):HTMLElement{
 const row=parent.createDiv({cls:'em-literature-reference',attr:{tabindex:'0',role:'group','aria-label':'Literaturangabe'}}),text=row.createDiv({text:reference.title??(reference.state==='ambiguous'?'Literaturangabe nicht eindeutig aufgelöst':reference.state==='missing'?'Literaturangabe in ZotLit nicht aufgelöst':'Literaturdaten nicht verfügbar'),cls:'em-literature-title'});
 if(actions.bibliography&&(reference.title||reference.indexedKey)){const status=row.createDiv({cls:'em-muted em-caption em-literature-status',text:'ZotLit formatiert …'});void actions.bibliography(reference).then(entry=>{if(!row.isConnected)return;text.empty();cslContent(text,entry);text.dataset.zotlitFormatted='true';status.remove();}).catch(error=>{if(row.isConnected){status.setText('ZotLit-Format nicht verfügbar.');status.title=errorMessage(error);}});}
 const bar=row.createDiv({cls:'em-literature-actions',attr:{role:'group','aria-label':'Literaturaktionen'}}),run=(action:()=>unknown)=>{if(actions.run)actions.run(action);else void action();};
 const library=iconButton(bar,getIcon('zotlit-mark')?'zotlit-mark':'library','In ZotLit öffnen',actions.open);if(reference.indexedKey)library.dataset.zotlitItem=reference.indexedKey;library.dataset.literatureAction='library';library.disabled=!reference.indexedKey&&!reference.citekey;
 let ready:LiteratureActions={};
 const controls=([
  ['note','file-text','Literaturnotiz öffnen','Literaturnotiz nicht verfügbar'],['zotero','external-link','In Zotero öffnen','Zotero-Eintrag nicht verfügbar'],['attachment','paperclip','Anhang öffnen','Kein Anhang verfügbar'],['occurrence','chevron-right','Zur Fundstelle','Keine Fundstelle in dieser Notiz'],
 ] as const).map(([key,icon,label,missing])=>{const button=iconButton(bar,icon,label,()=>{});button.disabled=true;button.title=missing;button.onclick=event=>{event.preventDefault();event.stopPropagation();const action=ready[key];if(action)run(()=>action(event));};if(key==='note')button.onauxclick=event=>{if(event.button===1)button.onclick?.(event);};button.dataset.literatureAction=key;return {button,key,label,missing};});
 const copy=citekeyButton(bar,reference.citekey??'',actions.format,true);copy.disabled=!reference.citekey;copy.dataset.literatureAction='copy';
 if(actions.load)void actions.load().then(value=>{if(!row.isConnected)return;ready=value;for(const {button,key,label,missing}of controls){button.disabled=!value[key];button.title=value[key]?label:missing;}}).catch(error=>{if(row.isConnected)for(const {button}of controls)button.title=errorMessage(error);});
 return row;
}
