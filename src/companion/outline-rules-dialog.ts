import {Modal,type App} from 'obsidian';
import {t} from '../i18n';
import type {OutlineRules} from './model';

export function outlineRuleFields(host:HTMLElement,rules:OutlineRules){
 host.addClass('em-companion-outline-settings');host.createEl('p',{text:t('companion.outlineRulesHelp')});
 const field=(name:string,help:string,value:string[],placeholder:string)=>{const label=host.createEl('label',{cls:'em-companion-outline-rule',text:name});label.createSpan({cls:'setting-item-description',text:help});const input=label.createEl('textarea',{attr:{rows:'3','aria-label':name,placeholder}});input.value=value.join('\n');return input;};
 const ignored=field(t('companion.ignoredHeadings'),t('companion.ignoredHeadingsHelp'),rules.ignore,t('companion.ignoredHeadingsExample')),markers=field(t('companion.positionMarkers'),t('companion.positionMarkersHelp'),rules.markers,t('companion.positionMarkersExample'));
 host.createEl('p',{cls:'setting-item-description',text:t('companion.outlineRuleMatchingHelp')});host.createEl('p',{cls:'setting-item-description',text:t('companion.outlineRuleExistingHelp')});
 return {inputs:[ignored,markers],read:():OutlineRules=>{const lines=(text:string)=>text.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);return {ignore:lines(ignored.value),markers:lines(markers.value)};}};
}
export class OutlineRulesModal extends Modal{
 private saving=false;
 constructor(app:App,private rules:OutlineRules,private save:(rules:OutlineRules)=>Promise<void>){super(app);}
 override close():void{if(!this.saving)super.close();}
 onOpen():void{
  this.setTitle(t('companion.outlineRules'));const fields=outlineRuleFields(this.contentEl,this.rules);
  const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),buttons=this.contentEl.createDiv({cls:'modal-button-container'}),cancel=buttons.createEl('button',{text:t('companion.cancel')}),submit=buttons.createEl('button',{text:t('companion.save'),cls:'mod-cta'});
  cancel.onclick=()=>this.close();submit.onclick=()=>{if(this.saving)return;this.saving=true;for(const control of [...fields.inputs,cancel,submit])control.disabled=true;void this.save(fields.read()).then(()=>{this.saving=false;this.close();},reason=>error.setText(reason instanceof Error?reason.message:String(reason))).finally(()=>{this.saving=false;for(const control of [...fields.inputs,cancel,submit])control.disabled=false;});};
  fields.inputs[0]!.focus();
 }
}
