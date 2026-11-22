import type {Core} from 'cytoscape';
import type {App,Component,TFile,WorkspaceLeaf} from 'obsidian';
export type CompanionViewMode='eome'|'lineage'|'reader';
export const companionViews=['reader','eome','lineage'] as const;
export type NativeKind='eome'|'lineage';
export const nativePlugins={eome:{id:'excerpt-outline-mindmap-editor',type:'mindmap-view',name:'EOME'},lineage:{id:'lineage',type:'lineage',name:'Lineage'}} as const;
export interface NativeOption{path:string;section:string;kind:NativeKind;header:string}
export interface NativeStore{getValue():Record<string,unknown>;dispatch(action:Record<string,unknown>):void;subscribe?(fn:()=>void):()=>void;set?(value:Record<string,unknown>):void;reducer?:unknown;onError?:unknown;constructor:unknown}
export interface NativePlugin{app:App;settings?:NativeStore;store?:NativeStore;statusBar?:unknown;[key:string]:unknown}
export interface NativeView extends Component{
 app:App;leaf:WorkspaceLeaf;file:TFile|null;data:string;containerEl:HTMLElement;contentEl:HTMLElement;plugin?:NativePlugin;
 supportsStructuralHeadings?:boolean;
 selectedNodeLines?:Set<number>;getFlatNodes?():{line:number;isHeading?:boolean}[];selectNode?(line:number):void;
 getViewType():string;getViewData():string;setViewData(text:string,clear:boolean):void;onOpen():Promise<void>;onLoadFile?(file:TFile):Promise<void>;onClose():Promise<void>;requestSave:()=>void;save:()=>Promise<void>;
 frontmatterStorage?:{app:App};commandHistory?:{app:App;maxContentLength?:number;clear?():void};forceToolbarUpdate?():void;cy?:Core;draw?:()=>Promise<void>;inlineEditor?:{nodeId?:string|null;unloadNode(id?:string,discard?:boolean):void;getEditor?():{getValue():string}|undefined};saveDocument?:()=>Promise<void>;executeUndo?:()=>Promise<void>;executeRedo?:()=>Promise<void>;
 container?:HTMLElement|null;alignBranch?:{align(action:{type:string}):void};component?:unknown;documentStore?:NativeStore;viewStore?:NativeStore;
}
export interface NativeRuntimeApp extends App{
 plugins:{plugins:Record<string,NativePlugin|undefined>;manifests:Record<string,unknown>;enablePluginAndSave(id:string):Promise<void>};
 viewRegistry:{getViewCreatorByType(type:string):((leaf:WorkspaceLeaf)=>NativeView)|undefined};
}
