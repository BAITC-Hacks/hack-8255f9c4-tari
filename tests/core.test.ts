import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDocument,MAX_FILE_SIZE } from '../lib/documents/parse';
import { structure,normalize } from '../lib/documents/structure';
import { verifyFindings,verifyReference } from '../lib/evidence';
import { comparisonSchema, type Report, type Source, type Finding } from '../lib/schema';
import demo from '../lib/demo/report.json';
import { analyze } from '../lib/ai/analyze';
import type { AIProvider } from '../lib/ai/provider';
import { AppError } from '../lib/errors';
const source:Source={id:'before-1',side:'before',document:'test.pdf',version:'8',section:'3. Структура',clause:'3.4',page:1,text:'Департамент анализа данных выполняет контроль качества.'};
const finding:Finding={id:'F1',kind:'preserved',title:'Контроль качества',description:'Функция контроля качества сохранена.',status:'confirmed',confidence:.99,beforeEvidence:[{sourceId:'before-1',quote:source.text}],afterEvidence:[]};
test('rejects invented evidence, wrong side and duplicate IDs',()=>{
 assert.throws(()=>verifyReference({sourceId:'before-1',quote:'Новый выдуманный текст'},[source]),AppError);
 assert.throws(()=>verifyReference({sourceId:'before-1',quote:source.text},[source],'after'),AppError);
 assert.throws(()=>verifyFindings([finding,finding],[source]),AppError);
});
test('missing second side downgrades preserved claim',()=>{const [result]=verifyFindings([finding],[source]);assert.equal(result.status,'uncertain');assert.equal(result.confidence,.4);});
test('absence cannot prove actual loss',()=>{assert.equal(verifyFindings([{...finding,kind:'lost'}],[source])[0].status,'possible');});
test('invalid AI JSON shape is rejected',()=>{assert.equal(comparisonSchema.safeParse({findings:[{...finding,confidence:2}]}).success,false);assert.equal(comparisonSchema.safeParse({findings:[{title:'fake'}]}).success,false);});
test('structure preserves page, section, multi-level clauses and version',()=>{const d=structure([{page:1,text:'Положение (редакция №9)\n3. Структура\n3.4. Блок включает подразделение.\n3.4.1. Контроль и мониторинг.'}], 'test.pdf','after');assert.equal(d.version,'Редакция №9');assert.ok(d.sources.some(s=>s.clause==='3.4.1'&&s.page===1&&s.section.startsWith('3.')));});
test('rejects unsupported, empty, oversized and invalid PDFs',async()=>{
 for(const [file,code] of [[new File(['hello'],'bad.txt'),'FORMAT'],[new File([],'empty.pdf'),'EMPTY'],[new File([new Uint8Array(MAX_FILE_SIZE+1)],'big.pdf'),'SIZE'],[new File(['fake'],'bad.pdf'),'FORMAT'],[new File(['%PDF-1.7 broken body'],'broken.pdf'),'PARSE']] as const){await assert.rejects(()=>parseDocument(file,'before'),(e:unknown)=>e instanceof AppError&&e.code===code);}
});
test('both real PDFs parse; every demo quote is present on its stated page',async()=>{
 const report=demo as Report;assert.equal(verifyFindings(comparisonSchema.parse(report).findings,report.sources).length,12);
 for(const v of [8,9]){
  const side=v===8?'before':'after';const buffer=await readFile(`public/demo/revision-${v}.pdf`);const d=await parseDocument(new File([buffer],`revision-${v}.pdf`),side);
  assert.equal(d.pages,25);assert.equal(d.version,`Редакция №${v}`);assert.ok(d.sources.length>150);
  for(const f of report.findings)for(const e of side==='before'?f.beforeEvidence:f.afterEvidence){const s=report.sources.find(s=>s.id===e.sourceId)!;const text=d.sources.filter(x=>x.page===s.page).map(x=>x.text).join(' ');assert.ok(normalize(text).includes(normalize(e.quote)),`${f.id}: ${side} ${s.clause} page ${s.page}`);}
 }
});
test('full structured pipeline works with a deterministic provider substitute',async()=>{
 const b=structure([{page:1,text:'3. Структура\n3.4. Департамент анализа данных выполняет контроль качества.'}],'before.pdf','before');const a=structure([{page:1,text:'3. Структура\n3.4. Департамент анализа данных выполняет контроль качества.'}],'after.pdf','after');
 let calls=0;const provider:AIProvider={async json(_instruction,data,schema){calls++;const payload=data as {sources?:Source[]};if(payload.sources)return schema.parse({entities:payload.sources.filter(s=>s.clause==='3.4').map(s=>({type:'function',name:'Контроль качества',owner:'Департамент анализа данных',sourceId:s.id,quote:s.text}))});return schema.parse({findings:[{...finding,beforeEvidence:[{sourceId:b.sources[1].id,quote:b.sources[1].text}],afterEvidence:[{sourceId:a.sources[1].id,quote:a.sources[1].text}]}]});}};
 const progress:number[]=[];const report=await analyze(b,a,(step)=>progress.push(step),new AbortController().signal,provider);assert.equal(calls,3);assert.equal(report.mode,'live');assert.equal(report.findings[0].status,'confirmed');assert.ok(progress.includes(4));
});
