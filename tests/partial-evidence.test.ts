import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/ai/analyze';
import { structure } from '../lib/documents/structure';
import type { AIProvider } from '../lib/ai/provider';
import type { Source } from '../lib/schema';
import type { GroundedEntity } from '../lib/ai/grounding';
const before=structure([{page:1,text:'Отдел аудита выполняет проверку качества документов.'}],'before.pdf','before');
const after=structure([{page:1,text:'Отдел аудита выполняет проверку качества документов.'}],'after.pdf','after');
function provider(mode:'valid'|'no-functions'|'no-evidence'|'empty'|'unsupported'|'uncertain-review'):AIProvider{
 return {async json(_instruction,data,schema){
  if('reviewFindings' in (data as object))return schema.parse({reviews:(data as {reviewFindings:{id:string}[]}).reviewFindings.map(f=>({id:f.id,verdict:mode==='unsupported'?'unsupported':mode==='uncertain-review'?'uncertain':'supported',reason:'Review of the cited text'}))});
  const p=data as {sources?:Source[];section:string;before:GroundedEntity[];after:GroundedEntity[]};
  if(p.sources)return schema.parse({entities:p.sources.flatMap(s=>(mode==='no-functions'?['department']:['department','function']).map(type=>({type,name:type==='department'?'Отдел аудита':'Проверка качества',owner:'Отдел аудита',sourceId:s.id})))});
  if(p.section==='risks'||mode==='empty')return schema.parse({findings:[]});
  return schema.parse({findings:[{kind:p.section==='structure'?'org_preserved':'preserved',title:'Сохранено в обеих редакциях',description:'Функция либо подразделение присутствует в обеих редакциях.',status:'confirmed',confidence:0.8,beforeIds:mode==='no-evidence'?[]:[p.before[0].evidenceId],afterIds:mode==='no-evidence'?[]:[p.after[0].evidenceId]}]});
 }};
}
test('structure and functions are assessed separately and risk zero need not be fabricated',async()=>{
 const report=await analyze(before,after,()=>{},new AbortController().signal,provider('valid'));
 assert.deepEqual(report.findings.map(f=>f.kind),['org_preserved','preserved']);
 assert.equal(report.quality?.partial,false);assert.deepEqual(report.findings.map(f=>f.id),['F1','F2']);
});
test('missing functions are explicitly shown as incomplete',async()=>{
 const report=await analyze(before,after,()=>{},new AbortController().signal,provider('no-functions'));
 assert.equal(report.quality?.partial,true);assert.ok(report.quality?.unassessedSections.includes('Функции'));assert.match(report.conclusion,/Анализ неполный/);
});
test('empty or unevidenced AI reports cannot appear as successful analyses',async()=>{
 for(const mode of ['empty','no-evidence'] as const)await assert.rejects(analyze(before,after,()=>{},new AbortController().signal,provider(mode)),/нельзя считать завершённым/);
});

test('semantic review rejects unsupported meanings even when source IDs exist',async()=>{
 await assert.rejects(analyze(before,after,()=>{},new AbortController().signal,provider('unsupported')),/нельзя считать завершённым/);
 const report=await analyze(before,after,()=>{},new AbortController().signal,provider('uncertain-review'));
 assert.ok(report.findings.every(f=>f.status==='uncertain'&&f.confidence<=0.4));
});
