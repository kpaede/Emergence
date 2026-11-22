// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {App,WorkspaceLeaf} from 'obsidian';
import type {CompanionService} from '../src/companion/service';
import type {CompanionDocument,CompanionSection} from '../src/companion/model';
import type {NativeKind} from '../src/companion/native-types';
import {NativeCompanionView} from '../src/companion/native-view';
import {installDomHelpers} from './helpers/dom';

const bridge=vi.hoisted(()=>({planned:[] as unknown[],created:[] as unknown[],restores:[] as ReturnType<typeof vi.fn>[],resized:[] as Element[]}));
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
vi.mock('../src/companion/hosted-view',()=>({hostedNativeView:()=>{const view=bridge.planned.shift();if(!view)throw Error('Unexpected view construction');bridge.created.push(view);return view;}}));
vi.mock('../src/companion/native-compatibility',()=>({assertNativeCompatible:()=>{},assertNativePluginCompatible:()=>{},NativeCompatibilityError:class extends Error{}}));
vi.mock('../src/companion/native-appearance',()=>({applyNativeAppearance:()=>{}}));
vi.mock('../src/companion/native-layout',()=>({sizeNativeViewport:()=>{}}));
vi.mock('../src/companion/editor-viewport',()=>({watchEditorViewport:()=>{}}));
vi.mock('../src/companion/native-selection',()=>({nativeSelection:()=>undefined}));
vi.mock('../src/companion/lineage-adapter',()=>({adaptLineage:()=>({save:async()=>{}}),lineageOutline:()=>'',lineageDocument:()=>({})}));
vi.mock('../src/companion/native-sandbox',()=>({
 scopedNativePlugin:(plugin:unknown)=>plugin,
 nativeFileScope:(app:unknown,leaf:unknown,_host:HTMLElement,_original:unknown,path:string)=>{const restore=vi.fn();bridge.restores.push(restore);return {app,leaf,file:{path},setView:()=>{},editorText:()=>undefined,finishEditor:()=>{},cancelEditor:()=>{},restore};},
}));
beforeEach(()=>{
 installDomHelpers();document.body.empty();bridge.planned=[];bridge.created=[];bridge.restores=[];bridge.resized=[];
 vi.stubGlobal('ResizeObserver',class{observe(target:Element){bridge.resized.push(target);}disconnect(){}});
});
afterEach(()=>vi.unstubAllGlobals());
function gate(){let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
function view(kind:NativeKind,onOpen:()=>Promise<void>=async()=>{}){
 const containerEl=document.body.createDiv(),data={kind,containerEl,contentEl:containerEl,file:null as {path:string}|null,data:'',component:{} as object|undefined,load:vi.fn(),unload:vi.fn(),onClose:vi.fn(async()=>{}),onOpen:vi.fn(onOpen),onLoadFile:vi.fn(async()=>{}),setViewData:vi.fn(),saveDocument:vi.fn(async()=>{}),alignBranch:{align:vi.fn()}};
 bridge.planned.push(data);return data;
}
function fixture(){
 const host=document.body.createDiv(),original={path:'Companion.md',parent:{path:''}},app={workspace:{on:vi.fn()},vault:{getFileByPath:()=>original},plugins:{plugins:{lineage:{},'excerpt-outline-mindmap-editor':{}},manifests:{lineage:{version:'0.8.5'},'excerpt-outline-mindmap-editor':{version:'0.2.4'}}},viewRegistry:{getViewCreatorByType:()=>()=>{}}} as unknown as App;
 const service={nativeHeader:()=>'',saveNativeHeader:vi.fn(),selectedThought:()=>'',flush:vi.fn(async()=>{})} as unknown as CompanionService,native=new NativeCompanionView(app,host,service,{} as WorkspaceLeaf,()=>{});
 const section:CompanionSection={id:'s',title:'Section',level:1,state:'linked',format:2,plain:true,raw:'- One\n'},doc:CompanionDocument={id:'doc',source:'Main.md',sections:[section],preamble:'',header:'',original:'',newline:'\n'};
 const current=()=>Reflect.get(native,'view') as unknown;return {native,host,section,document:doc,current};
}
describe('native companion mount lifecycle',()=>{
 it('does not let a late failure from an obsolete mount dispose the next view',async()=>{
  const f=fixture(),open=gate(),old=view('lineage',async()=>{await open.promise;throw Error('Late old mount failure');}),first=f.native.render('Companion.md',f.document,f.section,'lineage');await vi.waitFor(()=>expect(old.onOpen).toHaveBeenCalled());expect(f.native.pending).toBe(true);
  const replacement=view('eome'),second=f.native.render('Companion.md',f.document,f.section,'eome');await Promise.resolve();expect(bridge.created).toHaveLength(1);expect(old.unload).not.toHaveBeenCalled();open.release();await Promise.all([first,second]);
  expect(f.current()).toBe(replacement);expect(old.unload).toHaveBeenCalledOnce();expect(replacement.unload).not.toHaveBeenCalled();expect(replacement.containerEl.isConnected).toBe(true);expect(f.host.textContent).not.toContain('Late old mount failure');expect(bridge.resized).toHaveLength(1);await f.native.shutdown();
 });
 it('ignores a stale EOME load failure and keeps observers attached to the replacement',async()=>{
  const f=fixture(),load=gate(),old=view('eome');old.onLoadFile.mockImplementation(async()=>{await load.promise;throw Error('Late old file load');});const first=f.native.render('Companion.md',f.document,f.section,'eome');await vi.waitFor(()=>expect(old.onLoadFile).toHaveBeenCalled());
  const replacement=view('lineage'),second=f.native.render('Companion.md',f.document,f.section,'lineage');load.release();await Promise.all([first,second]);expect(f.current()).toBe(replacement);expect(old.unload).toHaveBeenCalledOnce();expect(replacement.unload).not.toHaveBeenCalled();expect(bridge.resized).toHaveLength(1);await f.native.shutdown();
 });
 it.each(['close','retire','shutdown'] as const)('%s waits for the mounting original view and then releases it once',async action=>{
  const f=fixture(),open=gate(),original=view('lineage',()=>open.promise),render=f.native.render('Companion.md',f.document,f.section,'lineage');await vi.waitFor(()=>expect(original.onOpen).toHaveBeenCalled());const closing=f.native[action]();await Promise.resolve();expect(original.unload).not.toHaveBeenCalled();open.release();await Promise.all([render,closing]);expect(original.unload).toHaveBeenCalledOnce();expect(original.containerEl.isConnected).toBe(false);expect(f.current()).toBeUndefined();expect(bridge.restores[0]).toHaveBeenCalledOnce();expect(f.native.pending).toBe(false);
  const replacement=view('eome');await f.native.render('Companion.md',f.document,f.section,'eome');expect(f.current()).toBe(replacement);await f.native.shutdown();
 });
 it('lets the original setter observe changed external content before changing its data',async()=>{const f=fixture(),original=view('eome');await f.native.render('Companion.md',f.document,f.section,'eome');let updates=0;original.setViewData.mockImplementation((text:string)=>{const unchanged=text===original.data;original.data=text;if(!unchanged)updates++;});const changed={...f.section,raw:'- External replacement\n'};await f.native.render('Companion.md',{...f.document,sections:[changed]},changed,'eome');expect(updates).toBe(1);expect(original.data).toContain('External replacement');await f.native.shutdown();});
 it.each(['eome','lineage'] as const)('resets only EOME history for a genuine external body change (%s)',async kind=>{
  const f=fixture(),original=view(kind);await f.native.render('Companion.md',f.document,f.section,kind);const clear=vi.fn(),toolbar=vi.fn();Object.assign(original,{commandHistory:{clear},forceToolbarUpdate:toolbar});await f.native.render('Companion.md',{...f.document,original:'Metadata-only update'},{...f.section,title:'Renamed section'},kind);expect(clear).not.toHaveBeenCalled();expect(toolbar).not.toHaveBeenCalled();const changed={...f.section,raw:'- External replacement\n'};await f.native.render('Companion.md',{...f.document,sections:[changed]},changed,kind);expect(clear).toHaveBeenCalledTimes(kind==='eome'?1:0);expect(toolbar).toHaveBeenCalledTimes(kind==='eome'?1:0);await f.native.render('Companion.md',{...f.document,sections:[changed]},changed,kind);expect(clear).toHaveBeenCalledTimes(kind==='eome'?1:0);expect(toolbar).toHaveBeenCalledTimes(kind==='eome'?1:0);await f.native.shutdown();
 });
 it('shares a same-context render without exposing an incomplete view',async()=>{
  const f=fixture(),open=gate(),original=view('lineage',()=>open.promise),first=f.native.render('Companion.md',f.document,f.section,'lineage');await vi.waitFor(()=>expect(original.onOpen).toHaveBeenCalled());let done=false;const second=f.native.render('Companion.md',f.document,f.section,'lineage').then(()=>{done=true;});await Promise.resolve();expect(done).toBe(false);open.release();await Promise.all([first,second]);expect(bridge.created).toHaveLength(1);expect(f.current()).toBe(original);expect(original.unload).not.toHaveBeenCalled();expect(f.native.pending).toBe(false);await f.native.shutdown();
 });
 it('discards an intermediate request while waiting for an older mount to finish',async()=>{
  const f=fixture(),open=gate(),original=view('lineage',()=>open.promise),first=f.native.render('Companion.md',f.document,f.section,'lineage');await vi.waitFor(()=>expect(original.onOpen).toHaveBeenCalled());const middle=f.native.render('Companion.md',f.document,f.section,'eome'),replacement=view('lineage'),latest=f.native.render('Other.md',f.document,{...f.section,id:'other'},'lineage');open.release();await Promise.all([first,middle,latest]);expect(bridge.created).toEqual([original,replacement]);expect(f.current()).toBe(replacement);expect(Reflect.get(f.native,'path')).toBe('Other.md');expect(Reflect.get(f.native,'section')).toBe('other');await f.native.shutdown();
 });
 it('waits for an existing close before rendering the same document again',async()=>{
  const f=fixture(),original=view('eome');await f.native.render('Companion.md',f.document,f.section,'eome');const save=gate();original.saveDocument.mockImplementation(()=>save.promise);const closing=f.native.close();await vi.waitFor(()=>expect(original.saveDocument).toHaveBeenCalled());const replacement=view('eome');let done=false;const render=f.native.render('Companion.md',f.document,f.section,'eome').then(()=>{done=true;});await Promise.resolve();expect(done).toBe(false);save.release();await Promise.all([closing,render]);expect(f.current()).toBe(replacement);expect(original.unload).toHaveBeenCalledOnce();expect(replacement.unload).not.toHaveBeenCalled();await f.native.shutdown();
 });
 it('keeps a later retirement locked when an earlier retirement finishes',async()=>{
  const f=fixture(),original=view('eome');await f.native.render('Companion.md',f.document,f.section,'eome');const close=gate();original.onClose.mockImplementation(()=>close.promise);const first=f.native.retire();await vi.waitFor(()=>expect(original.onClose).toHaveBeenCalled());const pendingWrite=gate();Reflect.set(f.native,'writes',pendingWrite.promise);const second=f.native.retire();close.release();await first;expect(Reflect.get(f.native,'closing')).toBeDefined();const replacement=view('eome'),render=f.native.render('Companion.md',f.document,f.section,'eome');await Promise.resolve();expect(bridge.created).toHaveLength(1);pendingWrite.release();await Promise.all([second,render]);expect(f.current()).toBe(replacement);expect(replacement.unload).not.toHaveBeenCalled();await f.native.shutdown();
 });
 it('does not revive the native view from a render requested during shutdown',async()=>{
  const f=fixture(),original=view('eome');await f.native.render('Companion.md',f.document,f.section,'eome');const save=gate();original.saveDocument.mockImplementation(()=>save.promise);const shutdown=f.native.shutdown();await vi.waitFor(()=>expect(original.saveDocument).toHaveBeenCalled());const replacement=view('lineage'),staleRender=f.native.render('Other.md',f.document,{...f.section,id:'other'},'lineage');save.release();await Promise.all([shutdown,staleRender]);expect(f.current()).toBeUndefined();expect(bridge.created).toHaveLength(1);expect(f.host.childElementCount).toBe(0);await f.native.render('Other.md',f.document,{...f.section,id:'other'},'lineage');expect(f.current()).toBe(replacement);await f.native.shutdown();
 });
 it('flush waits for the original view to mount before saving',async()=>{
  const f=fixture(),open=gate(),original=view('lineage',()=>open.promise),render=f.native.render('Companion.md',f.document,f.section,'lineage');await vi.waitFor(()=>expect(original.onOpen).toHaveBeenCalled());const flush=f.native.flush();await Promise.resolve();expect(original.saveDocument).not.toHaveBeenCalled();open.release();await Promise.all([render,flush]);expect(original.saveDocument).toHaveBeenCalledOnce();await f.native.shutdown();
 });
});
