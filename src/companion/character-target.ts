import {parseDocument} from 'yaml';
import type {CompanionDocument} from './model';

export const CHARACTER_TARGET='emergence-character-target';
export function validCharacterTarget(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>0;}
export function withCharacterTarget(document:CompanionDocument,target:number|undefined):CompanionDocument{
 if(target!==undefined&&!validCharacterTarget(target))throw new Error('Invalid character target');
 const yaml=parseDocument(document.header);if(target===undefined)yaml.delete(CHARACTER_TARGET);else yaml.set(CHARACTER_TARGET,target);
 return {...document,header:yaml.toString({lineWidth:0}),targetCharacters:target};
}
/** Empty removes the target; grouped whole numbers use the current UI locale. */
export function parseCharacterTarget(value:string,language:string):number|undefined{
 let text=value.trim().replace(/[\s\u202f]/gu,'');if(!text)return;
 const group=new Intl.NumberFormat(language).formatToParts(1234567).find(part=>part.type==='group')?.value;
 if(!/^\d+$/u.test(text)){if(!group)throw new Error('Invalid character target');const escaped=group.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');if(!new RegExp('^\\d{1,3}(?:'+escaped+'\\d{3})+$','u').test(text))throw new Error('Invalid character target');text=text.split(group).join('');}
 const number=Number(text);if(!validCharacterTarget(number))throw new Error('Invalid character target');return number;
}
