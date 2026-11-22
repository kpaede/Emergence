import {parseDocument,isMap} from 'yaml';
import {t} from '../i18n';
import {emptyCompanion,parseCompanion,serializeCompanion} from './codec';
import {encodeOutlineText,markMultiline,multilineOutline} from './multiline';
import type {CompanionDocument,CompanionSection} from './model';

export interface ChapterFilePlan{index:string;section:string;path:string;before:string;after:string;kind:'existing'|'outline'|'text';title:string}
export function noteParts(text:string):{header:string;body:string}{
 if(!/^---\r?\n/u.test(text))return {header:'',body:text};
 const match=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/u.exec(text);if(!match)throw new Error(t('companion.invalid'));
 const yaml=parseDocument(match[1]!);if(yaml.errors.length||yaml.contents!==null&&!isMap(yaml.contents))throw new Error(t('companion.invalid'));return {header:match[1]!,body:text.slice(match[0].length)};
}
export function hasCompanionMetadata(text:string):boolean{
 const {header}=noteParts(text),yaml=parseDocument(header);
 return ['emergence-companion-id','emergence-companion-version','emergence-companion-role','emergence-parent-companion-id','emergence-main-document','emergence-section-files','emergence-storage','emergence-sections'].some(key=>yaml.has(key));
}
/** A matching chapter can be relinked. Ordinary Markdown is converted only after a preview. */
export function prepareChapterFile(index:string,doc:CompanionDocument,section:CompanionSection,path:string,before:string):ChapterFilePlan{
 if(hasCompanionMetadata(before)){
  const part=parseCompanion(before),yaml=parseDocument(part.header);
  if(yaml.get('emergence-companion-role')!=='section'||yaml.get('emergence-parent-companion-id')!==doc.id||part.sections.length!==1||part.sections[0]?.id!==section.id)throw new Error(t('companion.chapterFileBelongsElsewhere'));
  return {index,section:section.id,path,before,after:before,kind:'existing',title:section.title};
 }
 const {header,body}=noteParts(before),yaml=parseDocument(header),version:unknown=yaml.get('eome-outline-format');
 if(yaml.has('eome-outline-format')&&version!==2&&version!=='2')throw new Error(t('companion.nativeFormatUnsupported'));
 let raw='',kind:ChapterFilePlan['kind']='text';
 if(version===2||version==='2'){
  try{multilineOutline(body,false);raw=markMultiline(body,false);kind='outline';}catch{/* A standalone note with headings remains one complete thought. */}
 }
 if(kind==='text'&&body)raw=markMultiline(encodeOutlineText(body),false);
 const part=emptyCompanion(doc.source);part.header=header;part.newline=before.includes('\r\n')?'\r\n':'\n';part.sections=[{...structuredClone(section),format:2,raw}];
 const metadata=parseDocument(part.header);metadata.set('emergence-companion-role','section');metadata.set('emergence-parent-companion-id',doc.id);part.header=metadata.toString({lineWidth:0});
 return {index,section:section.id,path,before,after:serializeCompanion(part),kind,title:section.title};
}
