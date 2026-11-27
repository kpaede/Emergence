import {Component} from 'obsidian';
import type {CompanionService} from './service';
import type {CompanionNavigation} from './navigation';
import type {OutlineSizeMode} from './outline-size';

/** Update only the number and bar DOM; never reload a companion or its entry editor. */
export class OutlineSizeDisplay extends Component {
 private path='';private mode:OutlineSizeMode='off';private options='';private target?:number;private markers=false;private markerSignature='';private markerDirty=false;private markerLast?:number;private markerTimer?:number;private markerInterval=5000;private unsubscribe?:()=>void;private timer?:number;private queuedAt?:number;private revision:number|undefined=-1;
 constructor(private service:CompanionService,private navigation:CompanionNavigation,private showTotal:(characters:number|undefined,target?:number)=>void=()=>{}){super();this.register(()=>{this.cancel();this.unsubscribe?.();this.unsubscribe=undefined;this.showTotal(undefined);});}
 render(path:string,active:boolean):void{
  const mode=active&&path?this.service.outlineSizeMode():'off',target=active&&path?this.service.characterTarget(path):undefined,markers=!!(active&&path&&this.navigation.hasMarkers);if(mode==='off'&&target===undefined&&!markers){this.cancel();this.unsubscribe?.();this.unsubscribe=undefined;this.path='';this.showTotal(undefined);if(this.mode!=='off'||this.revision!==this.navigation.revision)this.navigation.setSizes(undefined,'off');if(this.markers)this.navigation.setMarkerPositions(new Map());this.markers=false;this.markerDirty=false;this.markerSignature='';this.markerLast=undefined;this.revision=this.navigation.revision;this.mode='off';return;}
  const interval=this.service.markerRefreshMs?.()??5000,options=JSON.stringify(this.service.outlineCountOptions()),signature=markers?(this.navigation.markerSignature??'configured'):'',markerChanged=path!==this.path||signature!==this.markerSignature||markers!==this.markers,changed=markerChanged||mode!==this.mode||options!==this.options||target!==this.target||interval!==this.markerInterval;if(changed)this.cancel();this.path=path;this.mode=mode;this.options=options;this.target=target;this.markers=markers;this.markerSignature=signature;this.markerInterval=interval;if(markerChanged){this.markerDirty=markers;this.markerLast=undefined;}
  this.unsubscribe??=this.service.subscribeSourceSizes(source=>{if(source===this.service.pair(this.path)?.source){if(this.markers)this.markerDirty=true;this.schedule();}});if(changed||this.revision!==this.navigation.revision)this.refresh();
 }
 private schedule():void{
  this.refreshMarkers();if(this.mode==='off'&&this.target===undefined)return;
  const now=Date.now();this.queuedAt??=now;if(this.timer!==undefined)window.clearTimeout(this.timer);
  // Brief bursts settle together; sustained typing still updates within 600 ms.
  this.timer=window.setTimeout(()=>{this.timer=undefined;this.queuedAt=undefined;this.refresh();},Math.min(160,Math.max(0,600-(now-this.queuedAt))));
 }
 private refresh():void{
  if(!this.path)return;
  if(this.mode!=='off'||this.revision!==this.navigation.revision)this.navigation.setSizes(this.mode==='off'?undefined:this.service.sectionSizes(this.path,this.mode),this.mode,this.service.outlineCountOptions());
  if(this.mode!=='off'||this.target!==undefined){const characters=this.service.sourceCharacters(this.path);if(this.target===undefined)this.showTotal(characters);else this.showTotal(characters,this.target);}else this.showTotal(undefined);
  this.refreshMarkers();
  this.revision=this.navigation.revision;
 }
 private refreshMarkers():void{
  if(!this.markers||!this.markerDirty||!this.path)return;
  const remaining=this.markerLast===undefined?0:this.markerInterval-(Date.now()-this.markerLast);
  if(remaining>0){this.markerTimer??=window.setTimeout(()=>{this.markerTimer=undefined;this.refreshMarkers();},remaining);return;}
  const positions=this.service.markerPositions(this.path);if(!positions)return;
  this.navigation.setMarkerPositions(positions);this.markerDirty=false;this.markerLast=Date.now();if(this.markerTimer!==undefined)window.clearTimeout(this.markerTimer);this.markerTimer=undefined;
 }
 private cancel():void{if(this.timer!==undefined)window.clearTimeout(this.timer);if(this.markerTimer!==undefined)window.clearTimeout(this.markerTimer);this.timer=this.markerTimer=undefined;this.queuedAt=undefined;}
}
