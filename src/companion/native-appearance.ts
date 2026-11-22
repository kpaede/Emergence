import type {NativeView} from './native-types';

/** Native CSS variables and Cytoscape's public stylesheet API bridge host appearance. */
export function applyNativeAppearance(view:NativeView,host:HTMLElement):void{
 if(view.getViewType()==='lineage'){
  const options=view.plugin?.settings?.getValue().view as {minimumCardHeight?:unknown}|undefined,height=options?.minimumCardHeight;
  // Lineage stores this preference but does not apply it on mount. Use its CSS contract.
  if(typeof height==='number'&&Number.isFinite(height)&&height>=24)view.containerEl.style.setProperty('--min-node-height',height+'px');
  return;
 }
 const graph=view.getViewType()==='mindmap-view'?view.cy:undefined;if(!graph)return;
 const color=host.ownerDocument.defaultView!.getComputedStyle(host).color;
 graph.style().selector('edge').style({'line-color':color,opacity:.55}).update();
}
