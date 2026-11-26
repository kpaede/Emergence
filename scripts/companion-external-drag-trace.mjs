import {evaluate} from './obsidian-cli.mjs';

async function start(){
 const debug=require('electron').remote.getCurrentWindow().webContents.debugger;if(debug.isAttached())throw Error('A debugger is already attached.');debug.attach('1.3');
 try{await debug.sendCommand('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordContinuously',traceBufferSizeInKb:8192,includedCategories:['devtools.timeline','v8','blink.user_timing']}});window.__emZoteroTrace={debug};return {active:true};}catch(error){debug.detach();throw error;}
}
async function stop(){
 const state=window.__emZoteroTrace;if(!state)return {active:false};const debug=state.debug;
 try{
  const completion=new Promise(resolve=>{const listener=(_event,method,params)=>{if(method==='Tracing.tracingComplete'){debug.removeListener('message',listener);resolve(params.stream);}};debug.on('message',listener);});await debug.sendCommand('Tracing.end');const handle=await completion;let text='';for(;;){const part=await debug.sendCommand('IO.read',{handle});text+=part.data;if(part.eof)break;}await debug.sendCommand('IO.close',{handle});const path='/tmp/emergence-zotero-trace.json';require('fs').writeFileSync(path,text);return {active:false,path};
 }finally{debug.detach();delete window.__emZoteroTrace;}
}
const action=process.argv[2]==='start'?start:stop;
evaluate(`(()=>{window.__emZoteroTraceCall={done:false};(${action.toString()})().then(result=>window.__emZoteroTraceCall={done:true,result}).catch(error=>window.__emZoteroTraceCall={done:true,failure:error.stack});return true;})()`);
let state;for(let n=0;n<600;n++){state=evaluate('window.__emZoteroTraceCall');if(state.done)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!state?.done||state.failure)throw Error(JSON.stringify(state));console.log(JSON.stringify(state.result));evaluate('delete window.__emZoteroTraceCall');
