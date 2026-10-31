import {evaluate} from './obsidian-cli.mjs';
import {buildSync} from 'esbuild';
import {writeFileSync} from 'node:fs';
buildSync({entryPoints:['tests/synopsis-fixture.ts'],bundle:true,platform:'node',format:'cjs',outfile:'/tmp/emergence-synopsis-fields.cjs'});
evaluate(`(()=>{window.__emFieldsCheck={done:false};(async()=>{
 const p=app.workspace.getLeavesOfType('emergence-workspace')[0].view.graphPanel,base=require('/tmp/emergence-synopsis-fields.cjs').synopsisFixture(),focus='Dekonstruktion.md',roles=['Komponist_in','Autor_in','Künstler_in','Regisseur_in'];
 base.fields.push('Konzept','Werk',...roles);base.inferenceRules=[...(base.inferenceRules??[]),{chain:['Beispiel'],field:'Konzept',reversed:true,rounds:10},...roles.map(field=>({chain:[field],field:'Werk',reversed:true,rounds:10}))];
 for(const [i,field]of ['Konzept',...roles].entries()){const id='Zusatz '+i+'.md';base.nodes.push({id,title:'Zusatz '+i,aliases:[],tags:[],exists:true,type:'md',mtime:0,size:0});base.edges.push({id:'extra-'+i,source:focus,target:id,field,explicit:true,layer:'breadcrumbs',provenance:'fixture',occurrences:[]});}
 const work='Ein Werk.md';base.nodes.push({id:work,title:'Ein Werk',aliases:[],tags:[],exists:true,type:'md',mtime:0,size:0});base.edges.push({id:'incoming-work',source:work,target:focus,field:'Autor_in',explicit:true,layer:'breadcrumbs',provenance:'fixture',occurrences:[]});
 const report={cases:[],notesWritten:0};let root,panel;
 try{for(const width of [280,328])for(const scale of [1,2]){
  root=document.body.createDiv({cls:'em-workspace'});root.style.cssText='position:fixed;left:8px;top:8px;width:'+width+'px;height:740px;z-index:99999;background:var(--background-primary)';const host=root.createDiv(),calls=[];
  panel=new p.semantic.constructor(host,()=>({}),()=>{},{activate:()=>{},inspect:()=>{}},()=>{},(field,source)=>calls.push({field,source}));panel.render(base,focus);
  if(scale===2)host.style.fontSize=(parseFloat(getComputedStyle(host).fontSize)*2)+'px';
  host.querySelector('.em-syn-similar h3').firstChild.textContent='Ähnlichkeit mit besonders langem Titel';await new Promise(r=>setTimeout(r,100));panel.geometry.draw();
  const h=side=>host.querySelector('.em-syn-'+side+' .em-syn-head').getBoundingClientRect(),b=side=>host.querySelector('.em-syn-'+side+' .em-syn-controls').getBoundingClientRect();
  const fields=[...host.querySelectorAll('[data-syn-field]')].map(e=>e.dataset.synField),konzept=host.querySelector('[data-syn-field="Konzept"]'),work=host.querySelector('[data-syn-field="Werk"]');konzept.querySelector('button').click();
  const result={width,scale,controlsAligned:Math.abs(b('similar').bottom-b('friction').bottom)<1,rulesAligned:Math.abs(h('similar').bottom-h('friction').bottom)<1,allAdditionalFields:['Konzept','Werk',...roles].every(f=>fields.includes(f)),workInverseVisible:work.textContent.includes('Ein Werk'),plusUsesActualField:calls.length===1&&calls[0].field==='Konzept'&&calls[0].source===focus,noOverflow:host.scrollWidth<=host.clientWidth+1};
  if(Object.values(result).some(v=>v===false))throw Error(JSON.stringify(result));report.cases.push(result);panel.destroy();root.remove();panel=root=undefined;
 }window.__emFieldsCheck={done:true,report};}finally{panel?.destroy();root?.remove();}
})().catch(e=>window.__emFieldsCheck={done:true,failure:String(e)});return true;})()`);
let result;for(let i=0;i<80;i++){result=evaluate('window.__emFieldsCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync('docs/synopsis-fields-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emFieldsCheck');
