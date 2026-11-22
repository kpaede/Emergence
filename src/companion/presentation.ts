import {parseYaml,stringifyYaml} from 'obsidian';
import type {NativeKind} from './native-types';

const PROFILE='emergence-companion-presentation';
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
/** Initial embedded-view defaults only. Later native zoom/layout choices are retained. */
export function presentationHeader(header:string,kind:NativeKind,width:number,fontSize:number,previousFontSize=16):string{
 const data=record(parseYaml(header)),profile=record(data[PROFILE]);if(typeof profile.version==='number'&&profile.version>=2)return header;
 if(profile.version===1){
  const saved=record(data['emergence-lineage-view']),view=record(saved.view);
  // Migrate the old generated default; retain explicit native font, zoom and layout choices.
  if(kind==='lineage'&&view.fontSize===previousFontSize)data['emergence-lineage-view']={...saved,view:{...view,fontSize}};
  data[PROFILE]={...profile,version:2};return stringifyYaml(data);
 }
 const cardWidth=Math.round(Math.min(320,Math.max(220,width-64)));
 if(kind==='eome'){
  const existing=typeof data['excerpt-outline-mindmap']==='string'?data['excerpt-outline-mindmap']:'',options=new Map(existing.split(';').filter(Boolean).map(part=>{const at=part.indexOf(':');return at<0?[part,'']:[part.slice(0,at),part.slice(at+1)];}));
  options.set('zoomFactor','1');options.set('nodeWidth',String(cardWidth));if(!options.has('showCheckboxesOnHover'))options.set('showCheckboxesOnHover','true');
  data['excerpt-outline-mindmap']=[...options].map(([key,value])=>key+':'+value).join(';');
 }else{
  const saved=record(data['emergence-lineage-view']),view=record(saved.view);
  data['emergence-lineage-view']={...saved,view:{...view,fontSize,cardWidth,zoomLevel:1,minimumCardHeight:54,cardsGap:16,theme:{inactiveNodeOpacity:100}}};
 }
 data[PROFILE]={version:2};return stringifyYaml(data);
}
