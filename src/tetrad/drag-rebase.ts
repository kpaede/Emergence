import {t} from '../i18n';
import {tetradEntries} from './entries';
import type {TetradPattern} from './patterns';
import {parseSource} from './source';
import type {LawId} from './render/laws';

/** In-memory record of this editor's accepted change during a pointer gesture. */
export interface AcceptedTetradEdit{source:string;law?:LawId;at?:number;inserted?:boolean}
export function rebaseTetradDrop(original:string,current:string,pattern:TetradPattern,from:LawId,index:number,to:LawId,slot:number,edit?:AcceptedTetradEdit,newEntry=false):{index:number;slot:number;count?:number}{
 if(current===original)return {index,slot,...newEntry?{count:0}:{}};
 if(current!==edit?.source)throw new Error(t('tetrad.conflict'));
 if(edit.law===undefined||edit.at===undefined)return {index,slot};
 const before=tetradEntries(parseSource(original,pattern).sections.get(edit.law)?.body??''),after=tetradEntries(parseSource(current,pattern).sections.get(edit.law)?.body??''),coreAdded=!before.core&&after.core?1:0,delta=after.entries.length-before.entries.length-coreAdded;
 if(newEntry&&(!edit.inserted||edit.law!==from||edit.at!==index))throw new Error(t('tetrad.conflict'));
 const own=from===edit.law&&index===edit.at,count=newEntry?delta:own&&!edit.inserted?1+delta:1;
 const shiftedIndex=from===edit.law?index+coreAdded+(!newEntry&&(edit.inserted?index>=edit.at:index>edit.at)?delta:0):index;
 if(!newEntry&&from===edit.law&&(edit.inserted||index!==edit.at)&&before.entries[index]?.markdown!==after.entries[shiftedIndex]?.markdown)throw new Error(t('tetrad.conflict'));
 // A new row is mounted immediately before its existing gap. In the upper
 // wings that gap remains on the core side; below it follows the new row.
 const upper=to==='enhances'||to==='reverses',shiftSlot=slot>edit.at||!!edit.inserted&&!upper&&slot===edit.at;
 return {index:shiftedIndex,slot:to===edit.law?slot+coreAdded+(shiftSlot?delta:0):slot,...count!==1?{count:Math.max(0,count)}:{}};
}
