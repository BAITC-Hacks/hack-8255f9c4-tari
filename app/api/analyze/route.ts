import 'server-only';
import { checkPaidAccess } from '@/lib/access';
import { AppError,publicError } from '@/lib/errors';
import { parseDocument } from '@/lib/documents/parse';
import { analyze } from '@/lib/ai/analyze';
import { createProvider } from '@/lib/ai/provider';
export const runtime='nodejs';
export const maxDuration=600;
let busy=false;
export async function POST(request:Request) {
 if(process.env.DEMO_MODE==='true')return Response.json({error:{code:'DEMO_ONLY',message:'Включён деморежим. Откройте подготовленный пример; для анализа своих файлов установите DEMO_MODE=false.'}},{status:409});
 if(busy)return Response.json({error:{code:'BUSY',message:'Уже выполняется анализ. Дождитесь завершения и повторите.'}},{status:429});
 try {
  checkPaidAccess(request,'analysis');
  const provider=createProvider();
  const maxBody=21*1024*1024;
  if(Number(request.headers.get('content-length'))>maxBody)throw new AppError('SIZE','Суммарный размер файлов превышает 20 МБ.',413);
  busy=true;
  // Bound the body even when the Content-Length header is absent or forged.
  const reader=request.body?.getReader();if(!reader)throw new AppError('FILES','Выберите два документа.');
  const buffers:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBody){await reader.cancel();throw new AppError('SIZE','Суммарный размер файлов превышает 20 МБ.',413);}buffers.push(value);}
  const data=await new Response(Buffer.concat(buffers),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData().catch(()=>{throw new AppError('FILES','Не удалось прочитать загруженные файлы.');});
  const before=data.get('before'),after=data.get('after');
  if(!(before instanceof File)||!(after instanceof File))throw new AppError('FILES','Выберите документы ДО и ПОСЛЕ.');
  const cancelled=new AbortController();
  const signal=AbortSignal.any([request.signal,cancelled.signal,AbortSignal.timeout(570000)]);
  const encoder=new TextEncoder();
  const stream=new ReadableStream({start(controller){
   void (async()=>{
   function send(value:unknown){try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{cancelled.abort();}}
   try{
    send({type:'progress',step:0,message:'Чтение документов и проверка формата'});
    signal.throwIfAborted();
    const b=await parseDocument(before,'before');signal.throwIfAborted();
    const a=await parseDocument(after,'after');signal.throwIfAborted();
    const result=await analyze(b,a,(step,message)=>send({type:'progress',step,message}),signal,provider);
    send({type:'result',report:result});
   }catch(error){send({type:'error',error:publicError(error)});}finally{busy=false;try{controller.close();}catch{}}
   })();
  },cancel(){cancelled.abort();}});
  return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
 }catch(error){busy=false;return Response.json({error:publicError(error)},{status:error instanceof AppError?error.status:500});}
}
