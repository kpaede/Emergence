import {parseDocument} from 'yaml';
import {t} from '../i18n';
import type {CompanionDocument,NavigationHeading,OutlineRules,SourceHeading} from './model';

export const OUTLINE_RULES='emergence-outline';
export function headingName(value:string):string{return value.trim().replace(/^#{1,6}[ \t]+/u,'').replace(/[ \t]+#+[ \t]*$/u,'').trim().normalize('NFC');}
export function outlineRules(value:unknown):OutlineRules{
 if(value===undefined)return {ignore:[],markers:[]};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(t('companion.invalidOutlineRules'));
 const item=value as Record<string,unknown>;
 const names=(key:string):string[]=>{const list=item[key];if(list===undefined)return [];if(!Array.isArray(list)||list.some(name=>typeof name!=='string'||/[\r\n]/u.test(name)||!headingName(name)))throw new Error(t('companion.invalidOutlineRules'));return [...new Set((list as string[]).map(headingName))];};
 return {ignore:names('ignore'),markers:names('markers')};
}
export function withOutlineRules(document:CompanionDocument,value:OutlineRules):CompanionDocument{
 const rules=outlineRules(value);if(!document.header.trim()&&!rules.ignore.length&&!rules.markers.length)return {...document,outlineRules:rules};const yaml=parseDocument(document.header);if(yaml.errors.length)throw new Error(t('companion.invalidOutlineRules'));
 for(const key of ['ignore','markers'] as const){if(rules[key].length)yaml.setIn([OUTLINE_RULES,key],rules[key]);else if(yaml.hasIn([OUTLINE_RULES,key]))yaml.deleteIn([OUTLINE_RULES,key]);}
 const remaining=yaml.get(OUTLINE_RULES,true);if(remaining&&typeof remaining==='object'&&'items'in remaining&&Array.isArray(remaining.items)&&!remaining.items.length)yaml.delete(OUTLINE_RULES);
 return {...document,header:yaml.toString({lineWidth:0}),outlineRules:rules};
}
export function headingKinds(rules?:OutlineRules):(heading:SourceHeading)=>NavigationHeading['kind']{
 const ignored=new Set(rules?.ignore),markers=new Set(rules?.markers);
 return heading=>markers.has(headingName(heading.title))?'marker':ignored.has(headingName(heading.title))?'excluded':'section';
}
/** Navigation-only headings have transient keys. They never become stored sections. */
export function navigationOutline(document:CompanionDocument,headings:readonly SourceHeading[]):NavigationHeading[]{
 const kind=headingKinds(document.outlineRules),sections=new Map(document.sections.filter(s=>s.base&&(s.state==='linked'||s.state==='excluded')).map(s=>[s.base!.from,s])),stack:number[]=[];
 return headings.map((heading,index)=>{const role=kind(heading),section=sections.get(heading.from),matched=section?.title===heading.title&&section.level===heading.level?section:undefined;
  if(role!=='marker')while(stack.length&&headings[stack[stack.length-1]!]!.level>=heading.level)stack.pop();
  const entry:NavigationHeading={...heading,parent:stack.at(-1)??-1,key:role==='section'&&matched?.state==='linked'?matched.id:'heading-'+index,kind:role,...matched?{section:matched.id}:{}};
  if(role!=='marker')stack.push(index);return entry;
 });
}
export function documentOutline(document:CompanionDocument):NavigationHeading[]{
 if(document.outline)return document.outline;
 return document.sections.filter(s=>s.state==='linked'&&s.base).map(s=>({...s.base!,key:s.id,section:s.id,kind:'section'}));
}
