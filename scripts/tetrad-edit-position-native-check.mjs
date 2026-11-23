import {mkdtempSync,readFileSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {build} from 'esbuild';
import {evaluate} from './obsidian-cli.mjs';

// An isolated, temporary dev plugin gets Obsidian's own module resolver. It
// creates editors off-screen, without reloading Emergence or touching its input.
const installed=evaluate('(()=>{if(window.__emTetradPosition?.done===false||app.plugins.plugins["emergence-position-probe"])throw Error("Position check already running.");const win=require("electron").remote.getCurrentWindow();const background=window.__emPositionOldThrottle??win.webContents.getBackgroundThrottling();win.webContents.setBackgroundThrottling(false);return {background,base:app.vault.adapter.basePath,dir:app.plugins.plugins.emergence.manifest.dir};})()');
const folder=mkdtempSync(join(installed.base,installed.dir,'.position-check-')),id='emergence-position-probe',relative=installed.dir+'/'+folder.split('/').at(-1);
try{
 writeFileSync(join(folder,'styles.css'),readFileSync(new URL('../styles.css',import.meta.url),'utf8'));
 await build({entryPoints:[new URL('./tetrad-edit-position-probe.ts',import.meta.url).pathname],bundle:true,external:['obsidian','@codemirror/*'],format:'cjs',target:'es2021',outfile:join(folder,'main.js')});
 evaluate(`(()=>{if(window.__emTetradPosition?.done===false)throw Error('Position check already running.');app.plugins.manifests[${JSON.stringify(id)}]={...app.plugins.plugins.emergence.manifest,id:${JSON.stringify(id)},dir:${JSON.stringify(relative)}};window.__emTetradPosition={done:false};app.plugins.loadPlugin(${JSON.stringify(id)}).catch(e=>window.__emTetradPosition={done:true,failure:e.stack});return true;})()`);
 let status;for(let n=0;n<150;n++){status=evaluate('({done:window.__emTetradPosition?.done,failure:window.__emTetradPosition?.failure})');if(status.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
 mkdirSync('/tmp/emergence-tetrad-position',{recursive:true});
 evaluate(`(()=>{require('fs').writeFileSync('/tmp/emergence-tetrad-position/checks.json',JSON.stringify(window.__emTetradPosition,null,2));return true;})()`);
 const result=JSON.parse(readFileSync('/tmp/emergence-tetrad-position/checks.json','utf8'));
 if(!result?.done||result.failure)throw Error(JSON.stringify(result));
 console.log(JSON.stringify({...result,report:result.report.map(({name,theme,kind,law,still,dx,dy,cases})=>({name,theme,kind,law,still,dx,dy,cases:cases.map(({rects,violations,...data})=>({...data,lines:data.lineCount,violations:violations.length}))}))},null,2));
 const failed=result.report.filter(row=>!row.still||Math.abs(row.dy)>.75||row.editing.emptyCaretDelta>1||row.cases.some(test=>test.clipped||test.violations.length||test.excess>1||test.emptyCaretDelta>1));if(failed.length)throw Error('Layout regressions: '+JSON.stringify(failed.map(({name,theme,kind,law})=>({name,theme,kind,law}))));
}finally{
 evaluate(`(()=>{app.plugins.unloadPlugin(${JSON.stringify(id)});delete app.plugins.manifests[${JSON.stringify(id)}];delete window.__emTetradPosition;require('electron').remote.getCurrentWindow().webContents.setBackgroundThrottling(${JSON.stringify(installed.background)});delete window.__emPositionOldThrottle;delete window.__emProbeMeasurement;return true;})()`);rmSync(folder,{recursive:true,force:true});
}
