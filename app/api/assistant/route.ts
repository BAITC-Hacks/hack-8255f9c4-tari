import 'server-only';
import { checkPaidAccess } from '@/lib/access';
import { assistantInput,answerQuestion,offlineHelp } from '@/lib/assistant';
import { createProvider } from '@/lib/ai/provider';
import { AppError,publicError } from '@/lib/errors';
export const runtime='nodejs';
export const maxDuration=120;
let active=0;
export async function POST(request:Request){
 if(active>=2)return Response.json({error:{message:'Помощник занят. Повторите позже.'}},{status:429});
 active++;
 try{
  const maxBytes=700000;
  if(Number(request.headers.get('content-length'))>maxBytes)throw new AppError('SIZE','Слишком большой запрос.',413);
  const reader=request.body?.getReader();if(!reader)throw new AppError('INPUT','Пустой запрос.');
  const parts:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new AppError('SIZE','Слишком большой запрос.',413);}parts.push(value);}
  let value:unknown;try{value=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new AppError('INPUT','Некорректный запрос.');}
  const parsed=assistantInput.safeParse(value);if(!parsed.success)throw new AppError('INPUT','Проверьте вопрос и размер отчёта.');
  if(process.env.DEMO_MODE==='true'||!process.env.AI_API_KEY||!process.env.AI_MODEL||!process.env.AI_BASE_URL)return Response.json(offlineHelp(parsed.data.language));
  checkPaidAccess(request,'assistant');
  const result=await answerQuestion(parsed.data,createProvider(),AbortSignal.any([request.signal,AbortSignal.timeout(90000)]));
  return Response.json({...result,mode:'ai'});
 }catch(error){return Response.json({error:publicError(error)},{status:error instanceof AppError?error.status:500});}
 finally{active--;}
}
