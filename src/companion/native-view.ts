import {Component,parseYaml,stringifyYaml,type App,type WorkspaceLeaf} from 'obsidian';
import {t} from '../i18n';
import {nativeSelection} from './native-selection';
import {projectionFromBody,splitProjection,nativeBodiesEqual,sectionOutline,validateNativeProjection} from './native-projection';
import {watchEditorViewport} from './editor-viewport';
import {applyNativeAppearance} from './native-appearance';
import {presentationHeader} from './presentation';
import {sizeNativeViewport} from './native-layout';
import {adaptLineage,lineageOutline,lineageDocument,type LineageSession,type LineageDocument} from './lineage-adapter';
import {hostedNativeView} from './hosted-view';
import {nativeFileScope,scopedNativePlugin} from './native-sandbox';
import {nativePlugins,type NativeKind,type NativeRuntimeApp,type NativeView} from './native-types';
import type {CompanionDocument,CompanionSection} from './model';
import type {CompanionService} from './service';
import {settleSteps} from '../cleanup';
import {errorMessage} from '../util';
import {rejectedChangeMessage} from './write-error';
import {assertNativeCompatible,assertNativePluginCompatible,NativeCompatibilityError} from './native-compatibility';

export class NativeCompanionView extends Component{
 private view?:NativeView;private key='';private generation=0;private session=0;private scopeText='';private base='';private path='';private section='';private kind?:NativeKind;private writes:Promise<void>=Promise.resolve();private writeCount=0;private closing?:Promise<void>;private shuttingDown?:Promise<void>;private error?:HTMLElement;private resize?:ResizeObserver;private appearance?:MutationObserver;private restoreScope?:()=>void;private editorText?:()=>string|undefined;private finishEditor?:()=>void;private cancelEditor?:()=>void;private failure?:Error;private rejecting?:Promise<void>;private writeEpoch=0;private mounting?:Promise<void>;
 constructor(private app:App,readonly host:HTMLElement,private service:CompanionService,private leaf:WorkspaceLeaf,private openMarkdown:()=>void,private refresh:()=>Promise<void>=async()=>{}){super();host.addClass('em-companion-native');this.registerEvent(app.workspace.on('css-change',()=>{if(this.view)applyNativeAppearance(this.view,this.host);}));this.register(()=>{void settleSteps([()=>this.shutdown(),()=>this.service.flush()]).then(errors=>{if(errors.length)this.showError(new AggregateError(errors,t('companion.closeFailed')));});});}
 get editing():boolean{return !!this.view?.inlineEditor?.nodeId||!!this.host.querySelector('.node-editor-host,.editing .cm-editor');}
 get pending():boolean{return this.editing||this.writeCount>0||!!this.rejecting||!!this.mounting;}
 focus():void{const target=this.host.querySelector<HTMLElement>(this.kind==='lineage'?'.lineage-view':'.mindmap-wrapper')??this.host.querySelector<HTMLElement>('button,.em-companion-native-error');if(target){if(!target.hasAttribute('tabindex')&&target.tabIndex<0)target.tabIndex=-1;target.focus({preventScroll:true});}}
 available(kind:NativeKind):boolean{const runtime=this.app as NativeRuntimeApp,plugin=nativePlugins[kind];return !!runtime.plugins.plugins[plugin.id]&&typeof runtime.viewRegistry.getViewCreatorByType(plugin.type)==='function';}
 installed(kind:NativeKind):boolean{return !!(this.app as NativeRuntimeApp).plugins.manifests[nativePlugins[kind].id];}
 async render(path:string,document:CompanionDocument,section:CompanionSection,kind:NativeKind):Promise<void>{
  if(this.shuttingDown){await this.shuttingDown.catch(()=>{});return;}
  const key=JSON.stringify([path,section.id,kind]);
  if(this.key===key&&this.view&&!this.closing&&!this.shuttingDown){
   const generation=this.generation;if(this.mounting)await this.mounting;if(generation!==this.generation||this.key!==key||!this.view)return;
   if(this.view.file)this.view.file.basename=section.title;if(!this.writeCount&&!this.editing&&this.base!==section.raw){this.base=section.raw;this.scopeText=projectionFromBody(sectionOutline(section),splitProjection(this.scopeText).header);if(kind==='eome'){this.view.commandHistory?.clear?.();this.view.forceToolbarUpdate?.();}this.view.setViewData(this.scopeText,false);}return;
  }
  const generation=++this.generation;await this.close(false);if(generation!==this.generation)return;
  // Publish the promise before constructing the original view, so lifecycle events can wait for it.
  const mounting=Promise.resolve().then(()=>this.mount(path,document,section,kind,key,generation));this.mounting=mounting;
  try{await mounting;}finally{if(this.mounting===mounting)this.mounting=undefined;}
 }
 private async mount(path:string,document:CompanionDocument,section:CompanionSection,kind:NativeKind,key:string,generation:number):Promise<void>{
  if(generation!==this.generation)return;this.key=key;this.path=path;this.section=section.id;this.kind=kind;this.failure=undefined;this.host.empty();this.error=this.host.createDiv({cls:'em-companion-native-error em-error',attr:{role:'status'}});
  if(!this.available(kind)){const plugin=nativePlugins[kind];this.error.setText(t(this.installed(kind)?'companion.pluginDisabled':'companion.pluginMissing',{name:plugin.name}));if(this.installed(kind)){const enable=this.host.createEl('button',{text:t('companion.enablePlugin',{name:plugin.name})});enable.onclick=()=>{enable.disabled=true;void (this.app as NativeRuntimeApp).plugins.enablePluginAndSave(plugin.id).then(()=>{this.key='';return this.render(path,document,section,kind);}).catch((error:unknown)=>{this.error?.setText(String(error));enable.disabled=false;});};}return;}
  if(kind==='eome'){const manifest=(this.app as NativeRuntimeApp).plugins.manifests[nativePlugins.eome.id] as {version?:string},version=manifest.version?.split('.').map(Number)??[];if(!(version[0]!>0||version[1]!>2||version[1]===2&&version[2]!>=3)){this.error.setText(t('companion.eomeUpdate'));return;}}
  const original=this.app.vault.getFileByPath(document.files?.[section.id]??path);if(!original)throw new Error(t('companion.sectionFileMissing'));this.base=section.raw;const style=getComputedStyle(this.host),header=presentationHeader(this.service.nativeHeader(path,section.id,kind),kind,this.host.clientWidth,Number.parseFloat(style.fontSize)||14,Number.parseFloat(style.getPropertyValue('--font-text-size'))||16);this.service.saveNativeHeader(path,section.id,kind,header);this.scopeText=projectionFromBody(sectionOutline(section),header);
  const stage=this.host.createDiv({cls:'em-companion-native-stage'}),virtualPath=[original.parent?.path??'',`Emergence ${document.id} ${section.id} ${kind}.md`].filter(Boolean).join('/'),session=++this.session;let sessionText=this.scopeText;const scope=nativeFileScope(this.app,this.leaf,stage,original,virtualPath,section.title,nativePlugins[kind].type,()=>session===this.session?this.scopeText:sessionText,async text=>{if(session!==this.session)throw new Error(t('companion.closed'));sessionText=text;await this.write(text);},this.openMarkdown);
  this.restoreScope=()=>scope.restore();this.editorText=()=>scope.editorText();this.finishEditor=()=>scope.finishEditor();this.cancelEditor=()=>scope.cancelEditor();try{
   const runtime=this.app as NativeRuntimeApp,plugin=runtime.plugins.plugins[nativePlugins[kind].id]!,factory=runtime.viewRegistry.getViewCreatorByType(nativePlugins[kind].type);if(!factory)throw new Error(t('companion.pluginMissing',{name:nativePlugins[kind].name}));
   const manifest=runtime.plugins.manifests[nativePlugins[kind].id] as {version?:string}|undefined;assertNativePluginCompatible(plugin,kind,manifest?.version);
   const nativePlugin=kind==='lineage'?scopedNativePlugin(plugin,scope.app,kind,scope.file,splitProjection(this.scopeText).header,this.host.createDiv({cls:'em-companion-native-status'})):plugin;let lineage:LineageSession|undefined;const view=this.view=hostedNativeView(factory,scope.leaf,nativePlugin,kind,{active:()=>session===this.session,write:text=>this.write(text),error:error=>this.showError(error),saveLineage:()=>lineage?.save()??Promise.resolve()});
   assertNativeCompatible(view,kind,manifest?.version);
   stage.append(view.containerEl);view.containerEl.dataset.type=nativePlugins[kind].type;stage.style.setProperty('--em-native-height',stage.clientHeight+'px');stage.style.setProperty('--em-native-width',stage.clientWidth+'px');scope.setView(view);view.app=scope.app;if(view.frontmatterStorage)view.frontmatterStorage.app=scope.app;if(view.commandHistory)view.commandHistory.app=scope.app;if(kind==='lineage')lineage=adaptLineage(view,()=>this.scopeText,error=>this.showError(error));
   const owns=()=>generation===this.generation&&this.view===view&&session===this.session;
   if(kind==='lineage')stage.inert=true;view.load();view.file=null;view.data=this.scopeText;await view.onOpen();if(!owns())return;view.file=scope.file;
   if(kind==='eome'){
    this.appearance=new MutationObserver(()=>{if(owns()&&view.cy&&stage.querySelector('.mindmap-overlay[data-overlay]')){this.appearance?.disconnect();applyNativeAppearance(view,this.host);sizeNativeViewport(view,stage,true);}});this.appearance.observe(stage,{childList:true,subtree:true});await view.onLoadFile?.(scope.file);if(!owns())return;watchEditorViewport(view,stage);
   }
   if(kind==='lineage'){
    view.data=this.scopeText;view.setViewData(this.scopeText,false);for(let n=0;n<180&&!view.component&&owns();n++)await new Promise<void>(resolve=>window.setTimeout(resolve,16));if(!owns())return;if(!view.component)throw new Error(t('companion.nativeUnavailable'));await new Promise<void>(resolve=>window.setTimeout(resolve,32));if(!owns())return;stage.inert=false;sizeNativeViewport(view,stage,true);view.alignBranch?.align({type:'view/life-cycle/mount'});
   }
   applyNativeAppearance(view,this.host);if(kind==='eome')sizeNativeViewport(view,stage,true);
   if(!stage.contains(view.containerEl))stage.append(view.containerEl);view.containerEl.dataset.type=nativePlugins[kind].type;
   const selectedId=this.service.selectedThought(path,section.id);if(selectedId)nativeSelection(view,kind,section,selectedId);
   this.resize=new ResizeObserver(()=>{sizeNativeViewport(view,stage);});this.resize.observe(stage);
  }catch(error){if(generation!==this.generation||session!==this.session)return;stage.inert=false;await settleSteps([()=>this.disposeView()]);this.error?.setText(error instanceof Error?error.message:String(error));if(error instanceof NativeCompatibilityError){const open=this.error?.createEl('button',{text:t('companion.openSource')});if(open)open.onclick=()=>this.openMarkdown();}}
 }
 reports(error:unknown):boolean{return this.failure===error;}
 private write(text:string):Promise<void>{
  this.writeCount++;const epoch=this.writeEpoch,run=this.writes.then(async()=>{
   if(epoch!==this.writeEpoch)throw this.failure??new Error(t('companion.closed'));const kind=this.kind;if(!kind)throw new Error(t('companion.closed'));const expected=this.base;this.scopeText=text;
   if(!this.available(kind))throw new Error(t('companion.nativeUnavailable'));validateNativeProjection(text);const raw=nativeBodiesEqual(expected,text)?expected:await this.service.replaceNativeSection(this.path,this.section,expected,text);this.base=raw;this.service.saveNativeHeader(this.path,this.section,kind,splitProjection(text).header);this.failure=undefined;this.error?.empty();
  });
  this.writes=run.catch(async error=>{if(epoch===this.writeEpoch)await this.rejectEdit(error);}).finally(()=>{this.writeCount--;});return run;
 }
 private showError(error:unknown):void{if(error!==this.failure)this.error?.setText(errorMessage(error));}
 /** Reject the mutation, cancel the original editor and reload the actual file through its normal API. */
 private rejectEdit(error:unknown):Promise<void>{
  if(this.rejecting)return this.rejecting;this.failure=error instanceof Error?error:new Error(errorMessage(error));this.writeEpoch++;const view=this.view,path=this.path,id=this.section,kind=this.kind,session=this.session,stage=this.host.querySelector<HTMLElement>('.em-companion-native-stage');if(stage)stage.inert=true;
  this.rejecting=(async()=>{
   // Let the original command's failed save finish before asking its editor to cancel.
   await new Promise<void>(resolve=>window.setTimeout(resolve,0));
   if(this.session!==session||this.view!==view||this.path!==path)return;
   try{
    if(view?.inlineEditor?.nodeId){view.inlineEditor.unloadNode(undefined,true);view.viewStore?.dispatch({type:'view/editor/disable-main-editor'});}this.cancelEditor?.();
    const document=await this.service.readForView(path);if(this.session!==session||this.view!==view||this.path!==path)return;const section=document.sections.find(section=>section.id===id);if(!section||document.unavailableFiles?.[section.id])throw new Error(t('companion.sectionFileMissing'));
    this.base=section.raw;this.scopeText=projectionFromBody(sectionOutline(section),kind?this.service.nativeHeader(path,id,kind):'');
    if(view===this.view){
     if(kind==='eome'&&view){
      // EOME may already have released its focused owner while retaining an editor host.
      // Its public lifecycle closes every transient editor, including a failed save session.
      await view.onClose();if(this.session!==session||this.view!==view||this.path!==path)return;await view.onOpen();if(this.session!==session||this.view!==view||this.path!==path)return;
      view.commandHistory?.clear?.();view.forceToolbarUpdate?.();if(stage){applyNativeAppearance(view,this.host);sizeNativeViewport(view,stage,true);}
     }
     view?.setViewData(this.scopeText,true);await this.waitForContent(view);
    }
    this.error?.setText(rejectedChangeMessage(error));
   }catch(readError){
    await settleSteps([()=>this.disposeView()]);this.error?.setText(t('companion.readerReadError',{reason:errorMessage(readError)}));const retry=this.error?.createEl('button',{text:t('companion.retry')});if(retry)retry.onclick=()=>{this.key='';void this.refresh();};
   }finally{if(stage)stage.inert=false;}
  })().finally(()=>{this.rejecting=undefined;});return this.rejecting;
 }
 private async waitForContent(view:NativeView|undefined):Promise<void>{
  if(this.kind!=='lineage'||!view?.documentStore)return;const expected=lineageOutline(lineageDocument(splitProjection(this.scopeText).body));
  for(let n=0;n<120;n++){if(lineageOutline(view.documentStore.getValue().document as LineageDocument)===expected)return;await new Promise<void>(resolve=>window.setTimeout(resolve,25));}
  throw new Error(t('companion.nativeUnavailable'));
 }
 async rememberSelection():Promise<void>{const view=this.view,kind=this.kind,path=this.path,session=this.session;if(!view||!kind||!path)return;const document=await this.service.readForView(path);if(this.view!==view||this.kind!==kind||this.path!==path||this.session!==session)return;const section=document.sections.find(section=>section.id===this.section);if(section){const id=nativeSelection(view,kind,section);if(id)this.service.selectThought(path,section.id,id);}}
 async history(redo=false):Promise<void>{await this.flush();if(this.kind==='eome')await (redo?this.view?.executeRedo?.():this.view?.executeUndo?.());else this.view?.documentStore?.dispatch({type:redo?'document/history/select-next-snapshot':'document/history/select-previous-snapshot'});await this.writes;}
 async flush():Promise<void>{
  if(this.mounting)await this.mounting;
  if(this.rejecting){await this.rejecting;if(this.failure)throw this.failure;}
  if(this.failure&&!this.editing&&!this.writeCount)return;
  try{
   if(this.view?.inlineEditor?.nodeId){this.view.inlineEditor.unloadNode();this.view.viewStore?.dispatch({type:'view/editor/disable-main-editor'});}
   else if(this.editing){this.finishEditor?.();this.host.querySelector<HTMLElement>('.node-editor-host .cm-content')?.blur();for(let n=0;n<400&&this.editing;n++)await new Promise<void>(resolve=>window.setTimeout(resolve,25));if(this.editing)throw new Error(t('companion.nativeConflict'));}
   if(this.view?.saveDocument)await this.view.saveDocument();await this.writes;if(this.failure)throw this.failure;
  }catch(error){if(error!==this.failure)await this.rejectEdit(error);else await this.rejecting;throw this.failure??error;}
 }
 /** Retire an unavailable file without trying to write to it or recreating it. */
 async retire(invalidate=true):Promise<void>{
  if(invalidate)this.generation++;this.session++;const mounting=this.mounting,previous=this.closing;
  return this.trackClosing((async()=>{
   if(mounting)await mounting.catch(()=>{});if(previous)await previous.catch(()=>{});await this.writes;await this.rejecting;try{await this.disposeView();}finally{this.host.empty();this.error=undefined;this.key='';this.kind=undefined;this.path='';}
  })());
 }
 async close(invalidate=true):Promise<void>{
  if(invalidate)this.generation++;if(this.mounting)await this.mounting.catch(()=>{});if(this.closing)return this.closing;if(this.path&&!this.app.vault.getFileByPath(this.path))return this.retire(false);
  return this.trackClosing((async()=>{await this.flush();await this.disposeView();await this.writes;this.session++;this.key='';this.kind=undefined;})());
 }
 private trackClosing(task:Promise<void>):Promise<void>{const closing=task.finally(()=>{if(this.closing===closing)this.closing=undefined;});this.closing=closing;return closing;}
 /** Always release the editor; failed changes are rejected, never saved as a second document. */
 shutdown():Promise<void>{
  if(this.shuttingDown)return this.shuttingDown;this.generation++;const previous=this.closing,mounting=this.mounting;
  const task=(async()=>{
   const errors:unknown[]=[];try{if(mounting)await mounting.catch(()=>{});await previous;if(this.view&&this.app.vault.getFileByPath(this.path))await this.flush();}catch(error){errors.push(error);}
   this.session++;errors.push(...await settleSteps([()=>this.disposeView(),()=>this.writes]));this.error=undefined;this.key='';this.kind=undefined;this.path='';this.section='';this.scopeText='';this.base='';this.host.empty();
   if(errors.length)throw new AggregateError(errors,t('companion.closeFailed'));
  })();const shuttingDown=task.finally(()=>{if(this.closing===shuttingDown)this.closing=undefined;if(this.shuttingDown===shuttingDown)this.shuttingDown=undefined;});this.shuttingDown=shuttingDown;this.closing=shuttingDown;return shuttingDown;
 }
 private async disposeView():Promise<void>{
  const view=this.view,resize=this.resize,appearance=this.appearance,restore=this.restoreScope;
  this.view=undefined;this.resize=undefined;this.appearance=undefined;this.restoreScope=undefined;this.editorText=undefined;this.finishEditor=undefined;this.cancelEditor=undefined;
  const errors=await settleSteps([
   ()=>resize?.disconnect(),()=>appearance?.disconnect(),
   ()=>{if(this.kind==='lineage'&&view?.plugin?.settings&&view.file&&this.app.vault.getFileByPath(this.path)){const value=view.plugin.settings.getValue(),parsed:unknown=parseYaml(splitProjection(this.scopeText).header),header=parsed&&typeof parsed==='object'?parsed as Record<string,unknown>:{},documents=value.documents as Record<string,unknown>|undefined;header['emergence-lineage-view']={view:value.view,document:documents?.[view.file.path]};this.service.saveNativeHeader(this.path,this.section,'lineage',stringifyYaml(header));}},
   ()=>view?.onClose?.(),()=>view?.unload?.(),()=>view?.containerEl?.remove?.(),()=>restore?.(),
  ]);
  if(errors.length)throw new AggregateError(errors,t('companion.closeFailed'));
 }
}
