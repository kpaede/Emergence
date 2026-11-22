import {t} from '../i18n';
import type {ChapterFileIssue} from './model';

interface Actions {retry:()=>void;choose:()=>void;create:()=>Promise<void>;open:()=>void}
export function renderChapterFileProblem(host:HTMLElement,issue:ChapterFileIssue,actions:Actions):void{
 host.empty();host.createEl('h3',{text:t(issue.reason==='missing'?'companion.chapterFileMissing':'companion.chapterFileInvalid')});host.createEl('p',{text:t(issue.reason==='missing'?'companion.missingChapterHelp':'companion.invalidChapterHelp')});host.createDiv({text:t('companion.expectedChapterPath',{path:issue.path||t('companion.noFileLink')}),cls:'em-companion-start-path'});
 host.createEl('button',{text:t('companion.chooseChapterFile'),cls:'mod-cta',attr:{'data-companion-action':'choose-chapter-file'}}).onclick=actions.choose;
 if(issue.reason==='missing'){const create=host.createEl('button',{text:t('companion.createChapterFile'),attr:{'data-companion-action':'create-chapter-file'}});create.onclick=()=>{create.disabled=true;void actions.create().finally(()=>{create.disabled=false;});};}
 host.createEl('button',{text:t('companion.retry'),attr:{'data-companion-action':'retry'}}).onclick=actions.retry;
 if(issue.reason!=='missing'){
  host.createEl('button',{text:t('companion.inspectExisting')}).onclick=actions.open;
  if(issue.message){const details=host.createEl('details');details.createEl('summary',{text:t('companion.problemDetails')});details.createEl('p',{text:issue.message});}
 }
}
