import {parseYaml,stringifyYaml,TFile,type App,type WorkspaceLeaf} from 'obsidian';
import {splitProjection} from './native-projection';
import type {NativeKind,NativePlugin,NativeStore,NativeView} from './native-types';
import {t} from '../i18n';

function bound(target:object,key:PropertyKey):unknown{const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export interface NativeFileScope{app:App;leaf:WorkspaceLeaf;file:TFile;setView(view:NativeView):void;editorText():string|undefined;finishEditor():void;restore():void}
/** Instance-local facades. No real vault, WorkspaceLeaf, editor prototype or installed plugin is patched. */
export function nativeFileScope(app:App,parent:WorkspaceLeaf,host:HTMLElement,original:TFile,path:string,title:string,type:string,read:()=>string,write:(text:string)=>Promise<void>,switchView:()=>void):NativeFileScope{
 let view:NativeView|undefined;const prototype:unknown=Object.getPrototypeOf(original);if(!prototype||typeof prototype!=='object')throw new Error(t('companion.sectionFileMissing'));const clone:unknown=Object.create(prototype);if(!(clone instanceof TFile))throw new Error(t('companion.sectionFileMissing'));const file=Object.assign(clone,original,{path,name:path.split('/').at(-1)!,basename:title,extension:'md',stat:{...original.stat}}),local=new Map<PropertyKey,unknown>();
 const isFile=(candidate:{path:string})=>candidate?.path===path;
 let processing:Promise<unknown>=Promise.resolve();
 let previousFocus:{public:unknown;internal:unknown}|undefined;const nativeEditors=new Set<unknown>();
 const restoreFocus=()=>{if(previousFocus&&(nativeEditors.has(app.workspace.activeEditor)||nativeEditors.has(Reflect.get(app.workspace,'_activeEditor')))){Reflect.set(app.workspace,'activeEditor',previousFocus.public,app.workspace);Reflect.set(app.workspace,'_activeEditor',previousFocus.internal,app.workspace);}previousFocus=undefined;nativeEditors.clear();};
 const vault=new Proxy(app.vault,{get(target,key){
  if(key==='read'||key==='cachedRead')return (candidate:TFile)=>isFile(candidate)?Promise.resolve(read()):target[key](candidate);
  if(key==='getFileByPath'||key==='getAbstractFileByPath')return (candidate:string)=>candidate===path?file:target[key](candidate);
  if(key==='modify')return async(candidate:TFile,text:string)=>{if(!isFile(candidate))throw new Error(t('companion.nativeScope'));await write(text);file.stat.mtime=Date.now();};
  if(key==='process')return (candidate:TFile,change:(text:string)=>string)=>{const operation=processing.catch(()=>{}).then(async()=>{if(!isFile(candidate))throw new Error(t('companion.nativeScope'));const next=change(read());await write(next);return next;});processing=operation;return operation;};
  if(key==='delete'||key==='trash'||key==='rename')return ()=>{throw new Error(t('companion.nativeFileActions'));};
  return bound(target,key);
 }});
 const fileManager=new Proxy(app.fileManager,{get(target,key){if(key==='processFrontMatter')return async(candidate:TFile,change:(data:Record<string,unknown>)=>void)=>{if(!isFile(candidate))throw new Error(t('companion.nativeScope'));const {header,body}=splitProjection(read()),data=record(parseYaml(header));change(data);await write('---\n'+stringifyYaml(data)+'---\n'+body);};return bound(target,key);}});
 const focused=()=>!!host.contains?.(host.ownerDocument?.activeElement??null);
 let leaf:WorkspaceLeaf;
 const workspace=new Proxy(app.workspace,{get(target,key){
  if(local.has(key))return local.get(key);if(key==='activeLeaf')return focused()?leaf:Reflect.get(target,key,target);
  if(key==='getActiveFile')return ()=>file;
  if(key==='getActiveViewOfType')return (ctor:abstract new (...args:never[])=>object)=>focused()&&view instanceof ctor?view:target.getActiveViewOfType(ctor as never);
  if(key==='getLeavesOfType')return (kind:string)=>[...(view?.getViewType()===kind?[leaf]:[]),...target.getLeavesOfType(kind)];
  if(key==='setActiveLeaf')return (candidate:WorkspaceLeaf)=>target.setActiveLeaf(candidate===leaf?parent:candidate,{focus:false});
  return bound(target,key);
 },set(target,key,value:unknown){if(key==='activeEditor'||key==='_activeEditor'){if(value==null){restoreFocus();return true;}previousFocus??={public:app.workspace.activeEditor,internal:Reflect.get(target,'_activeEditor') as unknown};nativeEditors.add(value);return Reflect.set(target,key,value,target);}local.set(key,value);return true;},defineProperty(_target,key,descriptor){if('value'in descriptor)local.set(key,descriptor.value as unknown);return true;},deleteProperty(_target,key){local.delete(key);return true;},getOwnPropertyDescriptor(target,key){return local.has(key)?{value:local.get(key),writable:true,enumerable:true,configurable:true}:Reflect.getOwnPropertyDescriptor(target,key);}});
 const metadataCache=new Proxy(app.metadataCache,{get(target,key){if(key==='getFileCache')return (candidate:TFile)=>isFile(candidate)?{frontmatter:record(parseYaml(splitProjection(read()).header)),links:[],headings:[]}:target.getFileCache(candidate);if(key==='getCache')return (candidate:string)=>candidate===path?{frontmatter:record(parseYaml(splitProjection(read()).header)),links:[],headings:[]}:target.getCache(candidate);return bound(target,key);}});
 const scopedApp=new Proxy(app,{get(target,key){if(key==='vault')return vault;if(key==='fileManager')return fileManager;if(key==='workspace')return workspace;if(key==='metadataCache')return metadataCache;return bound(target,key);}});
 leaf=new Proxy(parent,{get(target,key){if(key==='containerEl')return host;if(key==='app')return scopedApp;if(key==='workspace')return workspace;if(key==='id')return 'emergence-native-'+path;if(key==='view')return view;if(key==='history')return {backHistory:[],forwardHistory:[]};if(key==='getViewState')return ()=>({type,state:view?.file?{file:path}:{}});if(key==='setViewState'||key==='detach')return async()=>{switchView();};if(key==='openFile')return (candidate:TFile)=>app.workspace.getLeaf('tab').openFile(candidate);return bound(target,key);}});
 return {app:scopedApp,leaf,file,setView(value){view=value;},editorText(){for(const value of [...nativeEditors].reverse()){const editor=value as {file?:{path:string};editor?:{getValue():string}};if(editor.editor)return editor.editor.getValue();}return undefined;},finishEditor(){for(const value of [...nativeEditors].reverse()){const owner=value as {file?:{path:string};editMode?:{options?:{onBlur?:(editor:unknown)=>void}}};if(owner.editMode?.options?.onBlur){owner.editMode.options.onBlur(owner.editMode);return;}}},restore:restoreFocus};
}
function cloneStore(original:NativeStore,value:Record<string,unknown>):NativeStore{
 const Store=original.constructor;if(typeof Store!=='function'||typeof original.reducer!=='function')throw new Error(t('companion.nativeUnavailable'));
 return new (Store as new(initial:Record<string,unknown>,reducer:unknown,onError:unknown)=>NativeStore)(value,original.reducer,original.onError);
}
/** Lineage gets independent per-view stores while retaining the installed plugin's own components and reducers. */
export function scopedNativePlugin(plugin:NativePlugin,app:App,kind:NativeKind,file:TFile,header='',status?:HTMLElement):NativePlugin{
 const scoped=Object.create(plugin) as NativePlugin;scoped.app=app;if(kind==='lineage'){
  if(!plugin.settings||!plugin.store)throw new Error(t('companion.nativeUnavailable'));const settings=structuredClone(plugin.settings.getValue()),saved=record(record(parseYaml(header))['emergence-lineage-view']);settings.documents=saved.document?{[file.path]:saved.document}:{};settings.view={...record(settings.view),...record(saved.view)};settings.general={...record(settings.general),defaultDocumentFormat:'outline'};
  const update=(view:NativeView)=>{const state=view.documentStore?.getValue(),document=state?.document as {content?:Record<string,unknown>}|undefined;status?.setText(t('companion.chapterThoughts',{count:Object.keys(document?.content??{}).length}));};scoped.statusBar={updateAll:update,updateProgressIndicatorAndChildCount:update};
  scoped.settings=cloneStore(plugin.settings,settings);scoped.settings.dispatch({type:'settings/documents/set-document-format',payload:{path:file.path,format:'outline'}});scoped.store=cloneStore(plugin.store,{documents:{}});
 }return scoped;
}
