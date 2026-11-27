import type {Settings} from '../types';
import {locale,t} from '../i18n';
import {outlineRules} from './outline-rules';
import type {OutlineRules} from './model';
import {companionStorageDefaults} from './preferences';
import {parseCharacterTarget,validCharacterTarget} from './character-target';

export function validMarkerLevel(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=6;}
export function validMarkerInterval(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=300;}
export function markerHeadingLevel(settings:Settings):number{return validMarkerLevel(settings.companion?.markerHeadingLevel)?settings.companion.markerHeadingLevel:6;}
export function markerRefreshSeconds(settings:Settings):number{return validMarkerInterval(settings.companion?.markerRefreshSeconds)?settings.companion.markerRefreshSeconds:5;}
export function defaultOutlineRules(settings:Settings):OutlineRules{return outlineRules(settings.companion?.outlineDefaults);}
export function defaultCharacterTarget(settings:Settings):number|undefined{const target=settings.companion?.defaultCharacterTarget;return validCharacterTarget(target)?target:undefined;}
export function validateOutlinePreferences(settings:Settings):void{
 const value=settings.companion;if(!value)return;
 if(value.markerHeadingLevel!==undefined&&!validMarkerLevel(value.markerHeadingLevel)||value.markerRefreshSeconds!==undefined&&!validMarkerInterval(value.markerRefreshSeconds))throw new Error(t('companion.invalidMarkerPreference'));
 if(value.defaultCharacterTarget!==undefined&&!validCharacterTarget(value.defaultCharacterTarget))throw new Error(t('companion.invalidCharacterTarget'));
 if(value.outlineDefaults!==undefined)outlineRules(value.outlineDefaults);
}
const fields={companion_defaultMarkers:'outlineDefaults',companion_defaultIgnoredHeadings:'outlineDefaults',companion_markerHeadingLevel:'markerHeadingLevel',companion_markerRefreshSeconds:'markerRefreshSeconds',companion_defaultCharacterTarget:'defaultCharacterTarget'} as const;
export type OutlineControlKey=keyof typeof fields;
export function isOutlineControl(key:string):key is OutlineControlKey{return Object.prototype.hasOwnProperty.call(fields,key);}
export function outlineControlValue(settings:Settings,key:OutlineControlKey):string{
 if(key==='companion_defaultMarkers')return defaultOutlineRules(settings).markers.join('\n');
 if(key==='companion_defaultIgnoredHeadings')return defaultOutlineRules(settings).ignore.join('\n');
 if(key==='companion_markerHeadingLevel')return String(markerHeadingLevel(settings));
 if(key==='companion_markerRefreshSeconds')return String(markerRefreshSeconds(settings));
 return defaultCharacterTarget(settings)?.toString()??'';
}
/** Parse one field against the latest settings; queued edits never overwrite another field. */
export function outlineControlChange(settings:Settings,key:OutlineControlKey,value:string){
 const previous=settings.companion,field=fields[key];let next:unknown;
 if(field==='outlineDefaults'){
  const part=key==='companion_defaultMarkers'?'markers':'ignore',lines=value.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);next=outlineRules({...defaultOutlineRules(settings),[part]:lines});
 }else if(field==='defaultCharacterTarget')next=parseCharacterTarget(value,locale());
 else{const number=Number(value);if(!/^\d+$/u.test(value)||(field==='markerHeadingLevel'?!validMarkerLevel(number):!validMarkerInterval(number)))throw new Error(t('companion.invalidMarkerPreference'));next=number;}
 const companion={...previous,storage:companionStorageDefaults(settings),[field]:next};
 return {field,previous:previous?.[field],value:next,companion};
}
