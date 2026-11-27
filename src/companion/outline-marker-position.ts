import type {Text} from '@codemirror/state';
import type {NavigationHeading} from './model';
import {headingContentStart} from './outline-size';

export interface OutlineMarkerPosition {previous?:string;next?:string;fraction:number}
export type OutlineMarkerPositions=ReadonlyMap<string,OutlineMarkerPosition>;

/** Use existing source offsets only. Marker labels themselves carry no weight. */
export function outlineMarkerPositions(outline:readonly NavigationHeading[],anchors:ReadonlyMap<string,number>,source:string|Text):OutlineMarkerPositions{
 const positions=new Map<string,OutlineMarkerPosition>();let previous:NavigationHeading|undefined,pending:NavigationHeading[]=[];
 const offset=(heading:NavigationHeading)=>anchors.get(heading.key)??heading.from;
 const flush=(next?:NavigationHeading)=>{
  if(!pending.length)return;
  if(!previous){for(const marker of pending)positions.set(marker.key,{next:next?.key,fraction:0});pending=[];return;}
  const previousFrom=offset(previous),end=next?offset(next):source.length;if(previousFrom<0||previousFrom>source.length||end<previousFrom||end>source.length||pending.some(marker=>offset(marker)<0||offset(marker)>source.length)){pending=[];return;}const start=headingContentStart(source,previousFrom);
  const ranges=pending.map(marker=>{const from=offset(marker);return {marker,from,to:Math.min(end,headingContentStart(source,from))};});
  if(start<0||end>source.length||start>end||ranges.some(r=>r.from<start||r.to<r.from||r.to>end)){pending=[];return;}
  const weights=ranges.map(r=>(r.to-r.from)),total=Math.max(0,(end-start)-weights.reduce((sum,value)=>sum+value,0));let removed=0;
  for(let i=0;i<ranges.length;i++){const {marker,from}=ranges[i]!,count=Math.max(0,(from-start)-removed);positions.set(marker.key,{previous:previous.key,next:next?.key,fraction:total?Math.max(0,Math.min(1,count/total)):1});removed+=weights[i]!;}
  pending=[];
 };
 for(const heading of outline){if(heading.kind==='marker')pending.push(heading);else{flush(heading);previous=heading;}}flush();return positions;
}
