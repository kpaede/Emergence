import {companionLayout,type CompanionLayout} from './layout';
import {CompanionTransactions} from './transactions';
import {storageOptions,readStored,readStoredForView,ensureFolder,targetFolder,freePath,planStorage,storageHeader,readStorage,resolveSource,type FileWrite} from './storage';
import {Component,parseYaml,type App,type CachedMetadata,type TFile} from 'obsidian';
import type {ChangeDesc,Text} from '@codemirror/state';
import {t} from '../i18n';
import {featureEnabled} from '../features';
import type {Settings} from '../types';
import {renamedPath} from '../graph/rename';
import {emptyCompanion,parseCompanion,serializeCompanion} from './codec';
import {newId,type CompanionDocument,type PairState,type StorageOptions} from './model';
import {sourceHeadings} from './headings';
import {reconcile} from './reconcile';
import {markThoughts,validateThoughts,applyThought,restoreThought,type ThoughtOperation,type OperationResult} from './thoughts';
import {readNote,validPath,sourceEditor} from './repository';
import {mapAnchors} from './live';
import {companionStorageDefaults,validStorage,defaultCompanionView} from './preferences';
import {cachedOutline,liveOutline} from './native-outline';
import type {SourceHeading} from './model';
import {mergeNativeOutline} from './native-projection';
import type {CompanionViewMode,NativeOption,NativeKind} from './native-types';
import {sessionThoughts,needsCompanionCleanup} from './thought-session';
import {prepareChapterFile as prepareChapter,type ChapterFilePlan} from './chapter-recovery';

