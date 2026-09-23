import test from 'node:test';
import assert from 'node:assert/strict';
import { concurrentMap } from '../lib/ai/grounding';
import { AppError } from '../lib/errors';

test('three workers overlap and preserve source order despite out-of-order completion',async()=>{
 let active=0,peak=0;
 const result=await concurrentMap([0,1,2,3,4,5,6,7],new AbortController().signal,async i=>{
  active++;peak=Math.max(peak,active);
  await new Promise(resolve=>setTimeout(resolve,i===0?20:2));active--;return i;
 });
 assert.equal(peak,3);assert.deepEqual(result,[0,1,2,3,4,5,6,7]);
});
test('a failure cancels peers and prevents queued work',async()=>{
 let calls=0,cancelled=0;const failure=new AppError('AI_API','API limit',502);
 await assert.rejects(concurrentMap([0,1,2,3,4],new AbortController().signal,async(i,_index,signal)=>{
  calls++;if(i===0){await new Promise(resolve=>setTimeout(resolve,5));throw failure;}
  await new Promise<void>((_resolve,reject)=>signal.addEventListener('abort',()=>{cancelled++;reject(new Error('cancelled'));},{once:true}));
 }),error=>error===failure);
 assert.equal(calls,3);assert.equal(cancelled,2);
});
test('already cancelled analysis sends no requests',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(concurrentMap([1],controller.signal,async()=>assert.fail('request after cancellation')),/Анализ отменён/);
});
