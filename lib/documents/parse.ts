import { AppError } from '../errors';
import type { Side } from '../schema';
import { structure, normalize } from './structure';
export const MAX_FILE_SIZE=10*1024*1024;
export async function parseDocument(file:File,side:Side) {
 if(!/\.(pdf|docx)$/i.test(file.name))throw new AppError('FORMAT','Поддерживаются только PDF и DOCX.');
 if(!file.size)throw new AppError('EMPTY','Файл пуст. Выберите документ с текстом.');
 if(file.size>MAX_FILE_SIZE)throw new AppError('SIZE','Размер каждого файла не должен превышать 10 МБ.');
 const buffer=Buffer.from(await file.arrayBuffer());
 let pages:{page:number|null;text:string}[];
 try {
  if(/\.pdf$/i.test(file.name)) {
   if(!buffer.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new AppError('FORMAT','Содержимое файла не соответствует PDF.');
   const {PDFParse}=await import('pdf-parse');
   const parser=new PDFParse({data:buffer});
   try {const info=await parser.getInfo();if(info.total>80)throw new AppError('PAGES','Для MVP поддерживается до 80 страниц на документ.');const result=await parser.getText();pages=result.pages.map(p=>({page:p.num,text:p.text.replace(/--\s*\d+ of \d+\s*--/g,'')}));}finally{await parser.destroy();}
  } else {
   if(buffer.readUInt16LE(0)!==0x4b50)throw new AppError('FORMAT','Содержимое файла не соответствует DOCX.');
   // Reject oversized expanded ZIP content before the DOCX parser allocates it.
   let unpacked=0;
   for(let i=0;i+46<buffer.length;i++)if(buffer.readUInt32LE(i)===0x02014b50)unpacked+=buffer.readUInt32LE(i+24);
   if(unpacked>30*1024*1024)throw new AppError('SIZE','Слишком большой распакованный DOCX. Экспортируйте документ в PDF.');
   const mammoth=await import('mammoth');const result=await mammoth.extractRawText({buffer});pages=[{page:null,text:result.value}];
  }
 }catch(error){if(error instanceof AppError)throw error;throw new AppError('PARSE','Не удалось прочитать документ. Проверьте, что он не повреждён и не защищён паролем.');}
 const length=pages.reduce((sum,p)=>sum+normalize(p.text).length,0);
 if(length<50)throw new AppError('NO_TEXT','Текст не обнаружен. Для сканов нужен OCR: загрузите PDF с выделяемым текстом.');
 if(length>180000)throw new AppError('TEXT_SIZE','Слишком много текста. Для MVP сократите документ до 180 000 символов.');
 return structure(pages,file.name.slice(0,200),side);
}