interface Runtime extends PairState {queue:Promise<void>;timer?:number;anchors:Map<string,number>;liveDoc?:Text;anchorDoc?:Text;anchorSource?:string;undo:HistoryAction[];redo:HistoryAction[];document?:CompanionDocument;working:boolean;outlineSource?:'editor'|'cache'|'fallback';relocation?:Promise<void>}
type HistoryAction={operation:ThoughtOperation}|{restore:NonNullable<OperationResult['restore']>}|{batch:HistoryAction[]};
export class CompanionService extends Component {
 private layout:CompanionLayout=companionLayout(undefined);
 private thoughtSelection=new Map<string,string>();
 private moved=new Map<string,string>();private creating=new Map<string,Promise<unknown>>();
 private pairs=new Map<string,Runtime>();private listeners=new Set<()=>void>();private writing=new Set<string>();private saveTimer?:number;private started=false;private disposed=false;
 private transactions:CompanionTransactions;
 private outlineCache=new Map<string,{source:string;headings:SourceHeading[]}>();private positions=new Map<string,number>();private positionListeners=new Set<(source:string,line:number)=>void>();
 private nativeOptions=new Map<string,NativeOption>();private viewModes=new Map<string,CompanionViewMode>();
 readonly metrics={sourceAnalyses:0,writes:0,liveEvents:0};
 constructor(readonly app:App,data:unknown,private settings:()=>Settings,private persist:()=>Promise<void>){
  super();const saved=data&&typeof data==='object'?data as {pairs?:PairState[];pending?:unknown;layout?:unknown;nativeOptions?:NativeOption[];viewModes?:[string,CompanionViewMode][]}:{};
  this.layout=companionLayout(saved.layout);
  this.transactions=new CompanionTransactions(app,persist,saved.pending,path=>[...this.pairs.values()].some(pair=>pair.source===path));
  for(const p of Array.isArray(saved.pairs)?saved.pairs:[])if(p&&validPath(p.path)&&validPath(p.source))this.registerPair(p.path,p.source);
  for(const item of Array.isArray(saved.nativeOptions)?saved.nativeOptions:[])if(item&&validPath(item.path)&&typeof item.section==='string'&&['eome','lineage'].includes(item.kind)&&typeof item.header==='string')this.nativeOptions.set(this.nativeKey(item.path,item.section,item.kind),item);
  for(const item of Array.isArray(saved.viewModes)?saved.viewModes:[])if(Array.isArray(item)&&validPath(item[0])&&['eome','lineage','reader'].includes(item[1]))this.viewModes.set(item[0],item[1]);
 }
 enabled():boolean{return featureEnabled(this.settings(),'companion');}
 onload():void{
  this.registerEvent(this.app.metadataCache.on('changed',(file,data,cache)=>this.metadata(file,data,cache)));
  let editorTimer:number|undefined;this.register(()=>{if(editorTimer)window.clearTimeout(editorTimer);});
  this.registerEvent(this.app.workspace.on('editor-change',(editor,view)=>{const path=view.file?.path;if(!path||sourceEditor(this.app,path)?.editor!==editor)return;const p=([...this.pairs.values()].find(pair=>pair.path===path||Object.values(pair.document?.files??{}).includes(path)));if(!p||this.writing.has(path)||!this.enabled())return;if(editorTimer)window.clearTimeout(editorTimer);editorTimer=window.setTimeout(()=>{p.revision++;this.notify();this.schedule(p.path,100);},250);}));
  this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{void this.rename(oldPath,file.path);}));
  this.registerEvent(this.app.vault.on('delete',file=>{for(const p of [...this.pairs.values()])if(p.path===file.path||p.path.startsWith(file.path+'/'))this.forget(p.path);for(const pair of this.pairs.values()){if(pair.source===file.path||pair.source.startsWith(file.path+'/')){pair.missing=true;pair.error=t('companion.sourceMissing');pair.revision++;}if(Object.values(pair.document?.files??{}).some(path=>path===file.path||path.startsWith(file.path+'/')))pair.revision++;}this.notify();}));
  this.register(()=>{this.disposed=true;for(const p of this.pairs.values())if(p.timer)window.clearTimeout(p.timer);if(this.saveTimer)window.clearTimeout(this.saveTimer);});
 }
 start():void{if(this.started)return;this.started=true;for(const [key,item]of this.nativeOptions)if(!this.app.vault.getFileByPath(item.path))this.nativeOptions.delete(key);for(const pair of this.pairs.values())if(!this.app.vault.getFileByPath(pair.path))this.forget(pair.path);for(const file of this.app.vault.getMarkdownFiles()){const cache=this.app.metadataCache.getFileCache(file);if(cache?.frontmatter?.['emergence-companion-id'])this.discover(file,cache);}if(this.enabled())for(const p of this.pairs.values())this.schedule(p.path,20);}
 resume():void{if(!this.enabled())return;if(!this.started){this.start();return;}for(const p of this.pairs.values())this.schedule(p.path,20);}
 snapshot():unknown{return {layout:{...this.layout},pairs:[...this.pairs.values()].map(({path,source})=>({path,source,revision:0})),pending:[...this.transactions.pending.values()],nativeOptions:[...this.nativeOptions.values()],viewModes:[...this.viewModes]};}
 layoutPreferences():CompanionLayout{return {...this.layout};}
 setLayoutPreferences(value:CompanionLayout):void{this.layout=companionLayout(value);this.saveSoon();}
 viewMode(path:string):CompanionViewMode{return this.viewModes.get(this.canonicalPath(path))??defaultCompanionView(this.settings());}
 setViewMode(path:string,mode:CompanionViewMode):void{this.viewModes.set(this.canonicalPath(path),mode);this.saveSoon();}
 selectedThought(path:string,section:string):string{return this.thoughtSelection.get(JSON.stringify([this.canonicalPath(path),section]))??'';}
 selectThought(path:string,section:string,id:string):void{this.thoughtSelection.set(JSON.stringify([this.canonicalPath(path),section]),id);}
 nativeKey(path:string,section:string,kind:NativeKind):string{return JSON.stringify([this.canonicalPath(path),section,kind]);}
 nativeHeader(path:string,section:string,kind:NativeKind):string{return this.nativeOptions.get(this.nativeKey(path,section,kind))?.header??'';}
 saveNativeHeader(path:string,section:string,kind:NativeKind,header:string):void{if(this.nativeHeader(path,section,kind)===header)return;this.nativeOptions.set(this.nativeKey(path,section,kind),{path:this.canonicalPath(path),section,kind,header});this.saveSoon();}
 replaceNativeSection(path:string,id:string,expected:string,text:string):Promise<string>{path=this.canonicalPath(path);return this.enqueue(path,async p=>{const doc=markThoughts(await this.readForView(path)),section=doc.sections.find(section=>section.id===id);if(!section||doc.unavailableFiles?.[id]||section.raw!==expected)throw new Error(t('companion.nativeConflict'));const next=mergeNativeOutline(section,text);if(section.raw!==next){section.raw=next;section.format=2;validateThoughts(doc);await this.commit(p,doc.original,doc);p.undo=[];p.redo=[];}return p.document?.sections.find(section=>section.id===id)?.raw??section.raw;});}
 list():PairState[]{return [...this.pairs.values()].map(({path,source,error,revision,missing})=>({path,source,error,revision,missing}));}
 pair(path:string):PairState|undefined{return this.list().find(p=>p.path===path);}
 forSource(path:string):PairState[]{return this.list().filter(p=>p.source===path);}
 mainFor(path:string):string|undefined{
  const pair=this.pairs.get(this.canonicalPath(path))??[...this.pairs.values()].find(p=>Object.values(p.document?.files??{}).includes(path));if(pair)return pair.source;
  const file=this.app.vault.getFileByPath(path);if(!file||!validPath(path))return;const metadata=this.app.metadataCache.getFileCache(file)?.frontmatter;
  if(metadata?.['emergence-companion-id']){const link=metadata['emergence-main-document'] as unknown;return typeof link==='string'?resolveSource(this.app,link.replace(/^\[\[/u,'').replace(/\]\]$/u,'').replace(/\.md$/u,'')+'.md',path):undefined;}
  return path;
 }
 existingFiles():TFile[]{return this.app.vault.getMarkdownFiles().filter(file=>{const metadata=this.app.metadataCache.getFileCache(file)?.frontmatter;return (this.pairs.has(file.path)||!!metadata?.['emergence-companion-id'])&&!metadata?.['emergence-parent-companion-id']&&metadata?.['emergence-companion-role']!=='section';});}
 async connect(path:string):Promise<string>{
  const document=await this.readForView(path),metadata=parseYaml(document.header) as Record<string,unknown>;if(metadata['emergence-parent-companion-id']||metadata['emergence-companion-role']==='section')throw new Error(t('companion.selectIndex'));
  const pair=this.registerPair(path,document.source);pair.document=document;pair.missing=!this.app.vault.getFileByPath(document.source);pair.error=pair.missing?t('companion.sourceMissing'):undefined;pair.revision++;this.saveSoon();this.notify();return path;
 }
 storageDefaults():StorageOptions{return companionStorageDefaults(this.settings());}
 subscribePosition(callback:(source:string,line:number)=>void):()=>void{this.positionListeners.add(callback);return()=>this.positionListeners.delete(callback);}
 position(source:string,line:number):void{if(this.positions.get(source)===line)return;this.positions.set(source,line);for(const callback of this.positionListeners)callback(source,line);}
 currentPosition(source:string):number|undefined{return this.positions.get(source)??sourceEditor(this.app,source)?.editor.getCursor().line;}
 sourceLine(path:string,id:string):number|undefined{const p=this.pairs.get(path),anchor=p?.anchors.get(id);return anchor!==undefined&&p?.liveDoc?p.liveDoc.lineAt(Math.min(anchor,p.liveDoc.length)).number-1:p?.document?.sections.find(s=>s.id===id)?.base?.line;}
 sectionAt(path:string,line:number):string|undefined{const p=this.pairs.get(path);let selected:string|undefined;for(const section of p?.document?.sections??[])if(section.state==='linked'&&section.base){const anchor=p?.anchors.get(section.id),start=anchor!==undefined&&p?.liveDoc?p.liveDoc.lineAt(Math.min(anchor,p.liveDoc.length)).number-1:section.base.line;if(start<=line)selected=section.id;else break;}return selected;}
 subscribe(callback:()=>void):()=>void{this.listeners.add(callback);return()=>this.listeners.delete(callback);}
 private notify():void{if(!this.disposed)for(const callback of this.listeners)callback();}
 private saveSoon():void{if(this.saveTimer)window.clearTimeout(this.saveTimer);this.saveTimer=window.setTimeout(()=>{this.saveTimer=undefined;void this.persist().catch(()=>{});},400);}
 private registerPair(path:string,source:string):Runtime{
  let p=this.pairs.get(path);if(!p){p={path,source,revision:0,queue:Promise.resolve(),anchors:new Map(),undo:[],redo:[],working:false};this.pairs.set(path,p);}else p.source=source;return p;
 }
 private forget(path:string):void{const pair=this.pairs.get(path);if(pair?.timer)window.clearTimeout(pair.timer);this.pairs.delete(path);this.viewModes.delete(path);for(const [key,item]of this.nativeOptions)if(item.path===path)this.nativeOptions.delete(key);this.saveSoon();}
 private discover(file:TFile,cache:CachedMetadata):void{
  if(!this.app.vault.getFileByPath(file.path)||cache.frontmatter?.['emergence-companion-role']==='section'||cache.frontmatter?.['emergence-parent-companion-id'])return;const link=cache.frontmatter?.['emergence-main-document'] as unknown;if(typeof link!=='string')return;const linked=link.replace(/^\[\[/u,'').replace(/\]\]$/u,'').replace(/\.md$/u,'')+'.md';const source=resolveSource(this.app,linked,file.path);if(validPath(source)&&source!==file.path)this.registerPair(file.path,source);
 }
 private metadata(file:TFile,data:string,cache:CachedMetadata):void{
  if(this.tracks(file.path)&&cache.headings)this.outlineCache.set(file.path,{source:data,headings:cachedOutline(data,cache.headings)});
  if(cache.frontmatter?.['emergence-companion-id'])this.discover(file,cache);
  if(!this.started||!this.enabled()||this.writing.has(file.path))return;
  for(const p of this.pairs.values())if(p.document?.files&&Object.values(p.document.files).includes(file.path)){p.revision++;this.schedule(p.path,350);this.notify();}
  const companion=this.pairs.get(file.path);if(companion){companion.revision++;this.notify();this.schedule(file.path,350);}
  for(const p of this.pairs.values())if(p.source===file.path){if(p.liveDoc?.toString()===data)continue;this.schedule(p.path,350);}
 }
 tracks(path:string):boolean{return this.enabled()&&[...this.pairs.values()].some(p=>p.source===path);}
 live(path:string,before:Text,after:Text,changes:ChangeDesc,structural:boolean):void{
  if(!this.enabled())return;this.metrics.liveEvents++;
  for(const p of this.pairs.values())if(p.source===path){
   if(p.anchorDoc?.eq(after)){p.liveDoc=after;if(structural)this.schedule(p.path,280);continue;}
   if(p.anchorDoc&&p.anchorDoc!==before&&!p.anchorDoc.eq(before))p.anchors.clear();
   if(!p.anchorDoc&&p.anchorSource!==undefined){const old=before.toString();if(p.anchorSource!==old){if(p.anchorSource.replace(/\r\n/gu,'\n')===old){const headings=sourceHeadings(old);p.anchors=new Map((p.document?.sections??[]).filter(s=>s.base&&headings[s.base.index]?.title===s.base.title).map(s=>[s.id,headings[s.base!.index]!.from]));}else p.anchors.clear();}}
   p.anchorDoc=after;mapAnchors(p.anchors,changes);p.liveDoc=after;if(structural)this.schedule(p.path,280);}
 }
 private schedule(path:string,delay:number):void{const p=this.pairs.get(path);if(!p||this.disposed||!this.enabled())return;if(p.timer)window.clearTimeout(p.timer);p.timer=window.setTimeout(()=>{p.timer=undefined;void this.sync(path).catch(()=>{});},delay);}
 private enqueue<T>(path:string,action:(p:Runtime)=>Promise<T>):Promise<T>{
  const p=this.pairs.get(path);if(!p)return Promise.reject(new Error(t('companion.fileMissing')));
  const run=p.queue.then(async()=>{if(this.disposed)throw new Error(t('companion.closed'));if(this.pairs.get(path)!==p||!this.app.vault.getFileByPath(path))throw new Error(t('companion.fileMissing'));p.working=true;const revision=p.revision,previousError=p.error;try{const result=await action(p);p.error=undefined;return result;}catch(error){p.error=error instanceof Error?error.message:String(error);throw error;}finally{p.working=false;if(p.revision!==revision||p.error!==previousError)this.notify();}});p.queue=run.then(()=>{},()=>{});return run;
 }
 async read(path:string):Promise<CompanionDocument>{return this.readWorking(path,false);}
 async readForView(path:string):Promise<CompanionDocument>{return this.readWorking(path,true);}
 private async readWorking(path:string,partial:boolean):Promise<CompanionDocument>{
  const runtime=this.pairs.get(path),revision=runtime?.revision;
  const stored=await (partial?readStoredForView(this.app,path):readStored(this.app,path)),doc=sessionThoughts(stored,runtime?.document);
  if(runtime&&runtime.revision===revision)runtime.document=doc;return doc;
 }
 async missingFiles(path:string):Promise<{title:string;path:string}[]>{
  const doc=parseCompanion(await readNote(this.app,path));readStorage(doc);if(doc.storage?.mode!=='sections')return [];
  return doc.sections.filter(section=>!doc.files?.[section.id]||!this.app.vault.getFileByPath(doc.files[section.id]!)).map(section=>({title:section.title,path:doc.files?.[section.id]??t('companion.noFileLink')}));
 }
 async missingChapters(path:string):Promise<{id:string;title:string;path:string}[]>{const doc=await this.readForView(path);return doc.sections.filter(section=>doc.unavailableFiles?.[section.id]?.reason==='missing').map(section=>({id:section.id,title:section.title,path:doc.files?.[section.id]??''}));}
 private async chapterForRepair(path:string,id:string){
  const doc=markThoughts(await this.readForView(path)),section=doc.sections.find(section=>section.id===id);
  if(doc.storage?.mode!=='sections'||!section)throw new Error(t('companion.invalid'));
  const issue=doc.unavailableFiles?.[id];if(!issue)throw new Error(t('companion.chapterAlreadyAvailable'));return {doc,section,issue};
 }
 private checkChapterTarget(doc:CompanionDocument,index:string,id:string,target:string):void{
  if(!validPath(target)||target===index||target===doc.source||[...this.pairs.values()].some(pair=>pair.source===target)||Object.entries(doc.files??{}).some(([other,path])=>other!==id&&path===target))throw new Error(t('companion.chapterFileBelongsElsewhere'));
 }
 async prepareChapterFile(path:string,id:string,target:string):Promise<ChapterFilePlan>{
  path=this.canonicalPath(path);const {doc,section}=await this.chapterForRepair(path,id);this.checkChapterTarget(doc,path,id,target);
  return prepareChapter(path,doc,section,target,await readNote(this.app,target));
 }
 useChapterFile(plan:ChapterFilePlan):Promise<void>{return this.enqueue(plan.index,async p=>{
  const {doc,section}=await this.chapterForRepair(p.path,plan.section);this.checkChapterTarget(doc,p.path,plan.section,plan.path);
  if(await readNote(this.app,plan.path)!==plan.before)throw new Error(t('companion.conflict'));
  const current=prepareChapter(p.path,doc,section,plan.path,plan.before),part=parseCompanion(current.after);section.raw=part.sections[0]!.raw;section.format=part.sections[0]!.format;section.plain=part.sections[0]!.plain;
  doc.files![section.id]=plan.path;doc.fileOriginals![plan.path]=current.after;delete doc.unavailableFiles![section.id];
  const marked=markThoughts(doc);validateThoughts(marked);const writes:FileWrite[]=current.kind==='existing'?[]:[{path:plan.path,before:plan.before,after:current.after,kind:'adopt-chapter'}];
  await this.commit(p,doc.original,marked,writes);p.undo=[];p.redo=[];
 });}
 createChapterFile(path:string,id:string):Promise<void>{return this.enqueue(path,async p=>{
  const {doc,section,issue}=await this.chapterForRepair(p.path,id);if(issue.reason!=='missing')throw new Error(t('companion.invalid'));
  const member=doc.files?.[id]??freePath(this.app,targetFolder(doc.source,doc.storage!),doc.source.split('/').at(-1)!.replace(/\.md$/u,'')+' – '+section.title,new Set(Object.values(doc.files??{})));
  this.checkChapterTarget(doc,p.path,id,member);if(this.app.vault.getAbstractFileByPath(member))throw new Error(t('companion.chapterAlreadyAvailable'));
  await ensureFolder(this.app,member.split('/').slice(0,-1).join('/'));section.raw='';section.format=2;doc.files![id]=member;delete doc.unavailableFiles![id];
  await this.commit(p,doc.original,doc);p.undo=[];p.redo=[];
 });}
 private async commit(p:Runtime,_before:string,doc:CompanionDocument,first:FileWrite[]=[]):Promise<void>{
  if(doc.storage?.location==='folder')await ensureFolder(this.app,doc.storage.folder);
  const plan=[...first,...planStorage(this.app,p.path,doc)];for(const item of plan)this.writing.add(item.path);
  try{await this.transactions.apply(p.path,plan);if(plan.length){this.metrics.writes+=plan.length;p.revision++;}p.document=sessionThoughts(await readStoredForView(this.app,p.path),doc);p.source=doc.source;}finally{for(const item of plan)this.writing.delete(item.path);}
 }
 recoveryPlan(path:string):unknown{return structuredClone(this.transactions.pending.get(path));}
 acceptRecovery(path:string):Promise<void>{return this.enqueue(path,async p=>{await this.transactions.accept(path,async()=>{await this.read(path);});p.revision++;});}
 recover(path:string):Promise<void>{return this.enqueue(path,async p=>{await this.transactions.recover(path);p.revision++;});}

 sync(path:string):Promise<void>{const runtime=this.pairs.get(path);if(runtime?.relocation)return runtime.relocation;return this.enqueue(path,async p=>{
  if(!this.enabled())return;const doc=await this.readForView(path);p.source=doc.source;
  if(!this.app.vault.getFileByPath(doc.source)){p.missing=true;throw new Error(t('companion.sourceMissing'));}p.missing=false;
  const source=await readNote(this.app,doc.source);this.metrics.sourceAnalyses++;
  const cached=this.outlineCache.get(doc.source),native=liveOutline(this.app,doc.source,source),headings=native??(cached?.source===source?cached.headings:undefined);p.outlineSource=native?'editor':headings?'cache':'fallback';
  const result=reconcile(doc,source,p.liveDoc?.toString()===source&&p.anchors.size?p.anchors:undefined,headings);p.anchorSource=source;p.anchorDoc=p.liveDoc?.toString()===source?p.liveDoc:undefined;p.anchors=new Map(result.document.sections.filter(s=>s.state==='linked'&&s.base).map(s=>[s.id,s.base!.from]));
  const marked=markThoughts(result.document),newMarkers=marked.sections.some((s,i)=>s.raw!==result.document.sections[i]?.raw);
  if(result.changed||newMarkers||needsCompanionCleanup(doc)||doc.storageDrift)await this.commit(p,doc.original,marked);else p.document=result.document;
 }).then(async()=>{
  const p=runtime;if(!p||!p.document?.storage||p.document.storage.location==='folder'||p.path.split('/').slice(0,-1).join('/')===targetFolder(p.source,p.document.storage))return;
  if(p.relocation)return p.relocation;
  p.relocation=this.relocate(p);try{await p.relocation;p.error=undefined;}catch(error){p.error=String(error);throw error;}finally{p.relocation=undefined;this.notify();}
 });}
 async create(source:string,options:StorageOptions=this.storageDefaults()):Promise<string>{
  const previous=this.creating.get(source)??Promise.resolve(),run=previous.catch(()=>{}).then(()=>this.createDocument(source,options));this.creating.set(source,run);try{return await run;}finally{if(this.creating.get(source)===run)this.creating.delete(source);}
 }
 private async createDocument(source:string,options:StorageOptions):Promise<string>{
  if(!validStorage(options))throw new Error(t('companion.invalidStorage'));
  const file=this.app.vault.getFileByPath(source);
  if(!validPath(source)||!file||this.pairs.has(source)||this.app.metadataCache.getFileCache(file)?.frontmatter?.['emergence-companion-id'])throw new Error(t('companion.invalidSource'));
  const text=await readNote(this.app,source),doc=reconcile(emptyCompanion(source),text).document;for(const section of doc.sections)section.format=2;doc.storage=storageOptions(options);doc.files={};
  if(!doc.sections.length)doc.sections.push({id:newId(),title:t('companion.general'),level:1,state:'general',raw:'\n',format:2});
  const folder=targetFolder(source,doc.storage);await ensureFolder(this.app,folder);const path=freePath(this.app,folder,source.split('/').at(-1)!.replace(/\.md$/u,'')+' – '+t('companion.title'));
  if(this.pairs.has(path))this.forget(path);
  const plan=planStorage(this.app,path,doc).map(w=>w.path===path?{...w,before:null}:w);await this.transactions.apply(path,plan);this.registerPair(path,source);await this.persist();
  // Creation is complete. A later reconciliation error belongs to the newly selected file.
  await this.sync(path).catch(error=>{if(!this.app.vault.getFileByPath(path))throw error;});return path;
 }
 normalize(path:string):Promise<void>{return this.enqueue(path,async p=>{const doc=await this.readForView(path),marked=markThoughts(doc);if(needsCompanionCleanup(doc))await this.commit(p,doc.original,marked);});}
 execute(path:string,operation:ThoughtOperation,history=true):Promise<void>{return this.enqueue(path,async p=>{
  const doc=markThoughts(await this.readForView(path)),result=applyThought(doc,operation);await this.commit(p,doc.original,result.document);
  if(history){const inverse=this.inverse(result);if(inverse)p.undo.push(inverse);p.redo=[];if(p.undo.length>100)p.undo.shift();}
 });}
 executeMany(path:string,operations:ThoughtOperation[]):Promise<void>{return this.enqueue(path,async p=>{
  let doc=markThoughts(await this.readForView(path));const inverse:HistoryAction[]=[];for(const operation of operations){const result=applyThought(doc,operation);doc=result.document;const action=this.inverse(result);if(action)inverse.unshift(action);}await this.commit(p,doc.original,doc);if(inverse.length)p.undo.push({batch:inverse});p.redo=[];if(p.undo.length>100)p.undo.shift();
 });}
 private applyHistory(doc:CompanionDocument,action:HistoryAction):{document:CompanionDocument;inverse?:HistoryAction}{
  if('batch'in action){const inverses:HistoryAction[]=[];for(const step of action.batch){const result=this.applyHistory(doc,step);doc=result.document;if(result.inverse)inverses.unshift(result.inverse);}return {document:doc,inverse:{batch:inverses}};}
  const result='operation'in action?applyThought(doc,action.operation):restoreThought(doc,action.restore);return {document:result.document,inverse:this.inverse(result)};
 }
 private inverse(result:OperationResult):HistoryAction|undefined{return result.inverse?{operation:result.inverse}:result.restore?{restore:result.restore}:undefined;}
 history(path:string,redo=false):Promise<void>{return this.enqueue(path,async p=>{
  const from=redo?p.redo:p.undo,to=redo?p.undo:p.redo,action=from[from.length-1];if(!action)return;
  const doc=markThoughts(await this.readForView(path)),result=this.applyHistory(doc,action);await this.commit(p,doc.original,result.document);from.pop();const inverse=result.inverse;if(inverse)to.push(inverse);
 });}
 needsRecovery(path:string):boolean{return this.transactions.pending.has(path);}
 canUndo(path:string):boolean{return !!this.pairs.get(path)?.undo.length;}
 canRedo(path:string):boolean{return !!this.pairs.get(path)?.redo.length;}
 resolve(path:string,sectionId:string,targetId?:string):Promise<void>{return this.enqueue(path,async p=>{
  const doc=markThoughts(await this.readForView(path)),old=doc.sections.find(s=>s.id===sectionId);if(doc.unavailableFiles?.[sectionId]||targetId&&doc.unavailableFiles?.[targetId])throw new Error(t('companion.sectionFileMissing'));if(!old)throw new Error(t('companion.targetMissing'));
  if(targetId){const target=doc.sections.find(s=>s.id===targetId&&s.state==='linked');if(!target||target===old)throw new Error(t('companion.targetMissing'));old.title=target.title;old.level=target.level;old.base=target.base;old.state='linked';old.raw=old.raw+(old.raw.endsWith('\n')?'':doc.newline)+target.raw;doc.sections=doc.sections.flatMap(s=>s===old?[]:s===target?[old]:[s]);}
  else old.state='detached';await this.commit(p,doc.original,doc);
 });}
 rebind(path:string,source:string):Promise<void>{return this.enqueue(path,async p=>{if(!validPath(source)||source===path||this.pairs.has(source))throw new Error(t('companion.invalidSource'));await readNote(this.app,source);const doc=await this.readForView(path);doc.source=source;for(const section of doc.sections)if(section.state==='linked')section.state='review';await this.commit(p,doc.original,doc);this.saveSoon();});}
 canonicalPath(path:string):string{const seen=new Set<string>();while(this.moved.has(path)&&!seen.has(path)){seen.add(path);path=this.moved.get(path)!;}return path;}
 private async rename(oldPath:string,newPath:string):Promise<void>{
  this.transactions.rename(oldPath,newPath);
  for(const p of [...this.pairs.values()]){
   const affected=(path:string)=>path===oldPath||path.startsWith(oldPath+'/'),sourceIsNew=p.source===newPath||p.source.startsWith(newPath+'/');if(!sourceIsNew&&!affected(p.path)&&!affected(p.source)&&!Object.values(p.document?.files??{}).some(affected)&&!(p.document?.storage?.folder&&affected(p.document.storage.folder)))continue;
   const path=renamedPath(p.path,oldPath,newPath);if(path!==p.path){if(p.timer)window.clearTimeout(p.timer);this.moved.set(p.path,path);this.pairs.delete(p.path);p.path=path;this.pairs.set(path,p);}
   await this.enqueue(p.path,async pair=>{
    const index=parseCompanion(await readNote(this.app,pair.path));readStorage(index);const before=index.original;
    index.source=renamedPath(resolveSource(this.app,index.source,pair.path),oldPath,newPath);if(index.storage?.location==='folder')index.storage.folder=renamedPath(index.storage.folder,oldPath,newPath);
    for(const [id,file]of Object.entries(index.files??{})){const next=renamedPath(file,oldPath,newPath);index.files![id]=next;if(file!==next)for(const section of index.sections)section.raw=section.raw.replaceAll('[['+file.replace(/\.md$/u,'')+']]', '[['+next.replace(/\.md$/u,'')+']]');}
    storageHeader(index);const after=serializeCompanion(index);this.writing.add(pair.path);try{await this.transactions.apply(pair.path,[{path:pair.path,before,after}].filter(w=>w.before!==w.after));}finally{this.writing.delete(pair.path);}
    pair.source=index.source;const doc=await readStoredForView(this.app,pair.path);await this.commit(pair,doc.original,doc);pair.revision++;
   }).catch(()=>{});
   this.schedule(p.path,0);
  }
  for(const [path,mode]of [...this.viewModes]){const next=this.canonicalPath(renamedPath(path,oldPath,newPath));if(path!==next){this.viewModes.delete(path);this.viewModes.set(next,mode);}}const options=[...this.nativeOptions.values()];this.nativeOptions.clear();for(const item of options){item.path=this.canonicalPath(renamedPath(item.path,oldPath,newPath));this.nativeOptions.set(this.nativeKey(item.path,item.section,item.kind),item);}this.saveSoon();this.notify();
 }
 private async relocate(pair:Runtime):Promise<void>{
  const folder=targetFolder(pair.source,pair.document?.storage??storageOptions(undefined));await ensureFolder(this.app,folder);
  const paths=[...Object.values(pair.document?.files??{}),pair.path];
  for(const old of paths){if(old.split('/').slice(0,-1).join('/')===folder)continue;const file=this.app.vault.getFileByPath(old);if(!file)continue;const target=freePath(this.app,folder,old.split('/').at(-1)!.replace(/\.md$/u,''));await this.app.fileManager.renameFile(file,target);await this.rename(old,target);}
 }

 async flush():Promise<void>{for(const p of this.pairs.values()){if(p.relocation)await p.relocation.catch(()=>{});if(p.timer){window.clearTimeout(p.timer);p.timer=undefined;await this.sync(p.path).catch(()=>{});}await p.queue;}if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=undefined;await this.persist();}}
}
