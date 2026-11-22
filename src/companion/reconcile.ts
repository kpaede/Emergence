import {newId,type CompanionDocument,type CompanionSection,type SourceHeading} from './model';
import {sourceHeadings} from './headings';
export interface ReconcileResult {document:CompanionDocument;changed:boolean;review:number}
/** Titles and positions are evidence, never permanent identities. Ambiguous old sections retain all their raw notes. */
export function reconcile(document:CompanionDocument,source:string,tracked?:ReadonlyMap<string,number>,nativeHeadings?:SourceHeading[]):ReconcileResult{
 const headings=nativeHeadings??sourceHeadings(source),old=document.sections.filter(s=>s.state!=='general'&&s.state!=='detached'),remaining=new Set(headings.map((_,i)=>i)),matches=new Map<string,number>();
 const assign=(section:CompanionSection,index:number)=>{matches.set(section.id,index);remaining.delete(index);};
 const unique=(key:(h:SourceHeading)=>string,filter:(s:CompanionSection)=>boolean=()=>true)=>{
  const available=new Map<string,number[]>(),previous=new Map<string,CompanionSection[]>();
  for(const i of remaining){const value=key(headings[i]!);if(value){const list=available.get(value)??[];list.push(i);available.set(value,list);}}
  for(const section of old)if(!matches.has(section.id)&&section.base){const value=key(section.base);if(value){const list=previous.get(value)??[];list.push(section);previous.set(value,list);}}
  for(const [value,sections]of previous){const candidates=available.get(value);if(sections.length===1&&candidates?.length===1&&filter(sections[0]!))assign(sections[0]!,candidates[0]!);}
 };
 if(tracked){const positions=new Map(headings.map((h,i)=>[h.from,i]));for(const section of old){const from=tracked.get(section.id),index=from===undefined?undefined:positions.get(from);if(index!==undefined&&remaining.has(index))assign(section,index);}}
 const titleCounts=new Map<string,number>();for(const section of old)if(section.base)titleCounts.set(section.base.title,(titleCounts.get(section.base.title)??0)+1);

 unique(h=>JSON.stringify([h.title,h.level,h.body]),s=>!!s.base?.body);
 unique(h=>h.title, s=>titleCounts.get(s.base?.title??'')===1);
 unique(h=>h.body,s=>!!s.base?.body);
 // A single heading-line replacement with unchanged order/neighbours is an ordinary rename.
 const missing=old.filter(s=>!matches.has(s.id));
 if(missing.length===1&&remaining.size===1&&headings.length===old.filter(s=>s.state==='linked').length){
  const section=missing[0]!,index=[...remaining][0]!;
  if(section.base?.index===index&&section.base.level===headings[index]!.level&&section.base.body===headings[index]!.body){
   const before=old.find(s=>s.base?.index===index-1),after=old.find(s=>s.base?.index===index+1);
   if((!before||matches.get(before.id)===index-1)&&(!after||matches.get(after.id)===index+1))assign(section,index);
  }
 }
 const next:CompanionSection[]=[],byIndex=new Map<number,CompanionSection>();
 for(const section of old){const index=matches.get(section.id);if(index!==undefined)byIndex.set(index,section);}
 for(let index=0;index<headings.length;index++){
  const heading=headings[index]!,previous=byIndex.get(index),section:CompanionSection=previous?{...previous}:{id:newId(),title:heading.title,level:heading.level,state:'linked',raw:document.newline};
  next.push({...section,title:heading.title,level:heading.level,state:'linked',base:{...heading,index}});
 }
 for(const section of document.sections){
  if(section.state==='general'||section.state==='detached')next.push(section);
  else if(!matches.has(section.id))next.push({...section,state:'review'});
 }
 // Positions alone changing must not write the companion on every ordinary paragraph edit.
 const semantic=(sections:CompanionSection[])=>JSON.stringify(sections.map(s=>[s.id,s.title,s.level,s.state,s.raw,s.base?.index,s.base?.parent]));
 const changed=semantic(document.sections)!==semantic(next);
 return {document:{...document,sections:next},changed,review:next.filter(s=>s.state==='review').length};
}
