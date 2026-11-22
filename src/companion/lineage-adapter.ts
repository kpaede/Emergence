import {multilineOutline,encodeOutlineText} from './multiline';
import {splitProjection} from './native-projection';
import type {NativeView,NativeStore} from './native-types';
import {t} from '../i18n';

interface Column {id:string;groups:{parentId:string;nodes:string[]}[]}
export interface LineageDocument {columns:Column[];content:Record<string,{content:string}>}
/** Only the file boundary is adapted; Lineage owns cards, editors, commands and history. */
export function lineageDocument(body:string):LineageDocument{
 const items=multilineOutline(body,false),columns:Column[]=[],content:LineageDocument['content']={},ids=new Map<object,string>(),root='r'+crypto.randomUUID();
 for(const item of items){
  const id='n'+crypto.randomUUID(),depth=item.indent.length,parentId=item.parent?ids.get(item.parent)!:root;ids.set(item,id);content[id]={content:item.text};
  const column=columns[depth]??(columns[depth]={id:'c'+crypto.randomUUID(),groups:[]});let group=column.groups.find(g=>g.parentId===parentId);if(!group){group={parentId,nodes:[]};column.groups.push(group);}group.nodes.push(id);
 }
 if(!items.length)return lineageDocument('- ');
 return {columns,content};
}
export function lineageOutline(document:LineageDocument):string{
 const lines:string[]=[],children=new Map<string,{id:string;depth:number}[]>(),seen=new Set<string>();
 for(let depth=0;depth<document.columns.length;depth++)for(const group of document.columns[depth]!.groups){const list=children.get(depth===0?'':group.parentId)??[];list.push(...group.nodes.map(id=>({id,depth})));children.set(depth===0?'':group.parentId,list);}
 const pending=[...(children.get('')??[])].reverse();
 while(pending.length){const {id,depth}=pending.pop()!;if(seen.has(id)||typeof document.content[id]?.content!=='string')throw new Error(t('companion.nativeConflict'));seen.add(id);lines.push(encodeOutlineText(document.content[id].content,'\t'.repeat(depth)));const next=children.get(id)??[];if(next.some(child=>child.depth!==depth+1))throw new Error(t('companion.nativeConflict'));pending.push(...[...next].reverse());}
 const total=document.columns.reduce((count,column)=>count+column.groups.reduce((sum,group)=>sum+group.nodes.length,0),0);if(seen.size!==total)throw new Error(t('companion.nativeConflict'));
 return lines.join('\n');
}
export interface LineageSession {save():Promise<void>}
/** Compose the native writable store at the host boundary; its methods stay intact. */
export function adaptLineage(view:NativeView,read:()=>string,report:(error:unknown)=>void):LineageSession{
 const original=view.documentStore;if(!original?.subscribe||!original.set)throw new Error(t('companion.nativeUnavailable'));
 let ready=false;
 const store:NativeStore={
  getValue:()=>original.getValue(),
  subscribe:callback=>original.subscribe!(callback),
  set:value=>original.set!(value),
  dispatch(action){
   try{
    if(action.type==='document/file/load-from-disk'){
     ready=false;const {header,body}=splitProjection(read()),payload=action.payload as Record<string,unknown>,state=original.getValue(),file=state.file as {frontmatter:string};
     file.frontmatter='---\n'+header+'\n---\n';const document=lineageDocument(body);
     original.dispatch({...action,payload:{...payload,__test_document__:document}});
     if(lineageOutline(original.getValue().document as LineageDocument)!==lineageOutline(document))throw new Error(t('companion.nativeUnavailable'));
     ready=true;
    }else original.dispatch(action);
   }catch(error){report(error);throw error;}
  },
 };
 view.documentStore=store;
 return {async save(){if(!ready)return;try{const body=lineageOutline(store.getValue().document as LineageDocument),header=splitProjection(read()).header;view.data='---\n'+header+'\n---\n'+body;await view.save();}catch(error){report(error);}}};
}
