import {describe,it,expect,vi} from 'vitest';
import type {App,WorkspaceLeaf} from 'obsidian';
import {tetradDom} from './helpers/tetrad-dom';
import {NativeCompanionView} from '../src/companion/native-view';
import type {CompanionService} from '../src/companion/service';
import type {NativeDraft} from '../src/companion/native-types';

vi.mock('obsidian',async importOriginal=>({
 ...await importOriginal<Record<string,unknown>>(),
 Component:class{private callbacks:(()=>void)[]=[];register(callback:()=>void){this.callbacks.push(callback);}registerEvent(){}unload(){for(const callback of this.callbacks.splice(0))callback();}},
}));
function fixture(){
 const dom=tetradDom('<main><div id="host"><div id="view"></div></div></main>'),host=dom.window.document.querySelector<HTMLElement>('#host')!,element=dom.window.document.querySelector<HTMLElement>('#view')!;
 Object.assign(host,{addClass:(name:string)=>host.classList.add(name),empty:()=>host.replaceChildren()});
 const drafts=new Map<string,NativeDraft>(),key=(path:string,section:string,kind:string)=>JSON.stringify([path,section,kind]);
 const service={nativeDrafts:drafts,nativeKey:key,saveNativeDraft:vi.fn((draft:NativeDraft)=>drafts.set(key(draft.path,draft.section,draft.kind),draft)),saveNativeHeader:vi.fn(),flush:vi.fn(async()=>{})};
 const getFile=vi.fn(()=>({path:'Companion.md'})),modify=vi.fn(),app={workspace:{on:vi.fn()},vault:{getFileByPath:getFile,modify}} as unknown as App;
 const view={containerEl:element,onClose:vi.fn(async()=>{}),unload:vi.fn(),saveDocument:vi.fn(async()=>{})},restore=vi.fn(),resize={disconnect:vi.fn()},appearance={disconnect:vi.fn()};
 const native=new NativeCompanionView(app,host,service as unknown as CompanionService,{} as WorkspaceLeaf,()=>{});
 Object.assign(native,{path:'Companion.md',section:'chapter-a',kind:'lineage',scopeText:'---\n\n---\n- Original thought\n\t- Nested thought\n',base:'- Original thought\n\t- Nested thought\n',view,restoreScope:restore,resize,appearance});
 return {dom,host,element,service,view,native,restore,resize,appearance,getFile,modify,drafts};
}
describe('companion workspace shutdown',()=>{
 it('finishes saving and releases observers, the original view, its DOM and scoped focus',async()=>{
  const f=fixture();await f.native.shutdown();expect(f.view.saveDocument).toHaveBeenCalledOnce();expect(f.view.onClose).toHaveBeenCalledOnce();expect(f.view.unload).toHaveBeenCalledOnce();expect(f.resize.disconnect).toHaveBeenCalledOnce();expect(f.appearance.disconnect).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();expect(f.element.isConnected).toBe(false);expect(f.drafts.size).toBe(0);expect(f.modify).not.toHaveBeenCalled();
 });
 it('preserves the complete section and the active text when saving fails, then still releases the editor',async()=>{
  const f=fixture(),failure=Error('disk full');const inline={nodeId:'node-a' as string|null,getEditor:()=>({getValue:()=> 'Latest text\n\n- Internal list'}),unloadNode:()=>{inline.nodeId=null;}};
  Object.assign(f.view,{inlineEditor:inline});f.view.saveDocument.mockRejectedValue(failure);
  await expect(f.native.shutdown()).rejects.toMatchObject({errors:[failure]});const draft=[...f.drafts.values()][0]!;
  expect(draft.text).toContain('- Original thought\n\t- Nested thought');expect(draft.text).toContain('Latest text\n\n- Internal list');expect(draft.path).toBe('Companion.md');expect(f.view.unload).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();expect(f.host.childElementCount).toBe(0);expect(f.modify).not.toHaveBeenCalled();
  await f.native.shutdown();expect(f.view.unload).toHaveBeenCalledOnce();expect(f.service.saveNativeDraft).toHaveBeenCalledOnce();
 });
 it('keeps an existing conflict draft when teardown encounters another error',async()=>{
  const f=fixture();f.service.saveNativeDraft({path:'Companion.md',section:'chapter-a',kind:'lineage',base:'old',text:'A complete conflicting edit'});f.view.saveDocument.mockRejectedValue(Error('save failed'));
  await expect(f.native.shutdown()).rejects.toThrow();expect([...f.drafts.values()][0]!.text).toBe('A complete conflicting edit');expect(f.restore).toHaveBeenCalledOnce();
 });
 it('attempts the remaining cleanup even when both the original close and unload hooks fail',async()=>{
  const f=fixture();f.view.onClose.mockRejectedValue(Error('original close failed'));f.view.unload.mockImplementation(()=>{throw Error('original unload failed');});
  await expect(f.native.shutdown()).rejects.toThrow();expect(f.restore).toHaveBeenCalledOnce();expect(f.element.isConnected).toBe(false);expect(f.resize.disconnect).toHaveBeenCalledOnce();expect([...f.drafts.values()][0]!.text).toContain('Nested thought');
 });
 it('releases the editor and restores focus even if saving its view options fails',async()=>{
  const f=fixture();Object.assign(f.view,{file:{path:'virtual.md'},plugin:{settings:{getValue:()=>({view:{}})}}});f.service.saveNativeHeader.mockImplementation(()=>{throw Error('settings unavailable');});
  await expect(f.native.shutdown()).rejects.toThrow();expect(f.view.onClose).toHaveBeenCalledOnce();expect(f.view.unload).toHaveBeenCalledOnce();expect(f.restore).toHaveBeenCalledOnce();expect(f.host.childElementCount).toBe(0);
 });
 it('does not write or recreate a deleted companion while shutting down',async()=>{
  const f=fixture();f.getFile.mockReturnValue(null as unknown as {path:string});await f.native.shutdown();expect(f.view.saveDocument).not.toHaveBeenCalled();expect(f.modify).not.toHaveBeenCalled();expect([...f.drafts.values()][0]!.text).toContain('Nested thought');expect(f.restore).toHaveBeenCalledOnce();
 });
 it('shares an in-flight shutdown and closes the original view only once',async()=>{
  const f=fixture();let finish!:()=>void;f.view.saveDocument.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));const first=f.native.shutdown(),second=f.native.shutdown();expect(second).toBe(first);await Promise.resolve();finish();await Promise.all([first,second]);expect(f.view.saveDocument).toHaveBeenCalledOnce();expect(f.view.unload).toHaveBeenCalledOnce();
 });
 it('keeps an ordinary view switch blocked on a save failure until explicit workspace teardown',async()=>{
  const f=fixture();f.view.saveDocument.mockRejectedValue(Error('cannot save'));await expect(f.native.close()).rejects.toThrow('cannot save');expect(f.view.unload).not.toHaveBeenCalled();expect(f.element.isConnected).toBe(true);
  await expect(f.native.shutdown()).rejects.toThrow();expect(f.view.unload).toHaveBeenCalledOnce();expect(f.drafts.size).toBe(1);
 });
 it('also persists a recovered draft when the component unloads after a save error',async()=>{
  const f=fixture();f.view.saveDocument.mockRejectedValue(Error('cannot save'));f.native.unload();await vi.waitFor(()=>expect(f.service.flush).toHaveBeenCalledOnce());expect(f.drafts.size).toBe(1);expect(f.view.unload).toHaveBeenCalledOnce();
 });
});
