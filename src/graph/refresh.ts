interface RefreshActions {
 enabled():boolean;
 visible():boolean;
 interacting():boolean;
 rebuild():void;
 refresh():Promise<void>;
 changed():void;
 error(reason:unknown):void;
}

/** Retain invalidations while the graph is hidden; perform them when it is needed. */
export class GraphRefresh {
 private dirty=false;private breadcrumbs=false;private timer?:number;private running?:Promise<void>;private disposed=false;
 constructor(private actions:RefreshActions){}
 invalidate(breadcrumbs=false):void{this.dirty=true;this.breadcrumbs||=breadcrumbs;this.schedule();}
 show():void{if(this.actions.visible())this.schedule(0);}
 private schedule(delay=600):void{
  if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;
  if(this.disposed||!this.dirty||!this.actions.enabled()||!this.actions.visible())return;
  this.timer=window.setTimeout(()=>{this.timer=undefined;if(!this.actions.visible())return;if(this.actions.interacting()){this.schedule();return;}void this.flush().catch(reason=>this.actions.error(reason));},delay);
 }
 async flush(force=false):Promise<void>{
  if(force){this.dirty=true;this.breadcrumbs=true;}
  if(this.disposed)return;
  if(this.running){await this.running;return this.flush();}
  if(!this.dirty||!this.actions.enabled())return;
  if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;
  const breadcrumbs=this.breadcrumbs;this.dirty=this.breadcrumbs=false;let failed=false;
  const run=Promise.resolve().then(async()=>{try{if(breadcrumbs)await this.actions.refresh();else this.actions.rebuild();if(!this.disposed)this.actions.changed();}catch(error){failed=true;this.dirty=true;this.breadcrumbs||=breadcrumbs;throw error;}});
  this.running=run;
  try{await run;}finally{if(this.running===run)this.running=undefined;if(!failed)this.schedule();}
 }
 dispose():void{this.disposed=true;if(this.timer!==undefined)window.clearTimeout(this.timer);this.timer=undefined;}
}
