export type PrepareFile=(path:string,signal:AbortSignal)=>Promise<void>;

/** Materialize companion files before editing, without filling Obsidian's write queue. */
export class CompanionFilePreparation {
 private wanted=new Set<string>();private attempted=new Set<string>();private hovered=new Set<string>();
 private queue=new Set<string>();private urgent=new Set<string>();private running=new Map<string,{abort:AbortController;promise:Promise<void>}>();private active=false;
 readonly metrics={started:0,finished:0,failed:0};
 constructor(private read:PrepareFile,private exists:(path:string)=>boolean){}
 set(paths:readonly string[],priority?:string):void{
  this.active=true;this.wanted=new Set(paths.filter(path=>this.exists(path)));
  for(const [path,job]of this.running)if(!this.wanted.has(path))job.abort.abort();
  for(const path of this.queue)if(!this.wanted.has(path))this.queue.delete(path);
  for(const path of this.urgent)if(!this.wanted.has(path))this.urgent.delete(path);
  for(const path of this.attempted)if(!this.wanted.has(path))this.attempted.delete(path);
  for(const path of this.wanted)if(!this.attempted.has(path)&&(!this.running.has(path)||this.running.get(path)?.abort.signal.aborted))this.queue.add(path);
  if(priority&&this.queue.has(priority))this.urgent.add(priority);
  this.pump();
 }
 beginDrag():void{this.hovered.clear();}
 /** One extra slot is reserved for the heading currently under the pointer. */
 hover(path:string):void{
  if(!this.active||!this.wanted.has(path)||this.hovered.has(path))return;this.hovered.add(path);
  if(this.running.has(path))return;this.queue.delete(path);
  if(this.running.size<3)this.start(path);else{this.urgent.add(path);this.queue=new Set([path,...this.queue]);}
 }
 private pump():void{
  if(!this.active)return;
  while(this.running.size<3&&this.urgent.size){const path=[...this.urgent].find(path=>this.queue.has(path)&&!this.running.has(path));if(!path)break;this.urgent.delete(path);this.queue.delete(path);this.start(path);}
  while(this.running.size<2&&this.queue.size){const path=[...this.queue].find(path=>!this.running.has(path));if(!path)break;this.queue.delete(path);this.start(path);}
 }
 private start(path:string):void{
  this.urgent.delete(path);this.queue.delete(path);if(!this.exists(path))return;const abort=new AbortController();this.metrics.started++;this.attempted.add(path);
  const promise=Promise.resolve().then(()=>{if(abort.signal.aborted)return undefined;return this.read(path,abort.signal);}).then(()=>{if(!abort.signal.aborted)this.metrics.finished++;},()=>{if(!abort.signal.aborted)this.metrics.failed++;}).finally(()=>{if(this.running.get(path)?.abort===abort)this.running.delete(path);this.pump();});this.running.set(path,{abort,promise});
 }
 async settled():Promise<void>{while(this.queue.size||this.running.size){this.pump();if(!this.running.size)return;await Promise.all([...this.running.values()].map(job=>job.promise));}}
 close():void{this.active=false;this.wanted.clear();this.queue.clear();this.urgent.clear();this.attempted.clear();this.hovered.clear();for(const job of this.running.values())job.abort.abort();}
}
