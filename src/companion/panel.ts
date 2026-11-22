import {Component,Modal,Menu,type WorkspaceLeaf,type App} from 'obsidian';
import {t} from '../i18n';
import {settleSteps} from '../cleanup';
import {iconButton,relabelIcon} from '../ui/panel';
import {FilePicker,StorageModal,RecoveryModal} from './dialogs';
import {CompanionSplit} from './split';
import {CompanionNavigation} from './navigation';
import {NativeCompanionView} from './native-view';
import {renderCompanionLanding,type LandingState} from './landing';
import {MissingSectionFileError} from './problems';
import {MissingFilesModal} from './missing-files-dialog';
import {renderChapterFileProblem} from './chapter-file-problem';
import {ChapterFileDialog} from './chapter-file-dialog';
import type {ChapterFilePlan} from './chapter-recovery';
import type {CompanionViewMode} from './native-types';
import type {CompanionDocument,CompanionSection,StorageOptions} from './model';
import type {CompanionService} from './service';

export class CompanionPanel extends Component {
 readonly root:HTMLElement;path='';selected='';pinned=false;
 private document?:CompanionDocument;private native:NativeCompanionView;private viewPick:HTMLSelectElement;private nativeHost:HTMLElement;private mode:CompanionViewMode='eome';private navigation:CompanionNavigation;private split:CompanionSplit;private followCursor=true;private cursorTimer?:number;private sections:HTMLElement;private review:HTMLElement;private recovery:HTMLElement;private message:HTMLElement;private status:HTMLElement;
 private sourceLabel:HTMLElement;private sourcePath='';private create:HTMLButtonElement;private pick:HTMLSelectElement;private splitHost:HTMLElement;private thoughtTools:HTMLElement;private layoutLabel:HTMLElement;private sectionProblem:HTMLElement;private creationMode?:StorageOptions['mode'];
 private empty:HTMLElement;private editorHost:HTMLElement;private generation=0;private fingerprint='';private active=false;private readPath='';private readRevision=-1;private enabled=true;private held=false;private dragging=false;private pending=false;private loading?:Promise<void>;private relabel:()=>void;private updateControls:()=>void=()=>{};
 private fullscreen?:Modal;private dialogs=new Set<Modal>();
 private navigationRequest=0;private navigating=false;
 private openingSources=new Map<string,{leaf:WorkspaceLeaf;ready:Promise<void>}>();
 constructor(readonly app:App,host:HTMLElement,readonly service:CompanionService,private currentFile:()=>string,private ownerLeaf:WorkspaceLeaf){
  super();this.root=host.createDiv({cls:'em-companion'});const header=this.root.createDiv({cls:'em-companion-header'}),tools=header.createDiv({cls:'em-companion-tools'});
  this.pick=tools.createEl('select',{attr:{'aria-label':t('companion.chooseCompanion')}});this.pick.onchange=()=>{void this.run(()=>this.selectCompanion(this.pick.value));};
  const pin=iconButton(tools,'pin',t('companion.pin'),()=>{this.pinned=!this.pinned;pin.setAttribute('aria-pressed',String(this.pinned));this.context();});pin.setAttribute('aria-pressed','false');
  const sync=iconButton(tools,'refresh-cw',t('companion.refresh'),()=>{void this.run(()=>this.service.sync(this.path));});
  const full=iconButton(tools,'maximize',t('companion.fullscreen'),()=>this.toggleFullscreen());
  this.sourceLabel=header.createDiv({cls:'em-companion-source'});this.status=header.createDiv({cls:'em-mm-status',attr:{role:'status'}});
  const actions=header.createDiv({cls:'em-companion-tools'});this.create=iconButton(tools,'file-plus',t('companion.create'),()=>this.newCompanion());
  const existing=iconButton(tools,'folder-open',t('companion.selectExisting'),()=>this.chooseExisting());
  const more=iconButton(tools,'ellipsis',t('companion.documentActions'),()=>{const menu=new Menu();if(this.app.vault.getFileByPath(this.path))menu.addItem(item=>item.setTitle(t('companion.openSource')).setIcon('file-text').onClick(()=>this.openMarkdown()));menu.addItem(item=>item.setTitle(t('companion.create')).setIcon('file-plus').onClick(()=>this.newCompanion()));menu.addItem(item=>item.setTitle(t('companion.selectExisting')).setIcon('folder-open').onClick(()=>this.chooseExisting()));if(this.document)menu.addItem(item=>item.setTitle(t('companion.rebind')).setIcon('link').onClick(()=>this.rebind()));menu.showAtPosition({x:more.getBoundingClientRect().right,y:more.getBoundingClientRect().bottom});});
  const recover=actions.createEl('button',{text:t('companion.recoverWrites')});recover.onclick=()=>{const path=this.path;void this.run(async()=>{try{await this.service.recover(path);}catch{this.dialog(new RecoveryModal(this.app,this.service,path));}});};

  this.message=this.root.createDiv({cls:'em-companion-message em-error',attr:{role:'status'}});this.recovery=this.root.createDiv({cls:'em-companion-recovery'});this.review=this.root.createDiv({cls:'em-companion-review'});
  this.empty=this.root.createDiv({cls:'em-companion-start'});
  const split=this.splitHost=this.root.createDiv({cls:'em-companion-split'}),nav=split.createDiv({cls:'em-companion-nav-pane'}),navHeader=nav.createDiv({cls:'em-companion-nav-heading'});navHeader.createSpan({text:t('companion.outline')});
  const follow=iconButton(navHeader,'crosshair',t('companion.followCursor'),()=>{this.followCursor=!this.followCursor;follow.setAttribute('aria-pressed',String(this.followCursor));if(this.followCursor)this.followPosition();});follow.setAttribute('aria-pressed','true');
  const toggle=iconButton(navHeader,'panel-top-close',t('companion.showOutline'),()=>{nav.toggleClass('is-collapsed',!nav.hasClass('is-collapsed'));this.split.setCollapsed(nav.hasClass('is-collapsed'));toggle.setAttribute('aria-expanded',String(!nav.hasClass('is-collapsed')));});toggle.setAttribute('aria-expanded','true');
  this.sections=nav.createDiv({cls:'em-companion-sections'});this.editorHost=split.createDiv({cls:'em-companion-content'});const thoughtTools=this.thoughtTools=this.root.createDiv({cls:'em-companion-thought-tools'});this.root.insertBefore(thoughtTools,this.message);const viewLabel=thoughtTools.createEl('label',{cls:'em-companion-view-label'});viewLabel.createSpan({text:t('companion.viewMode')});this.viewPick=viewLabel.createEl('select',{attr:{'aria-label':t('companion.viewMode')}});for(const mode of ['eome','lineage'] as const)this.viewPick.createEl('option',{value:mode,text:t(`companion.${mode}`)});this.viewPick.onchange=()=>{const mode=this.viewPick.value as CompanionViewMode;void this.run(async()=>{await this.native.close();this.service.setViewMode(this.path,mode);this.mode=mode;});};this.nativeHost=this.editorHost.createDiv({cls:'em-companion-native-host'});
  this.sectionProblem=this.editorHost.createDiv({cls:'em-companion-section-problem'});this.editorHost.insertBefore(this.sectionProblem,this.nativeHost);this.sectionProblem.hidden=true;this.layoutLabel=thoughtTools.createSpan({cls:'em-companion-layout-label'});
  this.split=this.addChild(new CompanionSplit(split,this.editorHost,service.layoutPreferences(),value=>service.setLayoutPreferences(value)));
  this.navigation=this.addChild(new CompanionNavigation(this.sections,section=>{void this.run(()=>this.chooseSection(section));},operations=>{void this.run(()=>this.service.executeMany(this.path,operations));},section=>this.openChapter(section)));
  this.native=this.addChild(new NativeCompanionView(app,this.nativeHost,service,this.ownerLeaf,()=>{const file=this.app.vault.getFileByPath(this.document?.files?.[this.selected]??this.path);if(file)void this.app.workspace.getLeaf('tab').openFile(file);}));
  this.register(service.subscribePosition((source)=>{if(source!==this.document?.source||!this.followCursor||!this.active||this.navigating)return;if(this.cursorTimer)window.clearTimeout(this.cursorTimer);this.cursorTimer=window.setTimeout(()=>{this.cursorTimer=undefined;const line=this.service.currentPosition(source),next=line===undefined?undefined:this.service.sectionAt(this.path,line);if(!next||next===this.selected)return;void this.native.flush().then(()=>this.followPosition()).catch((error:unknown)=>this.message.setText(String(error)));},70);}));
  this.register(service.subscribe(()=>{this.fingerprint='';this.context();if(this.active){this.recoveries();void this.refresh();}}));
  this.registerDomEvent(this.root,'pointerdown',()=>{this.held=true;},{capture:true});
  const release=()=>{this.held=false;if(this.pending&&!this.dragging){this.pending=false;window.setTimeout(()=>{void this.refresh(true);},0);}};
  this.registerDomEvent(this.root.ownerDocument,'pointerup',release);this.registerDomEvent(this.root.ownerDocument,'pointercancel',release);this.registerDomEvent(this.root,'dragstart',()=>{this.dragging=true;},{capture:true});this.registerDomEvent(this.root.ownerDocument,'dragend',()=>{this.dragging=false;release();});
  this.register(()=>{this.generation++;if(this.cursorTimer)window.clearTimeout(this.cursorTimer);this.fullscreen?.close();for(const modal of this.dialogs)modal.close();this.root.remove();});
  this.updateControls=()=>{recover.hidden=!this.service.needsRecovery(this.path);sync.disabled=!this.service.pair(this.path)||!this.app.vault.getFileByPath(this.path);};
  this.relabel=()=>{this.pick.setAttribute('aria-label',t('companion.chooseCompanion'));relabelIcon(pin,t('companion.pin'));relabelIcon(sync,t('companion.refresh'));relabelIcon(full,t('companion.fullscreen'));relabelIcon(follow,t('companion.followCursor'));relabelIcon(toggle,t('companion.showOutline'));relabelIcon(this.create,t('companion.create'));relabelIcon(existing,t('companion.selectExisting'));recover.setText(t('companion.recoverWrites'));viewLabel.querySelector('span')?.setText(t('companion.viewMode'));for(const option of this.viewPick.options)option.text=t(`companion.${option.value as CompanionViewMode}`);this.sections.setAttribute('aria-label',t('companion.sections'));};this.context();
 }
 setVisible(visible:boolean):void{this.active=visible;if(!visible){this.navigationRequest++;this.navigating=false;void this.native.close().catch((error:unknown)=>this.message.setText(String(error)));}}
 setEnabled(enabled:boolean):void{this.enabled=enabled;if(!enabled){void this.native.close().catch((error:unknown)=>this.message.setText(String(error)));this.fullscreen?.close();for(const modal of this.dialogs)modal.close();}}
 refreshLanguage():void{this.relabel();this.split.refreshLanguage();this.fingerprint='';this.context();if(this.active)void this.refresh(true);}
 async activate():Promise<void>{if(!this.enabled)return;this.active=true;this.service.start();await this.refresh(true);}
 context():void{
  this.path=this.service.canonicalPath(this.path);
  const file=this.currentFile(),pairs=this.service.list(),direct=this.service.pair(file),source=this.service.mainFor(file),matching=source?this.service.forSource(source):[];
  if(!this.pinned&&!this.dragging&&!this.dialogs.size&&!this.native.editing){const next=direct?.path??(matching.some(pair=>pair.path===this.path)?this.path:matching.length===1?matching[0]!.path:source&&source!==this.sourcePath?'':undefined);if(next!==undefined&&next!==this.path){this.path=next;this.selected='';this.fingerprint='';}if(source)this.sourcePath=source;}
  const key=JSON.stringify(pairs.map(p=>[p.path,p.source]));if(this.pick.dataset.key!==key){this.pick.dataset.key=key;this.pick.empty();this.pick.createEl('option',{value:'',text:t('companion.chooseCompanion')});for(const pair of pairs)this.pick.createEl('option',{value:pair.path,text:pair.path.replace(/\.md$/u,'').split('/').at(-1)??pair.path});}this.pick.value=pairs.some(pair=>pair.path===this.path)?this.path:'';
  this.updateControls();const pair=this.service.pair(this.path);this.create.hidden=false;this.create.disabled=false;if(pair)this.sourcePath=pair.source;
  this.sourceLabel.setText((pair?.source??file??'').split('/').at(-1)?.replace(/\.md$/u,'')??'');this.sourceLabel.title=pair?.source??file??'';
  this.status.setText(pair?.missing?t('companion.sourceMissing'):pair?t('companion.following'):t('companion.empty'));if(pair?.error)this.message.setText(pair.error);
  if(this.active&&!this.held&&!this.dragging)void this.refresh();
 }
 async refresh(force=false):Promise<void>{
  if(!this.active||!this.enabled)return;if(this.held||this.dragging){this.pending=true;return;}if(this.loading){if(force)this.pending=true;return this.loading;}
  this.loading=this.loadDocument(force).finally(()=>{this.loading=undefined;if(this.pending){this.pending=false;void this.refresh(true);}});return this.loading;
 }
 private async loadDocument(force:boolean):Promise<void>{
  const path=this.path,generation=++this.generation;
  if(!path){const source=this.actionSource(),choices=this.service.forSource(source);this.showLanding(choices.length>1?'multiple':source?'empty':'noSource');return;}
  if(!this.app.vault.getFileByPath(path)){this.showLanding('missing');return;}
  if(!force&&this.readPath===path&&this.readRevision===this.service.pair(path)?.revision)return;
  try{
   if(!this.service.pair(path))await this.service.connect(path);await this.service.normalize(path);const document=await this.service.readForView(path);if(generation!==this.generation||path!==this.path)return;
   const fingerprint=document.original+this.selected;if(!force&&fingerprint===this.fingerprint)return;this.fingerprint=fingerprint;this.document=document;this.sourcePath=document.source;this.readPath=path;this.readRevision=this.service.pair(path)?.revision??-1;this.empty.hidden=true;this.splitHost.hidden=false;this.thoughtTools.hidden=false;this.message.setText(this.service.pair(path)?.error??'');this.selectPosition(document);this.paint(document);this.recoveries();if(!this.app.vault.getFileByPath(document.source)){this.message.setText(t('companion.sourceMissing'));this.message.createEl('button',{text:t('companion.rebind')}).onclick=()=>this.rebind();}
  }catch(error){if(generation===this.generation&&path===this.path)this.showLanding(!this.app.vault.getFileByPath(path)?'missing':error instanceof MissingSectionFileError?'missingSection':'unreadable',String(error));}
 }
 private actionSource():string{return (this.pinned?this.service.pair(this.path)?.source??this.sourcePath:undefined)??this.service.mainFor(this.currentFile())??this.sourcePath;}
 private async selectCompanion(path:string):Promise<void>{this.navigationRequest++;this.navigating=false;await this.native.close();this.path=path;this.selected='';this.pinned=true;if(path)this.sourcePath=this.service.pair(path)?.source??this.service.mainFor(path)??this.sourcePath;this.context();}
 private newCompanion():void{
  const open=(source:string)=>this.dialog(new StorageModal(this.app,async options=>{await this.native.close();const path=await this.service.create(source,options);this.creationMode=options.mode;this.sourcePath=source;await this.selectCompanion(path);await this.refresh(true);},()=>{const defaults=this.service.storageDefaults();return {...defaults,mode:this.creationMode??defaults.mode};},source)),source=this.actionSource();
  if(source&&this.app.vault.getFileByPath(source))open(source);else this.dialog(new FilePicker(this.app,()=>this.app.vault.getMarkdownFiles().filter(file=>this.service.mainFor(file.path)===file.path),file=>open(file.path)));
 }
 private chooseExisting():void{this.dialog(new FilePicker(this.app,()=>this.service.existingFiles(),file=>{void this.run(()=>this.selectCompanion(file.path));},t('companion.selectExisting')));}
 private chooseChapterFile(id:string):void{
  const path=this.path;this.dialog(new FilePicker(this.app,()=>this.app.vault.getMarkdownFiles().filter(file=>file.path!==path&&!this.service.list().some(pair=>pair.source===file.path)),file=>{void this.run(async()=>{
   const plan=await this.service.prepareChapterFile(path,id,file.path);if(plan.kind==='existing')await this.useChapterFile(plan);else this.dialog(new ChapterFileDialog(this.app,plan,()=>this.useChapterFile(plan)));
  });},t('companion.chooseChapterFile')));
 }
 private async useChapterFile(plan:ChapterFilePlan):Promise<void>{await this.service.useChapterFile(plan);await this.showRepairedChapter(plan.index,plan.section);}
 private createChapterFile(id:string):Promise<void>{const path=this.path;return this.run(async()=>{await this.service.createChapterFile(path,id);await this.showRepairedChapter(path,id);});}
 private async showRepairedChapter(path:string,id:string):Promise<void>{if(path!==this.path||!this.active)return;this.document=await this.service.readForView(path);const section=this.document.sections.find(section=>section.id===id);if(section)await this.chooseSection(section);await this.refresh(true);}
 private showMissingFiles():void{const path=this.path;this.dialog(new MissingFilesModal(this.app,()=>this.service.missingChapters(path),()=>{void this.refresh(true);},id=>this.chooseChapterFile(id),id=>{void this.createChapterFile(id);}));}
 private rebind():void{const path=this.path;this.dialog(new FilePicker(this.app,()=>this.app.vault.getMarkdownFiles().filter(file=>this.service.mainFor(file.path)===file.path),file=>{void this.run(async()=>{await this.native.close();await this.service.rebind(path,file.path);this.sourcePath=file.path;await this.service.sync(path);});}));}
 private openMarkdown():void{this.openFile(this.document?.files?.[this.selected]??this.path);}
 private openChapter(section:CompanionSection):void{this.openFile(this.document?.files?.[section.id]??'');}
 private openFile(path:string):void{
  const file=this.app.vault.getFileByPath(path);if(!file){void this.refresh(true);return;}const existing=this.app.workspace.getLeavesOfType('markdown').find(leaf=>(leaf.view as {file?:{path:string}}).file?.path===path);
  if(existing)this.app.workspace.setActiveLeaf(existing,{focus:true});else void this.app.workspace.getLeaf('tab').openFile(file).catch((error:unknown)=>this.message.setText(String(error)));
 }
 private showLanding(state:LandingState,detail?:string):void{
  this.sourcePath=this.service.pair(this.path)?.source??this.actionSource();this.document=undefined;this.fingerprint='';this.readPath='';this.readRevision=-1;this.empty.hidden=false;this.splitHost.hidden=true;this.thoughtTools.hidden=true;this.sections.empty();this.review.empty();this.message.empty();
  const source=this.actionSource(),choices=this.service.forSource(source).filter(pair=>pair.path!==this.path&&!!this.app.vault.getFileByPath(pair.path));
  renderCompanionLanding(this.empty,state,source,this.path,choices,{create:()=>this.newCompanion(),choose:()=>this.chooseExisting(),retry:()=>{void this.refresh(true);},open:()=>this.openMarkdown(),missingFiles:()=>this.showMissingFiles(),select:path=>{void this.run(()=>this.selectCompanion(path));},changeLayout:mode=>{this.creationMode=mode;}},this.creationMode??this.service.storageDefaults().mode,!!this.app.vault.getFileByPath(this.path),detail);
  void (state==='missing'||state==='unreadable'||state==='missingSection'?this.native.retire():this.native.close()).then(()=>this.recoveries()).catch((error:unknown)=>{this.message.setText(String(error));this.recoveries();});this.recoveries();
 }
 private paint(document:CompanionDocument):void{
  this.sections.empty();this.review.empty();
  const mode=document.storage?.mode??'document';this.layoutLabel.dataset.companionLayout=mode;this.layoutLabel.setText(t(mode==='sections'?'companion.layoutBadgeSections':'companion.layoutBadgeSingle'));this.layoutLabel.title=t('companion.savedLayout',{layout:t(mode==='sections'?'companion.perHeading':'companion.oneDocument')});
  if(!document.sections.some(s=>s.id===this.selected))this.selected=document.sections.find(s=>s.state==='linked'||s.state==='general')?.id??document.sections[0]?.id??'';
  this.navigation.render(document,this.selected,this.path);
  const selected=document.sections.find(s=>s.id===this.selected);this.mode=this.service.viewMode(this.path);this.viewPick.value=this.mode;
  const issue=selected?document.unavailableFiles?.[selected.id]:undefined;this.sectionProblem.hidden=!issue;this.nativeHost.hidden=!!issue;this.sectionProblem.empty();
  if(issue&&selected){renderChapterFileProblem(this.sectionProblem,issue,{retry:()=>{void this.refresh(true);},choose:()=>this.chooseChapterFile(selected.id),create:()=>this.createChapterFile(selected.id),open:()=>this.openChapter(selected)});void this.native.retire().then(()=>this.recoveries()).catch((error:unknown)=>this.message.setText(String(error)));return;}
  if(selected){void this.native.render(this.path,document,selected,this.mode).catch((error:unknown)=>this.message.setText(String(error)));if(selected.state==='review')this.reviewSection(document,selected);}else void this.native.close().catch((error:unknown)=>this.message.setText(String(error)));
 }
 private selectPosition(document:CompanionDocument):void{
  if(!this.followCursor||this.native.editing||this.held||this.dragging||this.navigating)return;const line=this.service.currentPosition(document.source);if(line===undefined)return;const selected=this.service.sectionAt(this.path,line)??document.sections.filter(section=>section.state==='linked'&&section.base&&section.base.line<=line).at(-1)?.id;if(selected)this.selected=selected;
 }
 private followPosition():void{if(!this.document||!this.active||!this.followCursor||this.native.editing||this.held||this.dragging||this.navigating)return;const before=this.selected;this.selectPosition(this.document);if(before!==this.selected){this.paint(this.document);this.navigation.reveal(this.selected);}}
 private async chooseSection(section:CompanionSection):Promise<void>{
  const request=++this.navigationRequest,path=this.path;this.navigating=true;if(this.cursorTimer)window.clearTimeout(this.cursorTimer);this.cursorTimer=undefined;
  try{if(this.document?.unavailableFiles?.[this.selected])await this.native.retire();else await this.native.flush();if(request!==this.navigationRequest||path!==this.path||!this.active)return;this.selected=section.id;if(this.document)this.paint(this.document);this.recoveries();await this.goToSource(section,request);}
  finally{if(request===this.navigationRequest)this.navigating=false;}
 }
 private async goToSource(section:CompanionSection,request=this.navigationRequest):Promise<void>{
  if(!this.document||section.state!=='linked'||!section.base)return;const path=this.path,source=this.document.source,line=this.service.sourceLine(path,section.id)??section.base.line;
  this.service.position(source,line);const file=this.app.vault.getFileByPath(source);if(!file)return;
  let opening=this.openingSources.get(source),leaf=opening?.leaf??this.app.workspace.getLeavesOfType('markdown').find(leaf=>(leaf.view as {file?:{path:string}}).file?.path===file.path);
  if(!leaf){leaf=this.app.workspace.getLeaf('tab');opening={leaf,ready:leaf.openFile(file,{active:false})};this.openingSources.set(source,opening);}
  if(opening){try{await opening.ready;}finally{if(this.openingSources.get(source)===opening)this.openingSources.delete(source);}}else await leaf.loadIfDeferred();
  if(path!==this.path||request!==this.navigationRequest)return;const view=leaf.view as import('obsidian').MarkdownView;
  if(view.getMode()==='preview')view.setEphemeralState({line});else{view.editor.setCursor({line,ch:0});view.editor.scrollIntoView({from:{line,ch:0},to:{line,ch:0}},true);}this.service.position(source,line);
 }
 private reviewSection(document:CompanionDocument,section:CompanionSection):void{
  this.review.createDiv({text:t('companion.reviewHelp')});const select=this.review.createEl('select',{attr:{'aria-label':t('companion.assignTo')}});select.createEl('option',{value:'',text:t('companion.detached')});for(const candidate of document.sections.filter(s=>s.state==='linked'))select.createEl('option',{value:candidate.id,text:candidate.title});const apply=this.review.createEl('button',{text:t('companion.resolve')});apply.onclick=()=>{void this.run(()=>this.service.resolve(this.path,section.id,select.value||undefined));};
 }
 private recoveries():void{
  this.recovery.empty();for(const draft of this.service.nativeDrafts.values())if(draft.path===this.path||!this.app.vault.getFileByPath(draft.path)){const row=this.recovery.createDiv({cls:'em-companion-draft'});row.createSpan({text:t('companion.nativeDraft')+' · '+draft.kind.toUpperCase()+(!this.app.vault.getFileByPath(draft.path)?' · '+draft.path:'')});const save=row.createEl('button',{text:t('companion.saveNativeDraft')});save.onclick=()=>{void this.run(async()=>{const path=await this.service.exportNativeDraft(draft),file=this.app.vault.getFileByPath(path);if(file)await this.app.workspace.getLeaf('tab').openFile(file);});};const discard=row.createEl('button',{text:t('companion.discardDraft')});discard.onclick=()=>{this.service.discardNativeDraft(draft);this.recoveries();};}for(const draft of this.service.drafts.values())if(draft.path===this.path||!this.app.vault.getFileByPath(draft.path)){const row=this.recovery.createDiv({cls:'em-companion-draft'});row.createSpan({text:t('companion.recovery')+': '+(draft.text.slice(0,70)||t('companion.untitled'))});const open=row.createEl('button',{text:t('companion.resume')});open.onclick=()=>{void this.run(async()=>{const path=await this.service.exportNativeDraft({path:draft.path,section:draft.section,kind:'eome',base:'',text:draft.text}),file=this.app.vault.getFileByPath(path);if(file)await this.app.workspace.getLeaf('tab').openFile(file);});};open.setText(t('companion.saveNativeDraft'));const discard=row.createEl('button',{text:t('companion.discardDraft')});discard.onclick=()=>this.service.discardDraft(draft);}
 }
 async run(action:()=>unknown):Promise<void>{try{await action();this.message.empty();this.fingerprint='';await this.refresh(true);}catch(error){this.message.setText(String(error));}}
 async flush():Promise<void>{await this.native.flush();await this.service.flush();}
 async shutdown():Promise<void>{const errors=await settleSteps([()=>this.native.shutdown(),()=>this.service.flush()]);if(errors.length)throw new AggregateError(errors,t('companion.closeFailed'));}
 private dialog(modal:Modal):void{this.dialogs.add(modal);const close=modal.onClose.bind(modal);modal.onClose=()=>{this.dialogs.delete(modal);close();this.recoveries();};modal.open();}
 toggleFullscreen():void{if(this.fullscreen){this.fullscreen.close();return;}const parent=this.root.parentElement!,next=this.root.nextSibling,modal=this.fullscreen=new Modal(this.app);modal.setTitle(t('companion.title'));modal.modalEl.addClass('em-mm-fullscreen');modal.onOpen=()=>modal.contentEl.append(this.root);modal.onClose=()=>{parent.insertBefore(this.root,next?.parentNode===parent?next:null);this.fullscreen=undefined;};modal.open();}
}
