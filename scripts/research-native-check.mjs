import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
evaluate(`(()=>{const c=app.plugins.plugins.Emergence.controller;if(c.abort)throw Error('Eine Anfrage läuft.');window.__emResearchCheck={done:false};(async()=>{
 const probe=new c.constructor(app,()=>JSON.parse(JSON.stringify(c.settings())),async()=>{},[],async()=>{}),before=JSON.stringify(c.inquiryHistory),started=performance.now();
 try{
  let truncated=false;const partial=await probe.provider.chat({messages:[{role:'user',content:'Erkläre Ontologie ausführlich in mindestens 300 Wörtern.'}],temperature:0,maxTokens:16,allowPartial:true,onTruncated:()=>{truncated=true;},signal:new AbortController().signal});
  if(!truncated||!partial.trim())throw Error('Length-limited local answer was not retained.');
  const answer=await probe.inquire('Erkläre den Unterschied zwischen Ontologie und Erkenntnistheorie in genau zwei kurzen Sätzen.','none',[],{},false);
  const report={model:c.settings().model,partialReplyRetained:truncated&&!!partial.trim(),partialCharacters:partial.length,normalResearchReply:!!answer.trim(),normalReplyTruncated:!!probe.inquiryHistory[0].truncated,answerCharacters:answer.length,historyUnchanged:JSON.stringify(c.inquiryHistory)===before,notesSent:0,notesWritten:0,elapsedMs:Math.round(performance.now()-started)};
  if(!report.historyUnchanged||report.normalReplyTruncated)throw Error(JSON.stringify(report));window.__emResearchCheck={done:true,report};
 }finally{probe.dispose();}
})().catch(e=>window.__emResearchCheck={done:true,failure:String(e),stack:e.stack});return true;})()`);
let result;for(let i=0;i<250;i++){result=evaluate('window.__emResearchCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));
writeFileSync('docs/research-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emResearchCheck');
