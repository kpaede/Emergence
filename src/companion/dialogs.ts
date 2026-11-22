import {FuzzySuggestModal,Modal,Setting,type App,type TFile} from 'obsidian';
import {defaultCompanionStorage} from './preferences';
import {t} from '../i18n';
import type {CompanionService} from './service';
import {storageSummary} from './storage-summary';
export class FilePicker extends FuzzySuggestModal<TFile>{
 constructor(app:App,private files:()=>TFile[],private choose:(file:TFile)=>void,placeholder=t('companion.chooseFile')){super(app);this.setPlaceholder(placeholder);}
 getItems():TFile[]{return this.files();}getItemText(file:TFile):string{return file.path;}onChooseItem(file:TFile):void{this.choose(file);}
}
export class StorageModal extends Modal{
 constructor(app:App,private submit:(options:import('./model').StorageOptions)=>Promise<void>,private defaults:()=>import('./model').StorageOptions=defaultCompanionStorage,private source=''){super(app);this.modalEl.addClass('em-companion-dialog');this.setTitle(t('companion.create'));}
 onOpen():void{
  const options={...this.defaults()},choices=this.contentEl.createDiv({cls:'em-companion-storage-choices'});let custom=false;
  new Setting(this.contentEl).setName(t('companion.storageMode')).setDesc(t('companion.layoutLocked')).addDropdown(select=>{select.selectEl.dataset.companionControl='mode';select.addOptions({document:t('companion.oneDocument'),sections:t('companion.perHeading')}).setValue(options.mode).onChange(value=>{options.mode=value==='sections'?'sections':'document';});});
  const summary=this.contentEl.createDiv({cls:'em-companion-storage-defaults',attr:{'data-companion-defaults':'true'}}),showDefaults=()=>{summary.empty();const current=storageSummary(this.defaults(),this.source);summary.createDiv({text:t('companion.currentDefaults',{description:current.description})});summary.createDiv({text:t('companion.resolvedFolder',{folder:current.folder}),cls:'em-companion-start-path'});summary.hidden=custom;};
  const choice=new Setting(this.contentEl).setName(t('companion.storageChoice')).addDropdown(select=>{select.selectEl.dataset.companionControl='storage-choice';select.addOptions({defaults:t('companion.useDefaults'),custom:t('companion.customStorage')}).onChange(value=>{custom=value==='custom';choices.hidden=!custom;for(const field of choices.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'))field.disabled=!custom;showDefaults();});});this.contentEl.append(choice.settingEl,summary,choices);choices.hidden=true;showDefaults();
  const folderRow=new Setting(choices),subfolderRow=new Setting(choices),update=()=>{folderRow.settingEl.hidden=options.location!=='folder';subfolderRow.settingEl.hidden=options.location!=='subfolder';};
  new Setting(choices).setName(t('companion.storageLocation')).addDropdown(select=>{select.selectEl.dataset.companionControl='location';select.addOptions({beside:t('companion.beside'),subfolder:t('companion.subfolder'),folder:t('companion.separateFolder')}).setValue(options.location).onChange(value=>{options.location=value==='folder'?'folder':value==='subfolder'?'subfolder':'beside';update();});});
  folderRow.setName(t('companion.folder')).setDesc(t('companion.folderHelp')).addText(input=>input.setValue(options.folder).onChange(value=>{options.folder=value.trim().replace(/\/+$/u,'');}));
  subfolderRow.setName(t('companion.subfolderName')).setDesc(t('companion.subfolderHelp')).addText(input=>input.setValue(options.subfolder??'Companions').onChange(value=>{options.subfolder=value.trim();}));choices.append(folderRow.settingEl,subfolderRow.settingEl);update();choices.addClass('is-default');for(const field of choices.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'))field.disabled=true;
  this.contentEl.createDiv({text:t('companion.storageHelp'),cls:'em-muted'});const error=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),button=this.contentEl.createEl('button',{text:t('companion.create'),cls:'mod-cta'});
  button.onclick=()=>{button.disabled=true;void this.submit({...(custom?options:this.defaults()),mode:options.mode,origin:custom?'custom':'defaults'}).then(()=>this.close()).catch((reason:unknown)=>{error.setText(String(reason));button.disabled=false;});};
 }
 onClose():void{this.contentEl.empty();}
}

export class RecoveryModal extends Modal{
 constructor(app:App,private service:CompanionService,private path:string){super(app);this.modalEl.addClass('em-companion-dialog');this.setTitle(t('companion.recoverWrites'));}
 onOpen():void{
  this.contentEl.createEl('p',{text:t('companion.recoveryReview')});const plan=this.service.recoveryPlan(this.path) as {writes:{path:string;before:string|null;after:string}[]}|undefined;
  for(const write of plan?.writes??[]){const details=this.contentEl.createEl('details');details.createEl('summary',{text:write.path});for(const [label,text]of [[t('companion.beforeWrite'),write.before??''],[t('companion.plannedWrite'),write.after]] as const){details.createEl('p',{text:label});const area=details.createEl('textarea',{cls:'em-mm-text-input',attr:{readonly:'true','aria-label':label}});area.value=text;}}
  const status=this.contentEl.createDiv({cls:'em-error',attr:{role:'status'}}),retry=this.contentEl.createEl('button',{text:t('companion.recoverWrites')});retry.onclick=()=>{retry.disabled=true;void this.service.recover(this.path).then(()=>this.close()).catch((error:unknown)=>{status.setText(String(error));retry.disabled=false;});};
  const accept=this.contentEl.createEl('button',{text:t('companion.acceptCurrent'),cls:'mod-warning'});accept.onclick=()=>{accept.disabled=true;void this.service.acceptRecovery(this.path).then(()=>this.close()).catch((error:unknown)=>{status.setText(String(error));accept.disabled=false;});};
 }
 onClose():void{this.contentEl.empty();}
}
