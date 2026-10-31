import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
const output=resolve('docs/relationssynopse');
const code=String.raw`(()=>{
 const p=app.workspace.getLeavesOfType('emergence-workspace')[0].view.graphPanel,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents,debug=wc.debugger;
 const editorStates=app.workspace.getLeavesOfType('markdown').map(leaf=>({leaf,file:leaf.view.file?.path,state:leaf.view.getEphemeralState?.()}));
 const state=window.__emSynFull={done:false,images:[]},before={body:document.body.className,bg:wc.getBackgroundThrottling(),attached:debug.isAttached()};let wrap,panel;
 (async()=>{
  wc.setBackgroundThrottling(false);if(!before.attached)debug.attach('1.3');
  for(const theme of ['light','dark'])for(const width of [280,328]){
   document.body.removeClass('theme-light','theme-dark');document.body.addClass('theme-'+theme);
   wrap=document.body.createDiv({cls:'em-workspace'});wrap.style.cssText='position:fixed;top:0;left:0;width:'+width+'px;height:800px;z-index:99999;background:var(--background-primary)';
   const host=wrap.createDiv(),settings=JSON.parse(JSON.stringify(p.controller.settings()));delete settings.synopsis;delete settings.graphStructure;
   panel=new p.semantic.constructor(host,()=>settings,()=>{},{activate:()=>{},inspect:()=>{}},()=>{});panel.render(require('/tmp/emergence-synopsis-fixture.cjs').synopsisFixture(),'Dekonstruktion.md');
   await new Promise(r=>window.setTimeout(r,80));wrap.style.height=(host.scrollHeight+2)+'px';host.style.overflow='visible';await new Promise(r=>window.setTimeout(r,80));panel.geometry.draw();
   const height=Math.ceil(host.scrollHeight);await debug.sendCommand('Emulation.setDeviceMetricsOverride',{width:w.getContentBounds().width,height:height+10,deviceScaleFactor:1,mobile:false});await new Promise(r=>window.setTimeout(r,100));panel.geometry.draw();const shot=await debug.sendCommand('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});
   const name='synopse-'+theme+'-'+width+'-vollstaendig.png';require('fs').writeFileSync(OUTPUT+'/'+name,Buffer.from(shot.data,'base64'));state.images.push({name,width,height});
   panel.destroy();wrap.remove();panel=wrap=undefined;
  }
 })().catch(e=>state.failure=String(e.stack??e)).finally(async()=>{if(debug.isAttached())await debug.sendCommand('Emulation.clearDeviceMetricsOverride');panel?.destroy();wrap?.remove();document.body.className=before.body;wc.setBackgroundThrottling(before.bg);if(!before.attached&&debug.isAttached())debug.detach();for(const saved of editorStates)if(saved.leaf.view.file?.path===saved.file&&saved.state)saved.leaf.view.setEphemeralState?.(saved.state);state.done=true;});return true;
})()`;
evaluate(code.replaceAll('OUTPUT',JSON.stringify(output)));
let result;for(let i=0;i<100;i++){result=evaluate('window.__emSynFull');if(result.done)break;await new Promise(r=>setTimeout(r,150));}
console.log(JSON.stringify(result,null,2));if(!result.done||result.failure)throw new Error(result.failure??'Capture timeout');

writeFileSync(resolve(output,'full-screenshots.json'),JSON.stringify(result,null,2)+'\n');

evaluate('delete window.__emSynFull');
