import {t} from '../i18n';
import {nativePlugins,type NativeKind} from './native-types';

const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'?value as Record<string,unknown>:{};
export class NativeCompatibilityError extends Error{
 constructor(readonly kind:NativeKind,readonly missing:readonly string[],version?:string){
  super(t('companion.nativeIncompatible',{plugin:[nativePlugins[kind].name,version].filter(Boolean).join(' ')}));
  this.name='NativeCompatibilityError';
 }
}
export function assertNativePluginCompatible(value:unknown,kind:NativeKind,version?:string):void{
 if(kind!=='lineage')return;const plugin=record(value),missing:string[]=[];
 for(const name of ['settings','store']){
  const store=record(plugin[name]);
  for(const method of ['getValue','dispatch','subscribe','reducer'])if(typeof store[method]!=='function')missing.push(name+'.'+method);
  if(typeof store.constructor!=='function'||store.constructor===Object)missing.push(name+'.constructor');
 }
 if(missing.length)throw new NativeCompatibilityError(kind,missing,version);
}
/** Check only capabilities used by the host; newer plugin versions are not rejected solely for their version. */
export function assertNativeCompatible(value:unknown,kind:NativeKind,version?:string):void{
 const view=record(value),missing:string[]=[];
 const methods=(target:Record<string,unknown>,names:readonly string[],prefix='')=>{for(const name of names)if(typeof target[name]!=='function')missing.push(prefix+name);};
 methods(view,['getViewType','getViewData','setViewData','onOpen','onClose','load','unload','register','registerDomEvent']);
 const container=record(view.containerEl);if(!container.dataset||typeof container.remove!=='function')missing.push('containerEl');
 if(typeof view.getViewType==='function'){
  const getType=view.getViewType as ()=>unknown;
  try{if(getType.call(value)!==nativePlugins[kind].type)missing.push('getViewType');}catch{missing.push('getViewType');}
 }
 if(kind==='eome')methods(view,['onLoadFile']);
 else{
  methods(record(view.documentStore),['getValue','dispatch','set','subscribe'],'documentStore.');
  methods(record(view.viewStore),['getValue','dispatch'],'viewStore.');
 }
 if(missing.length)throw new NativeCompatibilityError(kind,missing,version);
}
