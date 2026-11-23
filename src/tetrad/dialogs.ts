import {Modal,Setting,type App} from 'obsidian';
import {t} from '../i18n';
import {LAWS} from './render/laws';
import {DEFAULT_PATTERN,type TetradPattern,type TetradStore} from './patterns';
import type {CenterDisplay,LegendPosition} from './settings-model';
import {displayOptions} from './appearance-settings';

export class TetradDisplayModal extends Modal {
 constructor(app:App,private store:TetradStore,private pattern:TetradPattern=DEFAULT_PATTERN){super(app);this.setTitle(t('tetrad.appearance'));}
 onOpen():void{
  const display=this.store.settings(this.pattern);
  new Setting(this.contentEl).setName(t('tetrad.center')).setDesc(t('tetrad.centerHelp')).addDropdown(select=>select.addOptions(displayOptions('centerDisplay')).setValue(display.centerDisplay).onChange(value=>{display.centerDisplay=value as CenterDisplay;}));
  new Setting(this.contentEl).setName(t('tetrad.legendPosition')).setDesc(t('tetrad.legendHelp')).addDropdown(select=>select.addOptions(displayOptions('legendPosition')).setValue(display.legendPosition).onChange(value=>{display.legendPosition=value as LegendPosition;}));
  for(const law of LAWS)new Setting(this.contentEl).setName(t(`tetrad.${law.id}`)).addText(input=>input.setValue(display.lawText[law.id].label).setPlaceholder(t('tetrad.labels')).onChange(value=>{display.lawText[law.id].label=value;})).addText(input=>input.setValue(display.lawText[law.id].abbreviation).setPlaceholder(t('tetrad.abbreviation')).onChange(value=>{display.lawText[law.id].abbreviation=value;}));
  const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'alert'}});
  new Setting(this.contentEl).addButton(button=>button.setButtonText(t('argdown.apply')).setCta().onClick(()=>{button.setDisabled(true);void this.store.setAppearance(this.pattern,display).then(()=>this.close()).catch((reason:unknown)=>{error.setText(String(reason));button.setDisabled(false);});}));
 }
 onClose():void{this.contentEl.empty();}
}
