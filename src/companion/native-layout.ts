import type {NativeView} from './native-types';

/** Native viewport units must refer to the embedded editor, including during mount. */
export function sizeNativeViewport(view:NativeView,stage:HTMLElement,reveal=false):void{
 stage.style.setProperty('--em-native-height',stage.clientHeight+'px');
 stage.style.setProperty('--em-native-width',stage.clientWidth+'px');
 view.cy?.resize();
 if(!reveal)return;
 if(view.getViewType()==='mindmap-view'){const graph=view.cy,first=graph?.nodes().first();if(graph&&first?.length){graph.center(first);const bounds=first.renderedBoundingBox();if(bounds.h>stage.clientHeight-64)graph.panBy({x:0,y:32-bounds.y1});}return;}
 if(view.getViewType()!=='lineage')return;
 const document=view.viewStore?.getValue().document as {activeNode?:string}|undefined,id=document?.activeNode;
 if(!id)return;
 const card=stage.querySelector<HTMLElement>('#'+CSS.escape(id)),column=card?.closest<HTMLElement>('.column'),viewport=view.container;
 if(!card||!column||!viewport)return;
 const bounds=viewport.getBoundingClientRect(),rect=card.getBoundingClientRect(),zoom=Number.parseFloat(getComputedStyle(card).getPropertyValue('--zoom-level'))||1;
 // The original aligner schedules a frame, which may pause in a background window.
 // Bootstrap a visible position synchronously; subsequent navigation uses its aligner.
 column.scrollTop+=(rect.top-bounds.top-Math.max(45,(bounds.height-rect.height)/2))/zoom;
 if(rect.left<bounds.left)viewport.scrollLeft+=(rect.left-bounds.left)/zoom;
 else if(rect.right>bounds.right)viewport.scrollLeft+=(rect.right-bounds.right)/zoom;
}
