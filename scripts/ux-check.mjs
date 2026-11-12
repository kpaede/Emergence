import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluate} from './obsidian-cli.mjs';
const theme=process.env.EMERGENCE_TEST_THEME??'';const out=resolve('docs/ui-review',theme||'.');mkdirSync(out,{recursive:true});
async function check(out,theme){
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,p=v.graphPanel;
 if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const saved={tab:v.tab,state:v.state,style:v.contentEl.style.cssText,body:document.body.className,bg:wc.getBackgroundThrottling(),analysis:c.review.analysis,settings:JSON.stringify(c.settings()),files:app.vault.getFiles().length,source:c.activePath,focus:p.focusPath,follow:p.follow,explore:p.explore,graphView:p.viewSelect.value,themeCss:app.customCss.styleEl.textContent};
 const report={checks:{},layouts:[],screenshots:[]},assert=(key,value)=>{report.checks[key]=!!value;if(!value)throw Error(key);},wait=ms=>new Promise(r=>window.setTimeout(r,ms));
 const shot=async name=>{wc.invalidate();await wait(70);const r=v.contentEl.getBoundingClientRect();const png=await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.min(Math.round(r.height),w.getContentBounds().height-Math.round(r.y))});require('fs').writeFileSync(out+'/'+name,png.toPNG());report.screenshots.push(name);};
 try{
  wc.setBackgroundThrottling(false);if(theme){if(theme!=='Default'&&!Object.hasOwn(app.customCss.themes,theme))throw Error('Theme is not installed.');app.customCss.styleEl.textContent=theme==='Default'?'':await app.vault.adapter.read(app.vault.configDir+'/themes/'+theme+'/theme.css');}const tabs=[...v.contentEl.querySelectorAll('.em-tabs>[role=tab]')];
  assert('fiveLabelledTabs',JSON.stringify(tabs.map(b=>b.textContent))===JSON.stringify(['Graph','Feldideen','Mermaid','Argdown','Suche']));
  assert('researchRemoved',!v.contentEl.querySelector('.em-panel-inquiry')&&typeof c.inquire==='undefined'&&!('inquiryTemplates'in c.settings()));
  p.viewSelect.value='synopsis';p.viewSelect.dispatchEvent(new Event('change',{bubbles:true}));v.switchTab('graph');tabs[0].focus();tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert('keyboardNextTab',v.tab==='analysis');tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));assert('keyboardLastTab',v.tab==='search');
  assert('linkedSingleSelection',tabs.filter(b=>b.tabIndex===0).length===1&&tabs.filter(b=>b.getAttribute('aria-selected')==='true').length===1&&tabs.every(b=>!!document.getElementById(b.getAttribute('aria-controls'))));
  const field=c.analysisFields[0]??c.graph.snapshot.fields[0];if(!field)throw Error('No Breadcrumbs field for synthetic UI fixture.');
  const existing=c.graph.snapshot.nodes.find(n=>n.exists&&n.id!==c.activePath&&n.type==='md');
  const suggestions=[existing?.id??'Philosophie.md','UI-Prüfung – ein langer noch nicht angelegter Zielbegriff.md','Zweiter Testbegriff.md','Dritter Testbegriff.md'].map((target,i)=>({id:'ui-review-'+i,analysisId:'ui-review',source:c.activePath,sourceVersion:'ui-only-not-writable',operation:'add',target,targetKind:i===0&&existing?'existing':'unresolved',field,property:field,value:'[['+target.replace(/\.md$/u,'')+']]',reason:'',evidence:'UI fixture',confidence:'medium',status:'pending',outputId:'relations',contract:'breadcrumbs-v2',evidenceSource:'title'}));
  c.review.set({id:'ui-review',source:c.activePath,sourceVersion:'ui-only-not-writable',suggestions,candidates:[],artifacts:[],completed:1,total:1,status:'complete',errors:[],fields:[field],perField:4});
  v.state=JSON.parse(JSON.stringify(saved.state));
  for(const theme of ['light','dark'])for(const width of [280,328])for(const tab of ['graph','analysis','search']){
   document.body.removeClass('theme-light','theme-dark');document.body.addClass('theme-'+theme);v.contentEl.style.cssText='position:fixed;left:10px;top:10px;width:'+width+'px;height:780px;z-index:99999;background:var(--background-primary)';v.switchTab(tab);v.update(true);if(tab==='graph'){p.focus(c.activePath);p.resize();}await wait(130);
   const panel=v.panels.get(tab),fit=panel.scrollWidth<=panel.clientWidth+1&&tabs.every(b=>b.scrollWidth<=b.clientWidth+1);assert('fit_'+theme+'_'+width+'_'+tab,fit);
   if(tab==='analysis'){assert('fourCompactIdeas_'+theme+'_'+width,panel.querySelectorAll('.em-idea-row').length===4);panel.querySelectorAll('details[data-em-disclosure="analysis-settings"]').forEach(d=>d.open=false);}
   if(tab==='graph'){
    const resolved=panel.querySelector('a.em-syn-note:not(.is-unresolved)'),unresolved=panel.querySelector('a.em-syn-note.is-unresolved'),probe=panel.createSpan();
    if(resolved){probe.style.color='var(--link-color)';assert('resolvedThemeLink_'+theme+'_'+width,getComputedStyle(resolved).color===getComputedStyle(probe).color);}
    if(unresolved){probe.style.color='var(--link-unresolved-color)';probe.style.opacity='var(--link-unresolved-opacity)';assert('unresolvedThemeLink_'+theme+'_'+width,getComputedStyle(unresolved).color===getComputedStyle(probe).color&&getComputedStyle(unresolved).opacity===getComputedStyle(probe).opacity);}probe.remove();
   }
   await shot(tab+'-'+theme+'-'+width+'.png');report.layouts.push({theme,width,tab,overflow:!fit});
  }
  assert('settingsUnchanged',saved.settings===JSON.stringify(c.settings()));assert('filesUnchanged',saved.files===app.vault.getFiles().length);assert('mainNoteUnchanged',saved.source===c.activePath);return {...report,notesWritten:0,modelCalls:0};
 }finally{if(saved.analysis)c.review.set(saved.analysis);else c.review.clear();v.state=saved.state;p.focusPath=saved.focus;p.follow=saved.follow;p.explore=saved.explore;p.exploreBox.checked=saved.explore;p.viewSelect.value=saved.graphView;p.viewSelect.dispatchEvent(new Event('change',{bubbles:true}));p.renderStructure();app.customCss.styleEl.textContent=saved.themeCss;document.body.className=saved.body;v.contentEl.style.cssText=saved.style;v.switchTab(saved.tab);v.update(true);p.resize();wc.setBackgroundThrottling(saved.bg);}
}
evaluate(`(()=>{window.__emCurrentUX={done:false};(${check.toString()})(${JSON.stringify(out)},${JSON.stringify(theme)}).then(report=>window.__emCurrentUX={done:true,report}).catch(e=>window.__emCurrentUX={done:true,failure:e.stack});return true;})()`);
let result;for(let i=0;i<150;i++){result=evaluate('window.__emCurrentUX');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/checks.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emCurrentUX');
