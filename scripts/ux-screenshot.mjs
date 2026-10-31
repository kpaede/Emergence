import {resolve} from 'node:path';
import {evaluate} from './obsidian-cli.mjs';
const settings=process.argv.includes('--settings');
const path=resolve(process.argv.find(a=>a.endsWith('.png'))??'docs/ux/window.png');
evaluate(`(()=>{window.__emergenceShot={done:false};(async()=>{const remote=require('@electron/remote'),windows=remote.BrowserWindow.getAllWindows();let target;for(const w of windows){if(w.isDestroyed())continue;const match=await w.webContents.executeJavaScript(${JSON.stringify(settings?"!!document.querySelector('.em-settings')":"!!document.querySelector('.em-workspace')")});if(match){target=w;break;}}if(!target)throw new Error('Target window not found');const shot=await target.capturePage();require('fs').writeFileSync(${JSON.stringify(path)},shot.toPNG());window.__emergenceShot={done:true};})().catch(e=>window.__emergenceShot={done:true,error:String(e)});return true;})()`);
for(let i=0;i<30;i++){const result=evaluate('window.__emergenceShot');if(result?.done){if(result.error)throw new Error(result.error);console.log(path);break;}}
evaluate('delete window.__emergenceShot');
