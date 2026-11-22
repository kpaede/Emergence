import type {WorkspaceLeaf} from 'obsidian';
import type {NativeKind,NativePlugin,NativeView} from './native-types';

type Factory=(leaf:WorkspaceLeaf)=>NativeView;
type Constructor=new(leaf:WorkspaceLeaf,plugin:NativePlugin)=>NativeView;
const constructors=new WeakMap<Factory,Constructor>();
interface Host {active():boolean;write(text:string):Promise<void>;error(error:unknown):void;saveLineage():Promise<void>}
/** Extend the original view at construction; never replace methods on a running instance. */
export function hostedNativeView(factory:Factory,leaf:WorkspaceLeaf,plugin:NativePlugin,kind:NativeKind,host:Host):NativeView{
 let Base=constructors.get(factory);
 if(!Base){const probe=factory(leaf);Base=probe.constructor as Constructor;constructors.set(factory,Base);probe.unload();probe.containerEl.remove();}
 class HostedView extends Base {
  override requestSave=():void=>{void this.save().catch(error=>host.error(error));};
  override save=():Promise<void>=>host.active()?host.write(this.getViewData()):Promise.resolve();
 }
 if(kind==='lineage'){
  class HostedLineageView extends HostedView {override saveDocument=():Promise<void>=>host.active()?host.saveLineage():Promise.resolve();}
  return new HostedLineageView(leaf,plugin);
 }
 return new HostedView(leaf,plugin);
}
