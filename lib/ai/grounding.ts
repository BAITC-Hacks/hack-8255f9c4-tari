import { z } from 'zod';
import { findingSchema, type Entity, type Finding, type Source } from '../schema';
import { AppError } from '../errors';

export type EvidenceUnit = Source & { originalSourceId:string };
export type GroundedEntity = Entity & { evidenceId:string };
// The model selects an ID. Only the server copies the corresponding original text.
export function evidenceUnits(sources:Source[]):EvidenceUnit[]{
 return sources.flatMap(source=>{
  const result:EvidenceUnit[]=[];
  for(let start=0;start<source.text.length;){
   let end=Math.min(start+1300,source.text.length);
   if(end<source.text.length){const boundary=source.text.lastIndexOf(' ',end);if(boundary>start)end=boundary;}
   const text=source.text.slice(start,end).trim();
   if(text.length>=12)result.push({...source,id:`${source.id}:q${result.length+1}`,originalSourceId:source.id,text});
   start=end;
  }
  return result;
 });
}
export function selectionSchema(units:EvidenceUnit[]){
 if(!units.length)throw new AppError('NO_ENTITIES','Нет фрагментов для анализа.',422);
 return z.object({entities:z.array(z.object({type:z.enum(['department','function']),name:z.string().min(3).max(350),owner:z.string().max(200),sourceId:z.enum(units.map(s=>s.id) as [string,...string[]])})).max(100)});
}
export function groundEntities(selected:z.infer<ReturnType<typeof selectionSchema>>['entities'],units:EvidenceUnit[]):Entity[]{
 return selected.map(entity=>{
  const unit=units.find(s=>s.id===entity.sourceId);
  if(!unit)throw new AppError('EVIDENCE','AI указал неизвестный фрагмент.',502);
  return {...entity,sourceId:unit.originalSourceId,quote:unit.text};
 });
}
export const sections={
 structure:['org_created','org_removed','org_renamed','org_changed','org_preserved'],
 functions:['preserved','transferred','changed','new','lost'],
 risks:['duplicate','conflict'],
} as const;
export type Section=keyof typeof sections;
function references(entities:GroundedEntity[],minimum=0){
 return entities.length?z.array(z.enum(entities.map(e=>e.evidenceId) as [string,...string[]])).min(minimum).max(6):z.array(z.string()).max(0);
}
export function groundedComparisonSchema(section:Section,before:GroundedEntity[],after:GroundedEntity[]){
 return z.object({findings:z.array(findingSchema.omit({id:true,beforeEvidence:true,afterEvidence:true}).extend({kind:z.enum(sections[section]),beforeIds:references(before),afterIds:references(after,section==='risks'&&after.length?2:0)})).max(section==='functions'?60:30)});
}
export function groundFindings(output:z.infer<ReturnType<typeof groundedComparisonSchema>>,before:GroundedEntity[],after:GroundedEntity[]):Finding[]{
 function resolve(ids:string[],entities:GroundedEntity[]){return ids.map(id=>{
  const e=entities.find(e=>e.evidenceId===id);
  if(!e)throw new AppError('EVIDENCE','Неизвестная ссылка или неверная версия документа.',502);
  return {sourceId:e.sourceId,quote:e.quote};
 }).filter((ref,i,all)=>all.findIndex(e=>e.sourceId===ref.sourceId&&e.quote===ref.quote)===i);}
 return output.findings.map((f,i)=>{const {beforeIds,afterIds,...rest}=f;return {...rest,id:`F${i+1}`,beforeEvidence:resolve(beforeIds,before),afterEvidence:resolve(afterIds,after)};});
}
export async function concurrentMap<T,R>(items:T[],signal:AbortSignal,fn:(item:T,index:number,signal:AbortSignal)=>Promise<R>):Promise<R[]>{
 const stop=new AbortController(),combined=AbortSignal.any([signal,stop.signal]);
 const result:R[]=new Array(items.length);let next=0;
 async function worker(){while(next<items.length){
  if(combined.aborted)throw new AppError('AI_TIMEOUT','Анализ отменён.',504);
  const i=next++;result[i]=await fn(items[i],i,combined);
  if(combined.aborted)throw new AppError('AI_TIMEOUT','Анализ отменён.',504);
 }}
 const workers=Array.from({length:Math.min(3,items.length)},worker);
 try{await Promise.all(workers);}catch(error){stop.abort();await Promise.allSettled(workers);throw error;}
 return result;
}
