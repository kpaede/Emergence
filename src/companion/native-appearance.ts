import type {NativeView} from './native-types';

/** Apply Lineage's saved minimum height, which its original mount leaves unapplied. */
export function applyNativeAppearance(view:NativeView):void{
 if(view.getViewType()!=='lineage')return;
 const options=view.plugin?.settings?.getValue().view as {minimumCardHeight?:unknown}|undefined,height=options?.minimumCardHeight;
 if(typeof height==='number'&&Number.isFinite(height)&&height>=24)view.containerEl.style.setProperty('--min-node-height',height+'px');
}
