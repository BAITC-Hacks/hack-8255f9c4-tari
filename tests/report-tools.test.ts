import test from 'node:test';
import assert from 'node:assert/strict';
import { compareQuotes } from '../lib/text-diff';
import { checkPaidAccess } from '../lib/access';
import { AppError } from '../lib/errors';
import { createReportPdf } from '../lib/pdf-report';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import demo from '../lib/demo/report.json';
import type { Report } from '../lib/schema';

test('quote comparison preserves exact text, including whitespace and Cyrillic',()=>{
 const before='Отдел А\n  готовит отчёт.',after='Отдел Б\n  утверждает отчёт.';
 const diff=compareQuotes(before,after);
 assert.equal(diff.before.map(p=>p.text).join(''),before);
 assert.equal(diff.after.map(p=>p.text).join(''),after);
 assert.deepEqual(diff.after.filter(p=>p.changed).map(p=>p.text),['Б','утверждает']);
 assert.ok(compareQuotes(before,before).before.every(p=>!p.changed));
});
test('paid endpoints fail closed in production and enforce a shared hourly budget',()=>{
 const env={...process.env};
 try{
  Object.assign(process.env,{NODE_ENV:'production',APP_ACCESS_CODE:'',ANALYSIS_HOURLY_LIMIT:'2'});
  const request=()=>new Request('http://localhost',{headers:{'x-orglens-access':'test-secret-123456'}});
  assert.throws(()=>checkPaidAccess(request(),'analysis',0),(e:unknown)=>e instanceof AppError&&e.code==='ACCESS_CONFIG');
  process.env.APP_ACCESS_CODE='test-secret-123456';
  assert.throws(()=>checkPaidAccess(new Request('http://localhost'),'analysis',0),(e:unknown)=>e instanceof AppError&&e.status===401);
  checkPaidAccess(request(),'analysis',0);checkPaidAccess(request(),'analysis',1);
  assert.throws(()=>checkPaidAccess(request(),'analysis',2),(e:unknown)=>e instanceof AppError&&e.status===429);
  checkPaidAccess(request(),'analysis',3600000);
 }finally{process.env=env;}
});
test('PDF embeds a Unicode font, paginates a full report and keeps metadata',async()=>{
 const bytes=await createReportPdf(demo as Report,await readFile('public/fonts/NotoSans-Regular.ttf'),'kk');
 const pdf=await PDFDocument.load(bytes);
 assert.ok(pdf.getPageCount()>2);assert.match(pdf.getTitle()||'',/OrgLens/);
 assert.ok(bytes.length>10000);
});
