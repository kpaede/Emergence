import {describe,it,expect,vi} from 'vitest';
import {assertNativeCompatible,assertNativePluginCompatible,NativeCompatibilityError} from '../src/companion/native-compatibility';

function view(kind:'eome'|'lineage'){
 const shared={getViewType:()=>kind==='eome'?'mindmap-view':'lineage',getViewData:vi.fn(()=>''),setViewData:vi.fn(),onOpen:vi.fn(),onClose:vi.fn(),load:vi.fn(),unload:vi.fn(),register:vi.fn(),registerDomEvent:vi.fn(),containerEl:{dataset:{},remove:vi.fn()}};
 if(kind==='eome')return {...shared,onLoadFile:vi.fn()};
 class Store{getValue(){return {};}dispatch(){}set(){}subscribe(){return ()=>{};}}
 return {...shared,documentStore:new Store(),viewStore:new Store()};
}
describe('compatibility with independently installed editors',()=>{
 it('accepts a capable future EOME version without loading it, mutating it or reading its content',()=>{
  const editor=Object.freeze(view('eome'));expect(()=>assertNativeCompatible(editor,'eome','10.0.0')).not.toThrow();expect(editor.load).not.toHaveBeenCalled();expect(editor.getViewData).not.toHaveBeenCalled();expect(editor.containerEl.remove).not.toHaveBeenCalled();
 });
 it('accepts Lineage stores whose methods are inherited from their original class',()=>{
  expect(()=>assertNativeCompatible(view('lineage'),'lineage','0.8.5')).not.toThrow();
 });
 it('rejects an EOME view without its file loader before any editor is mounted',()=>{
  const editor={...view('eome'),onLoadFile:undefined};expect(()=>assertNativeCompatible(editor,'eome','0.9.0')).toThrow(NativeCompatibilityError);expect(()=>assertNativeCompatible(editor,'eome','0.9.0')).toThrow('EOME 0.9.0');expect(editor.load).not.toHaveBeenCalled();expect(editor.onOpen).not.toHaveBeenCalled();
 });
 it('rejects a changed Lineage store API instead of silently omitting thoughts',()=>{
  const editor={...view('lineage'),documentStore:{getValue:()=>({}),dispatch:vi.fn()}};let failure:unknown;
  try{assertNativeCompatible(editor,'lineage','0.9.0');}catch(error){failure=error;}
  expect(failure).toMatchObject({kind:'lineage',missing:['documentStore.set','documentStore.subscribe']});expect(editor.load).not.toHaveBeenCalled();expect(editor.setViewData).not.toHaveBeenCalled();
 });
 it('turns a wrong or throwing view type into an actionable compatibility message',()=>{
  for(const getViewType of [()=> 'another-view',()=>{throw Error('private implementation detail');}])expect(()=>assertNativeCompatible({...view('eome'),getViewType},'eome')).toThrow('Begleitdatei als Markdown');
 });
 it('rejects malformed view objects and containers without changing their state',()=>{
  for(const value of [undefined,null,{}, {...view('eome'),containerEl:null}])expect(()=>assertNativeCompatible(value,'eome')).toThrow(NativeCompatibilityError);
 });
 it('accepts original per-plugin stores without executing their methods',()=>{
  class Store{getValue=vi.fn();dispatch=vi.fn();subscribe=vi.fn();reducer=vi.fn();}
  const settings=new Store(),store=new Store();expect(()=>assertNativePluginCompatible({settings,store},'lineage','0.8.5')).not.toThrow();expect(settings.getValue).not.toHaveBeenCalled();expect(store.dispatch).not.toHaveBeenCalled();
 });
 it('rejects an incompatible global store before cloning preferences or creating an editor',()=>{
  const getValue=vi.fn(),plugin={settings:{getValue},store:{getValue}};expect(()=>assertNativePluginCompatible(plugin,'lineage','0.9.0')).toThrow('Lineage 0.9.0');expect(getValue).not.toHaveBeenCalled();expect(()=>assertNativePluginCompatible({},'eome','0.2.4')).not.toThrow();
 });
});
