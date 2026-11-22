import {Component,parseYaml,stringifyYaml,type App,type WorkspaceLeaf} from 'obsidian';
import {t} from '../i18n';
import {projectionFromBody,splitProjection,nativeBodiesEqual,sectionOutline,validateNativeProjection} from './native-projection';
import {watchEditorViewport} from './editor-viewport';
import {applyNativeAppearance} from './native-appearance';
import {presentationHeader} from './presentation';
import {encodeOutlineText} from './multiline';
import {sizeNativeViewport} from './native-layout';
import {adaptLineage,type LineageSession} from './lineage-adapter';
import {hostedNativeView} from './hosted-view';
import {nativeFileScope,scopedNativePlugin} from './native-sandbox';
import {nativePlugins,type NativeKind,type NativeRuntimeApp,type NativeView} from './native-types';
import type {CompanionDocument,CompanionSection} from './model';
import type {CompanionService} from './service';
import {settleSteps} from '../cleanup';
import type {NativeDraft} from './native-types';
import {assertNativeCompatible,assertNativePluginCompatible,NativeCompatibilityError} from './native-compatibility';

export class NativeCompanionView extends Component{
 private view?:NativeView;private key='';private generation=0;private session=0;private scopeText='';private base='';private path='';private section='';private kind?:NativeKind;private writes:Promise<void>=Promise.resolve();private writeCount=0;private closing?:Promise<void>;private shuttingDown?:Promise<void>;private error?:HTMLElement;private resize?:ResizeObserver;private appearance?:MutationObserver;private restoreScope?:()=>void;private editorText?:()=>string|undefined;private finishEditor?:()=>void;
 constructor(private app:App,readonly host:HTMLElement,private service:CompanionService,private leaf:WorkspaceLeaf,private openMarkdown:()=>void){super();host.addClass('em-companion-native');this.registerEvent(app.workspace.on('css-change',()=>{if(this.view)applyNativeAppearance(this.view,this.host);}));this.register(()=>{void settleSteps([()=>this.shutdown(),()=>this.service.flush()]).then(errors=>{if(errors.length)this.showError(new AggregateError(errors,t('companion.closeFailed')));});});}
 get editing():boolean{return !!this.view?.inlineEditor?.nodeId||!!this.host.querySelector('.node-editor-host,.editing .cm-editor');}
 available(kind:NativeKind):boolean{const runtime=this.app as NativeRuntimeApp,plugin=nativePlugins[kind];return !!runtime.plugins.plugins[plugin.id]&&typeof runtime.viewRegistry.getViewCreatorByType(plugin.type)==='function';}
 installed(kind:NativeKind):boolean{return !!(this.app as NativeRuntimeApp).plugins.manifests[nativePlugins[kind].id];}
 async render(path:string,document:CompanionDocument,section:CompanionSection,kind:NativeKind):Promise<void>{
  const key=JSON.stringify([path,section.id,kind]);if(this.key===key&&this.view){if(this.view.file)this.view.file.basename=section.title;if(!this.writeCount&&!this.editing&&this.base!==section.raw){this.base=section.raw;this.scopeText=projectionFromBody(sectionOutline(section),splitProjection(this.scopeText).header);this.view.data=this.scopeText;this.view.setViewData(this.scopeText,false);}return;}
  const generation=++this.generation;await this.close(false);if(generation!==this.generation)return;this.key=key;this.path=path;this.section=section.id;this.kind=kind;this.host.empty();this.error=this.host.createDiv({cls:'em-companion-native-error em-error',attr:{role:'status'}});
  if(!this.available(kind)){const plugin=nativePlugins[kind];this.error.setText(t(this.installed(kind)?'companion.pluginDisabled':'companion.pluginMissing',{name:plugin.name}));if(this.installed(kind)){const enable=this.host.createEl('button',{text:t('companion.enablePlugin',{name:plugin.name})});enable.onclick=()=>{enable.disabled=true;void (this.app as NativeRuntimeApp).plugins.enablePluginAndSave(plugin.id).then(()=>{this.key='';return this.render(path,document,section,kind);}).catch((error:unknown)=>{this.error?.setText(String(error));enable.disabled=false;});};}return;}
  if(kind==='eome'){const manifest=(this.app as NativeRuntimeApp).plugins.manifests[nativePlugins.eome.id] as {version?:string},version=manifest.version?.split('.').map(Number)??[];if(!(version[0]!>0||version[1]!>2||version[1]===2&&version[2]!>=3)){this.error.setText(t('companion.eomeUpdate'));return;}}
  const original=this.app.vault.getFileByPath(document.files?.[section.id]??path);if(!original)throw new Error(t('companion.sectionFileMissing'));this.base=section.raw;const style=getComputedStyle(this.host),header=presentationHeader(this.service.nativeHeader(path,section.id,kind),kind,this.host.clientWidth,Number.parseFloat(style.fontSize)||14,Number.parseFloat(style.getPropertyValue('--font-text-size'))||16);this.service.saveNativeHeader(path,section.id,kind,header);this.scopeText=projectionFromBody(sectionOutline(section),header);
  const stage=this.host.createDiv({cls:'em-companion-native-stage'}),virtualPath=[original.parent?.path??'',`Emergence ${document.id} ${section.id} ${kind}.md`].filter(Boolean).join('/'),session=++this.session;let sessionText=this.scopeText;const scope=nativeFileScope(this.app,this.leaf,stage,original,virtualPath,section.title,nativePlugins[kind].type,()=>session===this.session?this.scopeText:sessionText,async text=>{if(session!==this.session)throw new Error(t('companion.closed'));sessionText=text;await this.write(text);},this.openMarkdown);
  this.restoreScope=()=>scope.restore();this.editorText=()=>scope.editorText();this.finishEditor=()=>scope.finishEditor();try{
   const runtime=this.app as NativeRuntimeApp,plugin=runtime.plugins.plugins[nativePlugins[kind].id]!,factory=runtime.viewRegistry.getViewCreatorByType(nativePlugins[kind].type);if(!factory)throw new Error(t('companion.pluginMissing',{name:nativePlugins[kind].name}));
   const manifest=runtime.plugins.manifests[nativePlugins[kind].id] as {version?:string}|undefined;assertNativePluginCompatible(plugin,kind,manifest?.version);
   const nativePlugin=kind==='lineage'?scopedNativePlugin(plugin,scope.app,kind,scope.file,splitProjection(this.scopeText).header,this.host.createDiv({cls:'em-companion-native-status'})):plugin;let lineage:LineageSession|undefined;const view=this.view=hostedNativeView(factory,scope.leaf,nativePlugin,kind,{active:()=>session===this.session,write:text=>this.write(text),error:error=>this.showError(error),saveLineage:()=>lineage?.save()??Promise.resolve()});
   assertNativeCompatible(view,kind,manifest?.version);
   stage.append(view.containerEl);view.containerEl.dataset.type=nativePlugins[kind].type;stage.style.setProperty('--em-native-height',stage.clientHeight+'px');stage.style.setProperty('--em-native-width',stage.clientWidth+'px');scope.setView(view);view.app=scope.app;if(view.frontmatterStorage)view.frontmatterStorage.app=scope.app;if(view.commandHistory)view.commandHistory.app=scope.app;if(kind==='lineage')lineage=adaptLineage(view,()=>this.scopeText,error=>this.showError(error));
   if(kind==='lineage')stage.inert=true;view.load();view.file=null;view.data=this.scopeText;await view.onOpen();view.file=scope.file;if(kind==='eome'){this.appearance=new MutationObserver(()=>{if(view.cy&&stage.querySelector('.mindmap-overlay[data-overlay]')){this.appearance?.disconnect();applyNativeAppearance(view,this.host);sizeNativeViewport(view,stage,true);}});this.appearance.observe(stage,{childList:true,subtree:true});await view.onLoadFile?.(scope.file);watchEditorViewport(view,stage);}if(kind==='lineage'){view.data=this.scopeText;view.setViewData(this.scopeText,false);for(let n=0;n<180&&!view.component;n++)await new Promise<void>(resolve=>window.setTimeout(resolve,16));if(!view.component)throw new Error(t('companion.nativeUnavailable'));await new Promise<void>(resolve=>window.setTimeout(resolve,32));stage.inert=false;sizeNativeViewport(view,stage,true);view.alignBranch?.align({type:'view/life-cycle/mount'});}
   applyNativeAppearance(view,this.host);if(kind==='eome')sizeNativeViewport(view,stage,true);
   if(!stage.contains(view.containerEl))stage.append(view.containerEl);view.containerEl.dataset.type=nativePlugins[kind].type;
   this.resize=new ResizeObserver(()=>{sizeNativeViewport(view,stage);});this.resize.observe(stage);
  }catch(error){stage.inert=false;await settleSteps([()=>this.disposeView()]);this.error?.setText(error instanceof Error?error.message:String(error));if(error instanceof NativeCompatibilityError){const open=this.error?.createEl('button',{text:t('companion.openSource')});if(open)open.onclick=()=>this.openMarkdown();}}
 }
 private write(text:string):Promise<void>{
  this.writeCount++;const run=this.writes.then(async()=>{const kind=this.kind;if(!kind)throw new Error(t('companion.closed'));const before=this.scopeText,expected=this.base;this.scopeText=text;
   try{if(!this.available(kind))throw new Error(t('companion.nativeUnavailable'));validateNativeProjection(text);const raw=nativeBodiesEqual(expected,text)?expected:await this.service.replaceNativeSection(this.path,this.section,expected,text);this.base=raw;this.service.saveNativeHeader(this.path,this.section,kind,splitProjection(text).header);const draft=this.service.nativeDrafts.get(this.service.nativeKey(this.path,this.section,kind));if(draft&&splitProjection(draft.text).body===splitProjection(text).body)this.service.discardNativeDraft(draft);this.error?.empty();}
   catch(error){this.service.saveNativeDraft({path:this.path,section:this.section,kind,base:expected,text});this.scopeText=before;this.showError(error);throw error;}
  });this.writes=run.catch(()=>{}).finally(()=>{this.writeCount--;});return run;
 }
 private showError(error:unknown):void{this.error?.empty();this.error?.createSpan({text:String(error)});const kind=this.kind;if(!kind||!this.error)return;const draft=this.service.nativeDrafts.get(this.service.nativeKey(this.path,this.section,kind));if(draft){const save=this.error.createEl('button',{text:t('companion.saveNativeDraft')});save.onclick=()=>{void this.service.exportNativeDraft(draft).then(async path=>{const file=this.app.vault.getFileByPath(path);if(file)await this.app.workspace.getLeaf('tab').openFile(file);}).catch((error:unknown)=>this.showError(error));};}}
 async history(redo=false):Promise<void>{await this.flush();if(this.kind==='eome')await (redo?this.view?.executeRedo?.():this.view?.executeUndo?.());else this.view?.documentStore?.dispatch({type:redo?'document/history/select-next-snapshot':'document/history/select-previous-snapshot'});await this.writes;}
 async flush():Promise<void>{if(this.view?.inlineEditor?.nodeId){this.view.inlineEditor.unloadNode();this.view.viewStore?.dispatch({type:'view/editor/disable-main-editor'});}else if(this.editing){const draft=this.editorText?.();this.finishEditor?.();this.host.querySelector<HTMLElement>('.node-editor-host .cm-content')?.blur();for(let n=0;n<400&&this.editing;n++)await new Promise<void>(resolve=>window.setTimeout(resolve,25));if(this.editing){if(draft!==undefined&&this.kind&&!this.service.nativeDrafts.has(this.service.nativeKey(this.path,this.section,this.kind)))this.service.saveNativeDraft({path:this.path,section:this.section,kind:this.kind,base:this.base,text:projectionFromBody(encodeOutlineText(draft),splitProjection(this.scopeText).header)});throw new Error(t('companion.nativeConflict'));}}if(this.view?.saveDocument)await this.view.saveDocument();await this.writes;}
 /** Retire an unavailable file without trying to write to it or recreating it. */
 async retire(invalidate=true):Promise<void>{
  if(invalidate)this.generation++;if(this.closing)return this.closing;this.session++;
  this.closing=(async()=>{
   const text=(this.view?.inlineEditor?.nodeId?this.view.inlineEditor.getEditor?.()?.getValue():undefined)??(this.editing?this.editorText?.():undefined);
   if(this.kind&&text!==undefined)this.service.saveNativeDraft({path:this.path,section:this.section,kind:this.kind,base:this.base,text:this.scopeText+'\n\n## '+t('companion.uncommittedEdit')+'\n\n'+text+'\n'});
   await this.writes;try{await this.disposeView();}finally{this.host.empty();this.error=undefined;this.key='';this.kind=undefined;this.path='';}
  })().finally(()=>{this.closing=undefined;});return this.closing;
 }
 async close(invalidate=true):Promise<void>{if(this.path&&!this.app.vault.getFileByPath(this.path))return this.retire(invalidate);if(invalidate)this.generation++;if(this.closing)return this.closing;this.closing=(async()=>{await this.flush();await this.disposeView();await this.writes;this.session++;this.key='';this.kind=undefined;})().finally(()=>{this.closing=undefined;});return this.closing;}
 /** Teardown preserves a failed edit and releases the editor. View switches still use close(). */
 shutdown():Promise<void>{
  if(this.shuttingDown)return this.shuttingDown;this.generation++;const previous=this.closing;
  const task=(async()=>{
   const errors:unknown[]=[];let pending:string|undefined;
   try{pending=this.view?.inlineEditor?.nodeId?this.view.inlineEditor.getEditor?.()?.getValue():this.editing?this.editorText?.():undefined;}catch(error){errors.push(error);}
   const draft:NativeDraft|undefined=this.kind&&this.path?{path:this.path,section:this.section,kind:this.kind,base:this.base,text:this.scopeText}:undefined;
   const preserve=()=>{if(!draft)return;const stored=this.service.nativeDrafts.get(this.service.nativeKey(draft.path,draft.section,draft.kind));const text=(stored?.text??draft.text)+(pending===undefined?'':'\n\n## '+t('companion.uncommittedEdit')+'\n\n'+pending+'\n');this.service.saveNativeDraft({...draft,text});};
   try{await previous;if(this.path&&!this.app.vault.getFileByPath(this.path))preserve();else if(this.view)await this.flush();}
   catch(error){errors.push(error);errors.push(...await settleSteps([preserve]));}
   this.session++;const disposal=await settleSteps([()=>this.disposeView(),()=>this.writes]);
   if(disposal.length){errors.push(...disposal,...await settleSteps([preserve]));}
   this.error=undefined;this.key='';this.kind=undefined;this.path='';this.section='';this.scopeText='';this.base='';this.host.empty();
   if(errors.length)throw new AggregateError(errors,t('companion.closeFailed'));
  })();
  this.shuttingDown=task.finally(()=>{this.closing=undefined;this.shuttingDown=undefined;});this.closing=this.shuttingDown;return this.shuttingDown;
 }
 private async disposeView():Promise<void>{
  const view=this.view,resize=this.resize,appearance=this.appearance,restore=this.restoreScope;
  this.view=undefined;this.resize=undefined;this.appearance=undefined;this.restoreScope=undefined;this.editorText=undefined;this.finishEditor=undefined;
  const errors=await settleSteps([
   ()=>resize?.disconnect(),()=>appearance?.disconnect(),
   ()=>{if(this.kind==='lineage'&&view?.plugin?.settings&&view.file&&this.app.vault.getFileByPath(this.path)){const value=view.plugin.settings.getValue(),parsed:unknown=parseYaml(splitProjection(this.scopeText).header),header=parsed&&typeof parsed==='object'?parsed as Record<string,unknown>:{},documents=value.documents as Record<string,unknown>|undefined;header['emergence-lineage-view']={view:value.view,document:documents?.[view.file.path]};this.service.saveNativeHeader(this.path,this.section,'lineage',stringifyYaml(header));}},
   ()=>view?.onClose?.(),()=>view?.unload?.(),()=>view?.containerEl?.remove?.(),()=>restore?.(),
  ]);
  if(errors.length)throw new AggregateError(errors,t('companion.closeFailed'));
 }
}
