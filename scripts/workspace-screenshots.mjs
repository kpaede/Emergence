import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluate} from './obsidian-cli.mjs';
const out=resolve('docs');
async function capture(output) {
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const previous={tab:v.tab,bg:wc.getBackgroundThrottling()};const report=[];let root;
 const pause=()=>new Promise(r=>window.setTimeout(r,100));
 try {
  wc.setBackgroundThrottling(false);
  for(const tab of ['search','analysis'])for(const width of [280,328]) {
   v.switchTab(tab);await pause();
   root=v.contentEl.cloneNode(true);root.style.cssText='position:fixed;top:8px;left:8px;width:'+width+'px;height:740px;z-index:99999;background:var(--background-primary);';document.body.append(root);await pause();
   const panel=root.querySelector('.em-panel-'+tab),nav=root.querySelector('.em-tabs');
   const overflow=panel.scrollWidth>panel.clientWidth+1||nav.scrollWidth>nav.clientWidth+1;
   if(overflow)throw Error('Horizontal overflow: '+tab+' '+width+' '+panel.scrollWidth+'/'+panel.clientWidth);
   wc.invalidate();await pause();const r=root.getBoundingClientRect(),file='workspace-'+tab+'-'+width+'.png';
   const image=await w.capturePage({x:Math.round(r.left),y:Math.round(r.top),width,height:Math.min(Math.round(r.height),w.getContentBounds().height-20)});
   require('fs').writeFileSync(output+'/'+file,image.toPNG());report.push({tab,width,overflow,file});root.remove();root=undefined;
  }
  return report;
 }finally{root?.remove();v.switchTab(previous.tab);wc.setBackgroundThrottling(previous.bg);}
}
evaluate(`(()=>{window.__emWorkspaceScreens={done:false};(${capture.toString()})(${JSON.stringify(out)}).then(report=>window.__emWorkspaceScreens={done:true,report}).catch(e=>window.__emWorkspaceScreens={done:true,failure:String(e)});return true;})()`);
let result;for(let i=0;i<100;i++){result=evaluate('window.__emWorkspaceScreens');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(resolve(out,'workspace-screenshots.json'),JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emWorkspaceScreens');
