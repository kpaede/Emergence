import type {Settings} from '../types';
import {DEFAULT_PATTERN} from './patterns';
import {starter,sourceInsertion,editSection} from './source';
import {t} from '../i18n';
import {LAWS} from './render/laws';

/** One creation preference; each existing diagram carries its format in Markdown. */
export type TetradFormat = 'bold'|'headings-1'|'headings-2'|'headings-3'|'headings-4'|'headings-5'|'headings-6';
export function validTetradFormat(value:unknown):value is TetradFormat {
 return typeof value==='string'&&/^(?:bold|headings-[1-6])$/u.test(value);
}
export function defaultTetradFormat(settings:Pick<Settings,'tetrad'>):TetradFormat {
 return settings.tetrad?.format??'headings-2';
}
function creation(format:TetradFormat){
 return {pattern:{...DEFAULT_PATTERN,level:format==='bold'?2:Number(format.slice(-1))},format:format==='bold'?'bold' as const:'headings' as const};
}
export function newTetrad(format:TetradFormat,title?:string):string {
 const options=creation(format);let source=starter(options.pattern,title,options.format,'');for(const law of LAWS)source=editSection(source,options.pattern,law.id,options.pattern.headings[law.id]+'\n\n'+t('tetrad.glossPlaceholder'));return source;
}
export function insertTetrad(before:string,after:string,title:string,format:TetradFormat){
 const source=newTetrad(format,title),insertion=sourceInsertion(before,after,source);return {...insertion,titleOffset:insertion.sourceOffset+source.indexOf(']')+2};
}
