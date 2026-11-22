import {vi} from 'vitest';
import {parse as parseYaml} from 'yaml';
import {TFile,type App} from 'obsidian';
import {defaults} from '../../src/config';
import {CompanionService} from '../../src/companion/service';
export const companionSource='# A\n\nBody A\n\n# B\n\nBody B\n';
const initial=companionSource;
export function companionFixture(){
 vi.stubGlobal('window',{setTimeout,clearTimeout});
 const folders=new Set<string>();const data=new Map([['Paper.md',initial],['Unrelated.md','# Other\n']]),files=new Map<string,TFile>(),writes:string[]=[];
 const file=(path:string)=>{if(!data.has(path))return null;let f=files.get(path);if(!f){f=new TFile();f.path=path;files.set(path,f);}return f;};
 const workspaceEvents=new Map<string,(...args:unknown[])=>void>(),vaultEvents=new Map<string,(...args:unknown[])=>void>(),metadataEvents=new Map<string,(...args:unknown[])=>void>();
 const app={fileManager:{trashFile:async(f:TFile)=>{data.delete(f.path);},renameFile:async(f:TFile,target:string)=>{const old=f.path,text=data.get(old)!;data.delete(old);data.set(target,text);files.delete(old);f.path=target;files.set(target,f);vaultEvents.get('rename')?.(f,old);}},workspace:{getLeavesOfType:()=>[],on:(name:string,fn:(...args:unknown[])=>void)=>{workspaceEvents.set(name,fn);return {};},},vault:{getFileByPath:file,getAbstractFileByPath:(path:string)=>file(path)??(folders.has(path)?{path}:null),createFolder:async(path:string)=>{folders.add(path);},trash:async(f:TFile)=>{data.delete(f.path);},getMarkdownFiles:()=>[...data.keys()].map(file),read:async(f:TFile)=>data.get(f.path)!,create:async(path:string,text:string)=>{if(data.has(path))throw new Error('exists');data.set(path,text);writes.push(path);return file(path);},process:async(f:TFile,change:(s:string)=>string)=>{const next=change(data.get(f.path)!);data.set(f.path,next);writes.push(f.path);return next;},on:(name:string,fn:(...args:unknown[])=>void)=>{vaultEvents.set(name,fn);return {};},},metadataCache:{getFileCache:(f:TFile)=>{const text=data.get(f.path)!,m=/^---\n([\s\S]*?)\n---/u.exec(text);return {frontmatter:m?parseYaml(m[1]!) as unknown:{}};},on:(name:string,fn:(...args:unknown[])=>void)=>{metadataEvents.set(name,fn);return {};},}} as unknown as App;
 const settings=defaults(),persist=vi.fn(async()=>{}),service=new CompanionService(app,undefined,()=>settings,persist);service.onload();return {app,data,file,folders,writes,service,settings,persist,workspaceEvents,vaultEvents,metadataEvents};
}
