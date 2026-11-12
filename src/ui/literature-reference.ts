import {t as tr} from '../i18n';
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
 const row=parent.createDiv({cls:'em-literature-reference',attr:{tabindex:'0',role:'group','aria-label':tr("graph.reference")}}),text=row.createDiv({text:reference.title??(reference.state==='ambiguous'?tr("graph.reference_not_uniquely_resolved"):reference.state==='missing'?tr("graph.reference_not_resolved_in_zotlit"):tr("graph.bibliography_data_unavailable")),cls:'em-literature-title'});
 if(actions.bibliography&&(reference.title||reference.indexedKey)){const status=row.createDiv({cls:'em-muted em-caption em-literature-status',text:tr("graph.zotlit_is_formatting")});void actions.bibliography(reference).then(entry=>{if(!row.isConnected)return;text.empty();cslContent(text,entry);text.dataset.zotlitFormatted='true';status.remove();}).catch(error=>{if(row.isConnected){status.setText(tr("graph.zotlit_formatting_unavailable"));status.title=errorMessage(error);}});}
 const bar=row.createDiv({cls:'em-literature-actions',attr:{role:'group','aria-label':tr("graph.reference_actions")}}),run=(action:()=>unknown)=>{if(actions.run)actions.run(action);else void action();};
 const library=iconButton(bar,getIcon('zotlit-mark')?'zotlit-mark':'library',tr("graph.open_in_zotlit"),actions.open);if(reference.indexedKey)library.dataset.zotlitItem=reference.indexedKey;library.dataset.literatureAction='library';library.disabled=!reference.indexedKey&&!reference.citekey;
 let ready:LiteratureActions={};
 const controls=([
  ['note','file-text',tr("graph.open_literature_note"),tr("graph.literature_note_unavailable")],['zotero','external-link',tr("graph.open_in_zotero"),tr("graph.zotero_entry_unavailable")],['attachment','paperclip',tr("graph.open_attachment"),tr("graph.no_attachment_available")],['occurrence','chevron-right',tr("labels.go_to_occurrence"),tr("graph.no_occurrence_in_this_note")],
 ] as const).map(([key,icon,label,missing])=>{const button=iconButton(bar,icon,label,()=>{});button.disabled=true;button.title=missing;button.onclick=event=>{event.preventDefault();event.stopPropagation();const action=ready[key];if(action)run(()=>action(event));};if(key==='note')button.onauxclick=event=>{if(event.button===1)button.onclick?.(event);};button.dataset.literatureAction=key;return {button,key,label,missing};});
 const copy=citekeyButton(bar,reference.citekey??'',actions.format,true);copy.disabled=!reference.citekey;copy.dataset.literatureAction='copy';
 if(actions.load)void actions.load().then(value=>{if(!row.isConnected)return;ready=value;for(const {button,key,label,missing}of controls){button.disabled=!value[key];button.title=value[key]?label:missing;}}).catch(error=>{if(row.isConnected)for(const {button}of controls)button.title=errorMessage(error);});
 return row;
}
