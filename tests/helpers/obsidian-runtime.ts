import type {RequestUrlParam, RequestUrlResponse} from 'obsidian';
import {request as localRequest} from 'node:http';
/** Minimal host boundary for controller tests; Obsidian itself is verified by native CLI checks. */
export class MarkdownView {}
export class Notice {constructor(public message:string){}}
export async function requestUrl(request:RequestUrlParam|string):Promise<RequestUrlResponse>{
 if(process.env.EMERGENCE_OLLAMA_TEST!=='1')throw new Error('Unexpected real network request in unit test.');
 const options=typeof request==='string'?{url:request}:request,url=new URL(options.url);
 if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Live tests allow only the local model.');
 return new Promise((resolve,reject)=>{
  const pending=localRequest(url,{method:options.method,headers:options.headers},response=>{
   const parts:Buffer[]=[];
   response.on('data',(part:Buffer)=>parts.push(part));response.on('error',reject);
   response.on('end',()=>{const bytes=Buffer.concat(parts),arrayBuffer=new Uint8Array(bytes).buffer,text=bytes.toString('utf8');
    resolve({status:response.statusCode??0,headers:Object.fromEntries(Object.entries(response.headers).flatMap(([key,value])=>value===undefined?[]:[[key,Array.isArray(value)?value.join(', '):value]])),arrayBuffer,text,json:undefined});
   });
  });
  pending.on('error',reject);pending.end(typeof options.body==='string'?options.body:options.body?Buffer.from(options.body):undefined);
 });
}
export function setIcon():void{/* Host rendering is exercised by native UI checks. */}
export function setTooltip():void{/* Host rendering is exercised by native UI checks. */}

export class Menu {}
export const Keymap={isModEvent:(event:MouseEvent)=>event.ctrlKey||event.metaKey};
