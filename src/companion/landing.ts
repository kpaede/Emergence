import {t} from '../i18n';
import type {PairState,StorageOptions} from './model';

export type LandingState='empty'|'missing'|'unreadable'|'missingSection'|'multiple'|'noSource';
interface LandingActions {create:()=>void;choose:()=>void;retry:()=>void;open:()=>void;missingFiles:()=>void;select:(path:string)=>void;changeLayout:(mode:StorageOptions['mode'])=>void}
/** Actionable connection states; editor errors never leave the user at a dead end. */
export function renderCompanionLanding(host:HTMLElement,state:LandingState,source:string,path:string,choices:PairState[],actions:LandingActions,mode:StorageOptions['mode'],canOpen:boolean,detail?:string):void{
 host.empty();host.dataset.state=state;
 host.createEl('h3',{text:t(`companion.start.${state}`)});
 host.createEl('p',{text:t(`companion.start.${state}Help`)});
 if(source)host.createDiv({text:t('companion.mainPath',{path:source}),cls:'em-companion-start-path'});
 if(path&&(state==='missing'||state==='unreadable'||state==='missingSection'))host.createDiv({text:t('companion.companionPath',{path}),cls:'em-companion-start-path'});
 for(const choice of choices){const button=host.createEl('button',{cls:'em-companion-start-choice',text:choice.path.replace(/\.md$/u,''),attr:{'data-companion-path':choice.path}});button.onclick=()=>actions.select(choice.path);}
 const layout=host.createEl('label',{cls:'em-companion-layout-choice'});layout.createSpan({text:t('companion.newLayout')});const select=layout.createEl('select',{attr:{'data-companion-control':'mode'}});for(const [value,key]of [['document','companion.oneDocument'],['sections','companion.perHeading']] as const)select.createEl('option',{value,text:t(key)});select.value=mode;select.onchange=()=>actions.changeLayout(select.value==='sections'?'sections':'document');host.createEl('p',{text:t('companion.layoutLocked'),cls:'em-companion-start-hint'});
 const tools=host.createDiv({cls:'em-companion-start-actions'});
 const create=tools.createEl('button',{text:t('companion.create'),cls:'mod-cta',attr:{'data-companion-action':'create'}});create.onclick=actions.create;
 const choose=tools.createEl('button',{text:t('companion.selectExisting'),attr:{'data-companion-action':'choose'}});choose.onclick=actions.choose;
 if(state==='missing'||state==='unreadable'||state==='missingSection'){const retry=tools.createEl('button',{text:t('companion.retry'),attr:{'data-companion-action':'retry'}});retry.onclick=actions.retry;}
 if(canOpen&&state==='unreadable'){const open=tools.createEl('button',{text:t('companion.inspectExisting'),attr:{'data-companion-action':'open'}});open.onclick=actions.open;}
 if(canOpen&&state==='missingSection'){const missing=tools.createEl('button',{text:t('companion.showMissingFiles'),attr:{'data-companion-action':'missing-files'}});missing.onclick=actions.missingFiles;}
 if(detail&&(state==='unreadable'||state==='missingSection')){const details=host.createEl('details');details.createEl('summary',{text:t('companion.problemDetails')});details.createEl('p',{text:detail});}
}
