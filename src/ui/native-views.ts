import {Events, type App, type View, type WorkspaceLeaf, type ViewState, type TFile, type OpenViewState} from 'obsidian';
import {errorMessage} from '../util';

interface NativeView extends View {open?(host:HTMLElement):Promise<void>;close?():Promise<void>}
interface Registry {getViewCreatorByType?(type:string):((leaf:WorkspaceLeaf)=>NativeView)|undefined}
interface HostApp extends App {viewRegistry?:Registry;plugins?:{plugins?:Record<string,unknown>};internalPlugins?:{plugins?:Record<string,{enabled?:boolean;instance?:unknown}>}}
interface Slot {type:string;provider:unknown;section:HTMLElement;host:HTMLElement;view?:NativeView;leaf?:WorkspaceLeaf;closed:boolean;path:string;ready:Promise<void>;observer?:ResizeObserver;zoomTimer?:number}
const definitions=[{type:'bc-matrix-view',label:'Breadcrumbs · Matrix',plugin:'breadcrumbs'},{type:'bc-tree-view',label:'Breadcrumbs · Baum',plugin:'breadcrumbs'},{type:'zotlit-references',label:'ZotLit · Literaturverzeichnis',plugin:'zotlit'},{type:'localgraph',label:'Obsidian · Lokaler Graph',plugin:'graph'}];

