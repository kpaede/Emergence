import {Component} from 'obsidian';
import {t} from '../i18n';
import {companionLayout,defaultCompanionLayout,type CompanionLayout} from './layout';

/** Host-owned layout. Native editors react through their existing resize observers. */
export class CompanionSplit extends Component {
 readonly handle:HTMLElement;private value:CompanionLayout;private drag?:{id:number;rect:DOMRect};private observer:ResizeObserver;
 constructor(private host:HTMLElement,content:HTMLElement,initial:CompanionLayout,private persist:(value:CompanionLayout)=>void){
  super();this.value=companionLayout(initial);this.handle=host.createDiv({cls:'em-companion-divider',attr:{role:'separator',tabindex:'0','aria-label':t('companion.resizeOutline')}});host.insertBefore(this.handle,content);this.apply();
  this.observer=new ResizeObserver(()=>this.apply());this.observer.observe(host);this.register(()=>this.observer.disconnect());
  this.registerDomEvent(this.handle,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();this.drag={id:event.pointerId,rect:host.getBoundingClientRect()};this.handle.setPointerCapture(event.pointerId);this.host.addClass('is-resizing');});
  this.registerDomEvent(this.handle,'pointermove',event=>{if(this.drag?.id!==event.pointerId)return;const r=this.drag.rect;if(this.wide)this.value.outlineWidth=event.clientX-r.left;else this.value.outlineRatio=(event.clientY-r.top)/r.height;this.apply();});
  const finish=()=>{if(!this.drag)return;this.drag=undefined;this.host.removeClass('is-resizing');this.persist({...this.value});};
  this.registerDomEvent(this.handle,'pointerup',finish);this.registerDomEvent(this.handle,'pointercancel',finish);this.registerDomEvent(this.handle,'lostpointercapture',finish);
  this.registerDomEvent(this.handle,'keydown',event=>{const keys=this.wide?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(event.key==='Home'){event.preventDefault();this.value=defaultCompanionLayout();}else if(keys.includes(event.key)){event.preventDefault();const direction=event.key===keys[0]?-1:1;if(this.wide)this.value.outlineWidth+=direction*16;else this.value.outlineRatio+=direction*.05;}else return;this.apply();this.persist({...this.value});});
  this.registerDomEvent(this.handle,'dblclick',()=>{this.value=defaultCompanionLayout();this.apply();this.persist({...this.value});});
 }
 setPreferences(value:CompanionLayout):void{this.value=companionLayout(value);this.apply();}
 private get wide():boolean{return this.host.clientWidth>=850;}
 setCollapsed(collapsed:boolean):void{this.host.toggleClass('is-outline-collapsed',collapsed);this.handle.hidden=collapsed;}
 refreshLanguage():void{this.handle.setAttribute('aria-label',t('companion.resizeOutline'));}
 private apply():void{
  this.value=companionLayout(this.value);this.host.style.setProperty('--em-outline-height',this.value.outlineRatio*100+'%');this.host.style.setProperty('--em-outline-width',this.value.outlineWidth+'px');
  this.handle.setAttribute('aria-orientation',this.wide?'vertical':'horizontal');this.handle.setAttribute('aria-valuemin',this.wide?'180':'20');this.handle.setAttribute('aria-valuemax',this.wide?'400':'65');this.handle.setAttribute('aria-valuenow',String(Math.round(this.wide?this.value.outlineWidth:this.value.outlineRatio*100)));
 }
}
