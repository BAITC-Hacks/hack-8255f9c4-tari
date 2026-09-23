import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors';

const buckets=new Map<string,{start:number;count:number}>();
export function requiresAccessCode(){return !!process.env.APP_ACCESS_CODE;}
export function checkPaidAccess(request:Request,kind:'analysis'|'assistant',now=Date.now()){
 const secret=process.env.APP_ACCESS_CODE;
 if(process.env.NODE_ENV==='production'&&(!secret||secret.length<16))throw new AppError('ACCESS_CONFIG','Платный AI пока закрыт. Откройте демопример.',503);
 if(secret){
  const supplied=request.headers.get('x-orglens-access')||'';
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  if(supplied.length>512||!timingSafeEqual(digest(secret),digest(supplied)))throw new AppError('ACCESS','Введите правильный код доступа к AI.',401);
 }
 // A shared budget per server process, not a user/IP claim that clients can spoof.
 // For multiple instances, use a shared external limiter before enabling paid AI.
 const configured=Number(process.env[kind==='analysis'?'ANALYSIS_HOURLY_LIMIT':'ASSISTANT_HOURLY_LIMIT']);
 const limit=Number.isInteger(configured)&&configured>0?configured:kind==='analysis'?3:30;
 let bucket=buckets.get(kind);
 if(!bucket||now-bucket.start>=3600000){bucket={start:now,count:0};buckets.set(kind,bucket);}
 if(bucket.count>=limit)throw new AppError('RATE_LIMIT','Лимит AI на этот час исчерпан. Откройте сохранённый отчёт или демопример.',429);
 bucket.count++;
}
