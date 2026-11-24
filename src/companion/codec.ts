import {parseDocument} from 'yaml';
import {t} from '../i18n';
import {newId,type CompanionDocument,type CompanionSection,type SectionBase,type SectionState} from './model';
import {stripThoughtIds} from './thoughts';
const SECTION=/^(#{1,6})[ \t]+(.*?)\s*<!-- em-section:([a-zA-Z0-9-]+) -->[ \t]*\r?$/gmu;
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function sourceLink(value:string):string{return value.replace(/^\[\[/u,'').replace(/\]\]$/u,'').replace(/\.md$/u,'')+'.md';}
export function parseCompanion(text:string):CompanionDocument{
 const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text);if(!match)throw new Error(t('companion.invalid'));
 const yaml=parseDocument(match[1]!);if(yaml.errors.length)throw new Error(t('companion.invalid'));const data=record(yaml.toJSON());
 if(typeof data['emergence-companion-id']!=='string'||typeof data['emergence-main-document']!=='string')throw new Error(t('companion.invalid'));
 const outlineFormat=data['eome-outline-format'];if(outlineFormat!==undefined&&outlineFormat!==2&&outlineFormat!=='2')throw new Error(t('companion.invalid'));
 const metadata=record(data['emergence-sections']),body=text.slice(match[0].length),matches=[...body.matchAll(SECTION)],sections:CompanionSection[]=[],ids=new Set<string>();
 for(let i=0;i<matches.length;i++){
  const m=matches[i]!,id=m[3]!,entry=record(metadata[id]);if(entry.format!==undefined&&entry.format!==2)throw new Error(t('companion.invalid'));if(ids.has(id))throw new Error(t('companion.duplicate'));ids.add(id);
  const state:SectionState=['linked','review','detached','general'].includes(String(entry.state))?entry.state as SectionState:'review';
  const b=record(entry.base);let base:SectionBase|undefined;
  if(typeof b.title==='string'&&typeof b.level==='number'&&typeof b.index==='number'&&typeof b.from==='number'&&typeof b.line==='number'&&typeof b.parent==='number'&&typeof b.body==='string')base={title:b.title,level:b.level,index:b.index,from:b.from,line:b.line,parent:b.parent,body:b.body};
  // Only old files explicitly marked as version 1 used stored entry comments.
  sections.push({id,plain:data['emergence-companion-version']!==1,title:m[2]!,level:m[1]!.length,state,base,...(entry.format===2||outlineFormat===2||outlineFormat==='2'?{format:2 as const}:{}),raw:body.slice(m.index+m[0].length, matches[i+1]?.index??body.length).replace(/^\r?\n/u,'')});
 }
 if(Object.keys(metadata).some(id=>!ids.has(id))||body.split(/\r?\n/u).some(line=>/^#{1,6}(?:[ \t]|$)/u.test(line)&&!/^#{1,6}[ \t]+.*<!-- em-section:[a-zA-Z0-9-]+ -->[ \t]*$/u.test(line)))throw new Error(t('companion.invalid'));
 const document:CompanionDocument={id:data['emergence-companion-id'],source:sourceLink(data['emergence-main-document']),sections,preamble:body.slice(0,matches[0]?.index??body.length),newline:text.includes('\r\n')?'\r\n':'\n',original:text,header:match[1]!};
 return document;
}
export function serializeCompanion(document:CompanionDocument):string{
 const yaml=parseDocument(document.header||'');if(yaml.errors.length)throw new Error(t('companion.invalid'));
 yaml.set('emergence-companion-id',document.id);yaml.delete('emergence-companion-version');yaml.set('emergence-main-document',`[[${document.source.replace(/\.md$/u,'')}]]`);
 const globalFormat=document.sections.length>0&&document.sections.every(s=>s.format===2);
 const metadata:Record<string,unknown>={};for(const s of document.sections)metadata[s.id]={state:s.state,...(s.format===2&&!globalFormat?{format:2}:{}),...s.base?{base:{title:s.base.title,level:s.base.level,index:s.base.index,from:s.base.from,line:s.base.line,parent:s.base.parent,body:s.base.body}}:{}};yaml.set('emergence-sections',metadata);
 if(globalFormat)yaml.set('eome-outline-format',2);else yaml.delete('eome-outline-format');
 const nl=document.newline,header=yaml.toString({lineWidth:0}).trimEnd().replace(/\r?\n/gu,nl),role=yaml.get('emergence-companion-role'),index=role==='index'||role!=='section'&&yaml.getIn(['emergence-storage','mode'])==='sections';
 return '---'+nl+header+nl+'---'+nl+document.preamble+document.sections.map((s,i)=>`${'#'.repeat(s.level)} ${s.title} <!-- em-section:${s.id} -->${nl}${(index?s.raw:stripThoughtIds(s)).replace(/\r?\n/gu,nl)}${i<document.sections.length-1&&s.raw&&!s.raw.endsWith('\n')?nl:''}`).join('');
}
export function emptyCompanion(source:string):CompanionDocument{return {id:newId(),source,sections:[],preamble:'',newline:'\n',original:'',header:''};}
export function sectionHeading(title:string):string {return title.replace(/[\r\n]/gu,' ');}