/** Guarded adapter to registered original renderers. No workspace leaves are created or moved. */
export class NativeViews {
 readonly slots=new Map<string,Slot>();private disposed=false;private source='';
 constructor(private app:App,private owner:WorkspaceLeaf,private host:HTMLElement){}
 choices(source:string):{type:string;label:string}[]{
  return definitions.filter(d=>this.provider(d,source)&&this.factory(d.type)).map(({type,label})=>({type,label}));
 }
 private provider(definition:typeof definitions[number],source:string):unknown{
  const app=this.app as HostApp;
  if(definition.type==='localgraph'){const core=app.internalPlugins?.plugins?.graph;return core?.enabled===true&&this.app.vault.getFileByPath(source)?.extension==='md'?core.instance:undefined;}
  return app.plugins?.plugins?.[definition.plugin];
 }
 private factory(type:string):((leaf:WorkspaceLeaf)=>NativeView)|undefined{return (this.app as HostApp).viewRegistry?.getViewCreatorByType?.(type);}
 sync(source:string,type?:string):void{
  if(this.disposed)return;this.source=source;
  const definition=definitions.find(d=>d.type===type),provider=definition?this.provider(definition,source):undefined,factory=provider&&definition?this.factory(definition.type):undefined;
  for(const [key,previous]of this.slots)if(key!==type||!factory||previous.provider!==provider){this.slots.delete(key);previous.section.remove();void this.close(previous).catch(()=>{});}
  if(!factory||!definition)return;
  let slot=this.slots.get(definition.type);
  if(!slot){
   const section=this.host.createDiv({attr:{'data-native-view':definition.type}}),inner=section.createDiv({cls:'em-native-host workspace-leaf'});
   slot={type:definition.type,provider,section,host:inner,closed:false,path:'',ready:Promise.resolve()};this.slots.set(definition.type,slot);
   const current=slot;slot.ready=this.mount(current,factory).catch(async error=>{try{await current.view?.close?.();}catch{ /* Native mount may already have released the component. */ }current.view=undefined;if(!current.closed){current.host.empty();current.host.createDiv({text:'Native Ansicht konnte nicht geladen werden: '+errorMessage(error),cls:'em-muted em-caption',attr:{role:'status'}});}});
  }
  if(slot.type==='localgraph'&&slot.path!==source){slot.path=source;const current=slot;void slot.ready.then(async()=>{if(current.view&&!current.closed&&current.path===this.source){await current.view.setState({file:current.path},{history:false});this.centerLocal(current);}}).catch(error=>{if(!current.closed){current.host.empty();current.host.createDiv({text:'Lokaler Graph konnte nicht auf die aktuelle Notiz gesetzt werden: '+errorMessage(error),cls:'em-muted em-caption',attr:{role:'status'}});}});}
 }
 /** Once after layout settles, frame the current note at a readable native scale. Never a recurring zoom lock. */
 private centerLocal(slot:Slot):void{
  if(slot.zoomTimer)window.clearTimeout(slot.zoomTimer);let attempts=0;const source=slot.path;
  const center=()=>{
   if(slot.closed||source!==slot.path)return;slot.view?.onResize();
   const renderer=(slot.view as NativeView&{renderer?:{nodes?:{id:string;x:number;y:number}[];width:number;height:number;targetScale:number;setScale?(scale:number):void;setPan?(x:number,y:number):void;changed?():void}})?.renderer;
   const node=renderer?.nodes?.find(n=>n.id===source);
   if(renderer?.setScale&&renderer.setPan&&node&&Number.isFinite(node.x)&&renderer.width>0){const ratio=slot.host.ownerDocument.defaultView?.devicePixelRatio??1;renderer.targetScale=1;renderer.setScale(1);renderer.setPan(renderer.width*ratio/2-node.x,renderer.height*ratio/2-node.y);renderer.changed?.();return;}
   if(++attempts<30)slot.zoomTimer=window.setTimeout(center,100);
  };slot.zoomTimer=window.setTimeout(center,450);
 }
 private facade(slot:Slot):WorkspaceLeaf{
  const events=new Events(),values=new Map<PropertyKey,unknown>(),owner=this.owner,app=this.app;
  const mainOpen=async(file:TFile,state?:OpenViewState)=>{const leaf=this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit)??this.app.workspace.getLeaf('tab');await leaf.openFile(file,state??{active:true});};
  const facade=new Proxy(owner,{
   get(target,key):unknown{
    if(values.has(key))return values.get(key);
    switch(key){
     case 'containerEl':return slot.host;case 'view':return slot.view;
     case 'history':return {backHistory:[],forwardHistory:[]};
     case 'updateHeader':return ()=>{};case 'isVisible':return ()=>!slot.closed&&slot.host.getBoundingClientRect().width>0;
     case 'on':return events.on.bind(events);case 'off':return events.off.bind(events);case 'offref':return events.offref.bind(events);case 'trigger':return events.trigger.bind(events);
     case 'getViewState':return ()=>({type:slot.type,state:slot.view?.getState()??{}});
     case 'setViewState':return async(state:ViewState)=>{if(state.type===slot.type)await slot.view?.setState(state.state??{},{history:false});else await app.workspace.getLeaf('tab').setViewState(state);};
     case 'openFile':return mainOpen;case 'detach':return ()=>{};
    }
    const value:unknown=Reflect.get(target,key,target);return typeof value==='function'?(value as (...args:unknown[])=>unknown).bind(target):value;
   },set(_target,key,value:unknown){values.set(key,value);return true;},
  });
  return facade;
 }
 private async mount(slot:Slot,factory:(leaf:WorkspaceLeaf)=>NativeView):Promise<void>{
  slot.leaf=this.facade(slot);const view=slot.view=factory(slot.leaf);
  if(typeof view.open!=='function'||typeof view.close!=='function')throw new Error('Diese Obsidian-Version unterstützt den benötigten View-Lebenszyklus nicht.');
  await view.open(slot.host);if(slot.closed)return;
  slot.observer=new ResizeObserver(()=>{if(!slot.closed)view.onResize();});slot.observer.observe(slot.host);view.onResize();
 }
 resize():void{for(const slot of this.slots.values())if(!slot.closed)slot.view?.onResize();}
 private async close(slot:Slot):Promise<void>{
  slot.closed=true;if(slot.zoomTimer)window.clearTimeout(slot.zoomTimer);slot.observer?.disconnect();await slot.ready;try{await slot.view?.close?.();}finally{slot.section.remove();}
 }
 async destroy():Promise<void>{this.disposed=true;const slots=[...this.slots.values()];this.slots.clear();await Promise.allSettled(slots.map(slot=>this.close(slot)));}
}
