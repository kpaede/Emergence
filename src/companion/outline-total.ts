import {Component} from 'obsidian';
import {locale,t} from '../i18n';
import type {CharacterCountOptions} from './character-count';
import {countPolicyLabel} from './count-label';

/** One compact total; a configured goal supplies the progress bar's fixed denominator. */
export class OutlineTotal extends Component{
 readonly root:HTMLElement;private button:HTMLButtonElement;private track:HTMLElement;private fill:HTMLElement;
 constructor(parent:HTMLElement,edit:()=>void){super();this.root=parent.createSpan({cls:'em-companion-outline-total'});this.root.hidden=true;this.button=this.root.createEl('button',{cls:'em-companion-total-button'});this.button.onclick=edit;this.track=this.root.createSpan({cls:'em-companion-total-track',attr:{role:'progressbar','aria-valuemin':'0'}});this.fill=this.track.createSpan({cls:'em-companion-total-fill'});this.track.hidden=true;this.register(()=>this.root.remove());}
 render(characters:number|undefined,target:number|undefined,options:CharacterCountOptions):void{
  this.root.hidden=characters===undefined;if(characters===undefined){this.button.empty();this.root.removeAttribute('aria-label');delete this.root.dataset.emCharacters;delete this.root.dataset.emCharacterTarget;this.track.hidden=true;return;}
  const format=new Intl.NumberFormat(locale()),count=format.format(characters),goal=target===undefined?undefined:format.format(target),label=goal?t('companion.documentTargetSize',{count,target:goal}):t('companion.documentSize',{count});if(this.button.textContent!==label)this.button.setText(label);
  this.root.dataset.emCharacters=String(characters);const description=t('companion.documentSizeLabel',{count})+' · '+countPolicyLabel(options);this.root.setAttribute('aria-label',description);this.button.setAttribute('aria-label',description+' · '+(goal?t('companion.characterTargetCurrent',{target:goal}):t('companion.characterTarget')));
  this.track.hidden=target===undefined;if(target!==undefined){const percentage=characters/target*100;this.fill.style.width=Math.max(0,Math.min(100,percentage))+'%';this.track.setAttribute('aria-valuemax',String(target));this.track.setAttribute('aria-valuenow',String(Math.min(characters,target)));this.track.setAttribute('aria-valuetext',t('companion.characterTargetProgress',{count,target:goal!,percentage:new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(percentage)}));this.track.setAttribute('aria-label',t('companion.characterTarget'));this.root.dataset.emCharacterTarget=String(target);}else delete this.root.dataset.emCharacterTarget;
 }
}
