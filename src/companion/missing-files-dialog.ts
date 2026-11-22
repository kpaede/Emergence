import {Modal,type App} from 'obsidian';
import {t} from '../i18n';

/** Explain the missing files directly, without sending the user into internal metadata. */
export class MissingFilesModal extends Modal {
 private generation=0;
 constructor(app:App,private files:()=>Promise<{id:string;title:string;path:string}[]>,private retry:()=>void,private choose:(id:string)=>void,private create:(id:string)=>void){super(app);this.modalEl.addClass('em-companion-dialog');this.setTitle(t('companion.missingFilesTitle'));}
 onOpen():void{
  const generation=++this.generation;this.contentEl.createEl('p',{text:t('companion.missingFilesHelp')});const list=this.contentEl.createDiv({cls:'em-companion-missing-files'}),status=this.contentEl.createDiv({attr:{role:'status'}});
  void this.files().then(files=>{if(generation!==this.generation)return;for(const file of files){const row=list.createDiv({cls:'em-companion-missing-file',attr:{'data-companion-missing-path':file.path}});row.createEl('strong',{text:file.title});row.createDiv({text:file.path});row.createEl('button',{text:t('companion.chooseChapterFile')}).onclick=()=>{this.close();this.choose(file.id);};row.createEl('button',{text:t('companion.createChapterFile')}).onclick=()=>{this.close();this.create(file.id);};}if(!files.length)status.setText(t('companion.noMissingFiles'));}).catch((error:unknown)=>{if(generation===this.generation)status.setText(String(error));});
  this.contentEl.createEl('button',{text:t('companion.retry'),cls:'mod-cta'}).onclick=()=>{this.close();this.retry();};
 }
 onClose():void{this.generation++;this.contentEl.empty();}
}
