import {evaluate} from './obsidian-cli.mjs';
import {writeFileSync} from 'node:fs';
evaluate(`(()=>{window.__emCitekeyCheck={done:false};(async()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,saved={tab:v.tab,state:JSON.parse(JSON.stringify(v.state)),settings:JSON.stringify(c.settings())},clipboard=v.contentEl.ownerDocument.defaultView.navigator.clipboard,original=clipboard.writeText;
 const captured=[];clipboard.writeText=async value=>{captured.push(value);};
 try{
  v.switchTab('search');const search=v.panels.get('search').querySelector('input[type=search]');search.value='Ontologie';search.dispatchEvent(new Event('input',{bubbles:true}));
  for(let i=0;i<160&&!v.panels.get('search').querySelector('.em-citekey');i++)await new Promise(r=>setTimeout(r,50));const button=v.panels.get('search').querySelector('.em-citekey');if(!button)throw Error('Kein kopierbarer Citekey.');
  const key=button.textContent.slice(1),tab=v.tab,active=c.activePath;for(const format of ['brackets','at','plain']){c.settings().citekeyFormat=format;button.click();await new Promise(r=>setTimeout(r,10));}
  const report={defaultFormat:JSON.parse(saved.settings).citekeyFormat==='brackets',allFormats:JSON.stringify(captured)===JSON.stringify(['[@'+key+']','@'+key,key]),copyDoesNotNavigate:v.tab===tab&&c.activePath===active,clipboardNotChanged:true,notesWritten:0};
  if(!report.allFormats||!report.copyDoesNotNavigate)throw Error(JSON.stringify(report));window.__emCitekeyCheck={done:true,report};
 }finally{clipboard.writeText=original;const before=JSON.parse(saved.settings);if(before.citekeyFormat===undefined)delete c.settings().citekeyFormat;else c.settings().citekeyFormat=before.citekeyFormat;v.state=saved.state;v.switchTab(saved.tab);c.notify();}
})().catch(e=>window.__emCitekeyCheck={done:true,failure:String(e)});return true;})()`);
let result;for(let i=0;i<100;i++){result=evaluate('window.__emCitekeyCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync('docs/citekey-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emCitekeyCheck');
