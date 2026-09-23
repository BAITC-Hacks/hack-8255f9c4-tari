// End-to-end local HTTP smoke test. No external model or real API key is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
let modelCalls=0;
const mock=createServer(async(req,res)=>{
 let body='';for await(const part of req)body+=part;
 const input=JSON.parse(body);const data=JSON.parse(input.messages[1].content);modelCalls++;
 let result;
 if(data.reviewFindings)result={reviews:data.reviewFindings.map(f=>({id:f.id,verdict:'supported',reason:'Verified fixture'}))};
 else if(data.sources)result={entities:data.sources.filter(s=>s.clause==='2.3.1').slice(0,1).map(s=>({type:'function',name:'Оценка эффективности СВК',owner:'БВА',sourceId:s.id,quote:s.text.slice(0,110)}))};
 else if(data.section==='risks')result={findings:[]};
 else result={findings:[{id:'HTTP-1',kind:'preserved',title:'Оценка СВК сохранена',description:'Проверка HTTP-конвейера с тестовой моделью: цитаты извлечены из обоих PDF.',status:'confirmed',confidence:.9,beforeIds:[data.before[0].evidenceId],afterIds:[data.after[0].evidenceId]}]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,DEMO_MODE:'false',APP_ACCESS_CODE:'test-only-code-12345',AI_API_KEY:'test-placeholder',AI_BASE_URL:`http://127.0.0.1:${mock.address().port}/v1`,AI_MODEL:'local-test-model'}});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${port}`;
try{
 let ready=false;for(let i=0;i<50;i++){try{const r=await fetch(base+'/api/config');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
 const config=await (await fetch(base+'/api/config')).json();assert.equal(config.demoMode,false);assert.equal(config.configured,true);
 const denied=await fetch(base+'/api/analyze',{method:'POST',body:new FormData()});assert.equal(denied.status,401);assert.equal(modelCalls,0);
 const data=new FormData();data.set('before',new File([await readFile('public/demo/revision-8.pdf')],'revision-8.pdf'));data.set('after',new File([await readFile('public/demo/revision-9.pdf')],'revision-9.pdf'));
 const response=await fetch(base+'/api/analyze',{method:'POST',headers:{'x-orglens-access':'test-only-code-12345'},body:data});assert.equal(response.status,200);
 const events=(await response.text()).trim().split('\n').map(JSON.parse);assert.equal(events.some(e=>e.type==='error'),false,JSON.stringify(events.filter(e=>e.type==='error')));
 const report=events.find(e=>e.type==='result')?.report;assert.ok(report);assert.equal(report.mode,'live');assert.equal(report.findings.length,1);assert.equal(report.documents.before.pages,25);assert.ok(modelCalls>3);assert.ok(events.some(e=>e.step===4));
 const bad=new FormData();bad.set('before',new File(['not a pdf'],'bad.pdf'));bad.set('after',new File(['x'],'other.pdf'));
 const invalid=await fetch(base+'/api/analyze',{method:'POST',headers:{'x-orglens-access':'test-only-code-12345'},body:bad});const errorEvents=(await invalid.text()).trim().split('\n').map(JSON.parse);assert.equal(errorEvents.at(-1).error.code,'FORMAT');
 const missing=await fetch(base+'/api/analyze',{method:'POST',headers:{'x-orglens-access':'test-only-code-12345'},body:new FormData()});assert.equal(missing.status,400);
 const demo=await (await fetch(base+'/api/demo')).json();assert.equal(demo.mode,'demo');assert.equal(demo.findings.length,12);
 console.log(`HTTP smoke passed: real PDF uploads, ${modelCalls} local model calls, streamed progress, evidence, invalid upload, missing files and demo fallback.`);
}finally{child.kill('SIGTERM');mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));}
