import {Modal,type App} from 'obsidian';
import {locale,t} from '../i18n';
import {parseCharacterTarget} from './character-target';

export class CharacterTargetModal extends Modal{
 private saving=false;
 override close():void{if(!this.saving)super.close();}
 constructor(app:App,private target:number|undefined,private save:(target:number|undefined)=>Promise<void>){super(app);}
 onOpen():void{
  this.setTitle(t('companion.characterTarget'));this.contentEl.createEl('p',{text:t('companion.characterTargetHelp')});
  const label=this.contentEl.createEl('label',{text:t('companion.characterTarget')}),input=label.createEl('input',{type:'text',attr:{inputmode:'numeric','aria-label':t('companion.characterTarget')}});input.value=this.target===undefined?'':String(this.target);input.placeholder='300000';
  const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),buttons=this.contentEl.createDiv({cls:'modal-button-container'}),cancel=buttons.createEl('button',{text:t('companion.cancel')}),submit=buttons.createEl('button',{text:t('companion.save'),cls:'mod-cta'});
  const apply=async()=>{if(this.saving)return;let target:number|undefined;try{target=parseCharacterTarget(input.value,locale());}catch{error.setText(t('companion.invalidCharacterTarget'));input.focus();return;}this.saving=true;submit.disabled=true;cancel.disabled=true;input.disabled=true;try{await this.save(target);this.saving=false;this.close();}catch(reason){error.setText(reason instanceof Error?reason.message:String(reason));}finally{this.saving=false;submit.disabled=false;cancel.disabled=false;input.disabled=false;}};
  cancel.onclick=()=>this.close();submit.onclick=()=>{void apply();};input.onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();void apply();}};input.focus();input.select();
 }
}
