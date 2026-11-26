import {Component} from 'obsidian';
import type {CompanionService} from './service';
import type {CompanionNavigation} from './navigation';
import type {OutlineSizeMode} from './outline-size';

/** Update only the number and bar DOM; never reload a companion or its entry editor. */
export class OutlineSizeDisplay extends Component {
 private path='';private mode:OutlineSizeMode='off';private options='';private target?:number;private unsubscribe?:()=>void;private timer?:number;private queuedAt?:number;private revision:number|undefined=-1;
 constructor(private service:CompanionService,private navigation:CompanionNavigation,private showTotal:(characters:number|undefined,target?:number)=>void=()=>{}){super();this.register(()=>{this.cancel();this.unsubscribe?.();this.unsubscribe=undefined;this.showTotal(undefined);});}
 render(path:string,active:boolean):void{
  const mode=active&&path?this.service.outlineSizeMode():'off',target=active&&path?this.service.characterTarget(path):undefined;if(mode==='off'&&target===undefined){this.cancel();this.unsubscribe?.();this.unsubscribe=undefined;this.path='';this.showTotal(undefined);if(this.mode!=='off'||this.revision!==this.navigation.revision)this.navigation.setSizes(undefined,'off');this.revision=this.navigation.revision;this.mode='off';return;}
  const options=JSON.stringify(this.service.outlineCountOptions()),changed=path!==this.path||mode!==this.mode||options!==this.options||target!==this.target;if(changed)this.cancel();this.path=path;this.mode=mode;this.options=options;this.target=target;
  this.unsubscribe??=this.service.subscribeSourceSizes(source=>{if(source===this.service.pair(this.path)?.source)this.schedule();});if(changed||this.revision!==this.navigation.revision)this.refresh();
 }
 private schedule():void{
  const now=Date.now();this.queuedAt??=now;if(this.timer!==undefined)window.clearTimeout(this.timer);
  // Brief bursts settle together; sustained typing still updates within 600 ms.
  this.timer=window.setTimeout(()=>{this.timer=undefined;this.queuedAt=undefined;this.refresh();},Math.min(160,Math.max(0,600-(now-this.queuedAt))));
 }
 private refresh():void{if(this.path&&(this.mode!=='off'||this.target!==undefined)){if(this.mode!=='off'||this.revision!==this.navigation.revision)this.navigation.setSizes(this.mode==='off'?undefined:this.service.sectionSizes(this.path,this.mode),this.mode,this.service.outlineCountOptions());const characters=this.service.sourceCharacters(this.path);if(this.target===undefined)this.showTotal(characters);else this.showTotal(characters,this.target);this.revision=this.navigation.revision;}}
 private cancel():void{if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;this.queuedAt=undefined;}
}
