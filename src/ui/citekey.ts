import {t as tr} from '../i18n';
import {Notice,setIcon} from 'obsidian';
import {formatCitekey, type CitekeyFormat} from '../graph/citekey';
export function citekeyButton(parent: HTMLElement, key: string, format: () => CitekeyFormat,iconOnly=false): HTMLButtonElement {
 const button = parent.createEl('button', {cls: iconOnly?'em-citekey clickable-icon':'em-citekey', attr: {type: 'button', 'aria-label': tr("messages.copyCitekey",{key}), title: tr("common.copy", {value1: formatCitekey(key, format())})}});
 if(!iconOnly)button.createSpan({text:'@'+key,cls:'em-citekey-label'});setIcon(button.createSpan({cls:'em-citekey-icon',attr:{'aria-hidden':'true'}}),'copy');
 const updateTitle=()=>{button.title=tr("common.copy", {value1: formatCitekey(key, format())});};button.onmouseenter=updateTitle;button.onfocus=updateTitle;
 button.onclick = event => {event.preventDefault(); event.stopPropagation(); void parent.ownerDocument.defaultView!.navigator.clipboard.writeText(formatCitekey(key, format())).then(() => {new Notice(tr("labels.citekey_copied"));}).catch(() => {new Notice(tr("common.the_citekey_could_not_be_copied"));});};
 return button;
}
