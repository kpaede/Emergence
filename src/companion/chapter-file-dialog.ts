import {Modal,type App} from 'obsidian';
import {t} from '../i18n';
import type {ChapterFilePlan} from './chapter-recovery';

/** Ordinary Markdown is adopted only after the user sees how its contents are retained. */
export class ChapterFileDialog extends Modal{
 constructor(app:App,private plan:ChapterFilePlan,private apply:()=>Promise<void>){super(app);this.modalEl.addClass('em-companion-dialog');this.setTitle(t('companion.assignChapterFile'));}
 onOpen():void{
  this.contentEl.createEl('p',{text:t('companion.assignChapterHelp',{title:this.plan.title,path:this.plan.path})});
  this.contentEl.createEl('p',{text:t(this.plan.kind==='outline'?'companion.adoptOutlineHelp':'companion.adoptTextHelp')});
  const details=this.contentEl.createEl('details');details.createEl('summary',{text:t('companion.markdownAfterAssignment')});const preview=details.createEl('textarea',{cls:'em-mm-text-input',attr:{readonly:'true','aria-label':t('companion.markdownAfterAssignment')}});preview.value=this.plan.after;
  const status=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),confirm=this.contentEl.createEl('button',{text:t('companion.assignChapterFile'),cls:'mod-cta',attr:{'data-companion-action':'confirm-assignment'}});
  confirm.onclick=()=>{confirm.disabled=true;void this.apply().then(()=>this.close()).catch((error:unknown)=>{status.setText(error instanceof Error?error.message:String(error));confirm.disabled=false;});};
 }
 onClose():void{this.contentEl.empty();}
}
