import {describe,it,expect,vi} from 'vitest';
import type {WorkspaceLeaf} from 'obsidian';
import type {NativeView,NativePlugin} from '../src/companion/native-types';
import {hostedNativeView} from '../src/companion/hosted-view';

class OriginalView {
 containerEl={remove:vi.fn()};data='Original thought';unload=vi.fn();
 constructor(readonly leaf:WorkspaceLeaf,readonly plugin:NativePlugin){}
 getViewData():string{return this.data;}
 getViewType():string{return 'mindmap-view';}
 async save():Promise<void>{this.data='Original save';}
 requestSave():void{void this.save();}
}
describe('Native view inheritance at the host boundary',()=>{
 it('retains original behavior and class identity without modifying other instances or prototypes',async()=>{
  const leaf={} as WorkspaceLeaf,plugin={} as NativePlugin,untouched=new OriginalView(leaf,plugin),descriptors=Object.getOwnPropertyDescriptors(OriginalView.prototype),write=vi.fn(async(_text:string)=>{}),factory=(host:WorkspaceLeaf)=>new OriginalView(host,plugin) as unknown as NativeView;
  const view=hostedNativeView(factory,leaf,plugin,'eome',{active:()=>true,write,error:vi.fn(),saveLineage:async()=>{}});
  expect(view).toBeInstanceOf(OriginalView);await view.save();expect(write).toHaveBeenCalledWith('Original thought');expect(Object.getOwnPropertyDescriptors(OriginalView.prototype)).toEqual(descriptors);await untouched.save();expect(untouched.data).toBe('Original save');
 });
 it('configures the optional EOME heading capability only on the embedded instance',()=>{
  class CapableView extends OriginalView {supportsStructuralHeadings=true;}
  const leaf={} as WorkspaceLeaf,plugin={} as NativePlugin,standalone=new CapableView(leaf,plugin),factory=(host:WorkspaceLeaf)=>new CapableView(host,plugin) as unknown as NativeView,callbacks={active:()=>true,write:async()=>{},error:vi.fn(),saveLineage:async()=>{}};
  const embedded=hostedNativeView(factory,leaf,plugin,'eome',callbacks);expect(embedded.supportsStructuralHeadings).toBe(false);expect(standalone.supportsStructuralHeadings).toBe(true);expect(new CapableView(leaf,plugin).supportsStructuralHeadings).toBe(true);
  const legacy=hostedNativeView(host=>new OriginalView(host,plugin) as unknown as NativeView,leaf,plugin,'eome',callbacks);expect(Object.prototype.hasOwnProperty.call(legacy,'supportsStructuralHeadings')).toBe(false);
 });
 it('uses the host serializer for Lineage and ignores retired save callbacks',async()=>{
  let active=true;const leaf={} as WorkspaceLeaf,plugin={} as NativePlugin,write=vi.fn(async(_text:string)=>{}),serialize=vi.fn(async()=>{}),factory=(host:WorkspaceLeaf)=>new OriginalView(host,plugin) as unknown as NativeView;
  const view=hostedNativeView(factory,leaf,plugin,'lineage',{active:()=>active,write,error:vi.fn(),saveLineage:serialize});await view.saveDocument!();expect(serialize).toHaveBeenCalledOnce();active=false;await view.save();await view.saveDocument!();expect(serialize).toHaveBeenCalledOnce();expect(write).not.toHaveBeenCalled();
 });
});
