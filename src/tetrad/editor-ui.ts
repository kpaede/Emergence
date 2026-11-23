import {t} from '../i18n';
import {Component} from 'obsidian';
import {LAWS} from './render/laws';

export function decorateTetrad(preview:HTMLElement):void{
 // The editor always uses the same four core and outer-text slots.
 for(const law of LAWS){const wing=preview.querySelector<HTMLElement>('.tetrader-'+law.id);if(!wing)continue;wing.hidden=false;wing.dataset.emLaw=law.id;wing.removeAttribute('tabindex');const glosses=wing.querySelector<HTMLElement>('.tetrader-glosses');if(glosses&&!glosses.querySelector('.tetrader-gloss')){const placeholder=glosses.createDiv({cls:'tetrader-gloss tetrader-placeholder',attr:{'data-em-placeholder':'true'}});placeholder.createEl('p',{text:t('tetrad.glossPlaceholder')});}}
}

export function tetradSplit(lifecycle:Component,root:HTMLElement,split:HTMLElement,divider:HTMLElement):void{
 let ratio=36;const resize=(value:number)=>{ratio=Math.max(20,Math.min(80,value));split.style.setProperty('--em-mm-split',ratio+'%');divider.setAttribute('aria-valuenow',String(ratio));};
 lifecycle.registerDomEvent(divider,'pointerdown',event=>{event.preventDefault();divider.setPointerCapture(event.pointerId);});
 lifecycle.registerDomEvent(divider,'pointermove',event=>{if(divider.hasPointerCapture(event.pointerId)){const r=split.getBoundingClientRect();resize(root.clientWidth>=720?(event.clientX-r.left)/r.width*100:(event.clientY-r.top)/r.height*100);}});
 lifecycle.registerDomEvent(divider,'pointerup',event=>{if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);});
 lifecycle.registerDomEvent(divider,'keydown',event=>{if(event.key.startsWith('Arrow')){event.preventDefault();resize(ratio+(['ArrowUp','ArrowLeft'].includes(event.key)?-5:5));}});
}
