import {t as tr} from '../i18n';
import type {App} from 'obsidian';
import {MermaidColorModal} from '../mermaid/dialogs';
export type ArgdownColorTarget = 'element' | 'font';
/** Expose the native element color and documented type-wide font color without extra color fields. */
export class ArgdownColorModal extends MermaidColorModal {
 private target: {value: ArgdownColorTarget};
 constructor(app: App, private elementLabel: string, private fontLabel: string, apply: (target: ArgdownColorTarget,color?:string)=>void) {
  const target: {value: ArgdownColorTarget}={value:'element'};super(app,color=>apply(target.value,color),{title:elementLabel});this.target=target;
 }
 override onOpen(): void {
  super.onOpen();const row=this.contentEl.createEl('label',{cls:'em-ad-color-target'});row.createSpan({text:tr("argdown.edit_color")});const select=row.createEl('select',{attr:{'aria-label':tr("argdown.edit_color")}});select.createEl('option',{value:'element',text:this.elementLabel});select.createEl('option',{value:'font',text:this.fontLabel});const hint=row.createDiv({text:tr("argdown.element_colors_follow_the_native_argdown_rendering"),cls:'em-muted'});
  select.onchange=()=>{this.target.value=select.value==='font'?'font':'element';this.setTitle(this.target.value==='font'?this.fontLabel:this.elementLabel);hint.setText(this.target.value==='font'?tr("argdown.this_native_setting_applies_to_all_elements_of_this_type_in"):tr("argdown.element_colors_follow_the_native_argdown_rendering"));};this.contentEl.prepend(row);
 }
}
