import {Modal,Setting,type App} from 'obsidian';
import {t} from '../i18n';
import {LAWS} from './render/laws';
import {DEFAULT_PATTERN,type TetradPattern,type TetradStore} from './patterns';
import type {CenterDisplay,LegendPosition} from './settings-model';

export class PatternModal extends Modal {
 constructor(app:App,private store:TetradStore,private done:(pattern:TetradPattern)=>void){super(app);this.setTitle(t('tetrad.newPattern'));}
 onOpen():void{
  const pattern=structuredClone(DEFAULT_PATTERN);pattern.id='';pattern.name='';
  this.contentEl.createEl('p',{text:t('tetrad.patternHelp'),cls:'em-muted'});
  new Setting(this.contentEl).setName(t('tetrad.patternName')).addText(input=>input.onChange(value=>{pattern.name=value;}));
  new Setting(this.contentEl).setName(t('tetrad.callout')).setDesc(t('tetrad.calloutHelp')).addText(input=>input.setPlaceholder('meine-tetrade').onChange(value=>{pattern.id=value.trim().toLowerCase();}));
  new Setting(this.contentEl).setName(t('tetrad.headingLevel')).addDropdown(select=>{for(let level=1;level<=6;level++)select.addOption(String(level),'#'.repeat(level));select.setValue('2').onChange(value=>{pattern.level=Number(value);});});
  for(const law of LAWS)new Setting(this.contentEl).setName(t(`tetrad.${law.id}`)).addText(input=>input.setValue(pattern.headings[law.id]).onChange(value=>{pattern.headings[law.id]=value.trim();}));
  const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'alert'}});
  new Setting(this.contentEl).addButton(button=>button.setButtonText(t('tetrad.savePattern')).setCta().onClick(()=>{
   button.setDisabled(true);void this.store.add(pattern).then(()=>{this.done(pattern);this.close();}).catch((reason:unknown)=>{error.setText(String(reason));button.setDisabled(false);});
  }));
 }
 onClose():void{this.contentEl.empty();}
}
export class TetradDisplayModal extends Modal {
 constructor(app:App,private store:TetradStore){super(app);this.setTitle(t('tetrad.appearance'));}
 onOpen():void{
  const display=structuredClone(this.store.display);
  new Setting(this.contentEl).setName(t('tetrad.center')).addDropdown(select=>select.addOptions({none:t('tetrad.none'),labels:t('tetrad.labels'),legend:t('tetrad.legend')}).setValue(display.centerDisplay).onChange(value=>{display.centerDisplay=value as CenterDisplay;}));
  new Setting(this.contentEl).setName(t('tetrad.legend')).addDropdown(select=>select.addOptions({none:t('tetrad.none'),'bottom-left':t('tetrad.bottomLeft'),'bottom-right':t('tetrad.bottomRight')}).setValue(display.legendPosition).onChange(value=>{display.legendPosition=value as LegendPosition;}));
  for(const law of LAWS)new Setting(this.contentEl).setName(law.label).addText(input=>input.setValue(display.lawText[law.id].label).setPlaceholder(t('tetrad.labels')).onChange(value=>{display.lawText[law.id].label=value;})).addText(input=>input.setValue(display.lawText[law.id].abbreviation).setPlaceholder(t('tetrad.abbreviation')).onChange(value=>{display.lawText[law.id].abbreviation=value;}));
  const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'alert'}});
  new Setting(this.contentEl).addButton(button=>button.setButtonText(t('argdown.apply')).setCta().onClick(()=>{button.setDisabled(true);void this.store.setDisplay(display).then(()=>this.close()).catch((reason:unknown)=>{error.setText(String(reason));button.setDisabled(false);});}));
 }
 onClose():void{this.contentEl.empty();}
}
