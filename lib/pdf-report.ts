import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { labels, statusLabels, type Report } from './schema';
import { translate, type Language } from './i18n';

/** Runs in the browser: report contents never leave the device for export. */
export async function createReportPdf(report: Report, fontBytes: Uint8Array, language: Language) {
 const pdf = await PDFDocument.create();
 pdf.registerFontkit(fontkit);
 const font = await pdf.embedFont(fontBytes, { subset: true });
 const t = (text: string) => translate(language, text);
 const ink = rgb(.10,.17,.25), muted = rgb(.35,.41,.49), blue = rgb(.14,.34,.78);
 const width = 595.28, height = 841.89, margin = 44, usable = width - margin * 2;
 let page = pdf.addPage([width,height]), y = height - 72;
 const chars = new Set(font.getCharacterSet());
 const clean = (text:string) => Array.from(text.normalize('NFC').replace(/[\u2010-\u2015]/g,'-')).map(c=> c==='\n'||chars.has(c.codePointAt(0)!)?c:' ').join('');
 function next(){page=pdf.addPage([width,height]);y=height-72;}
 function room(points:number){if(y-points<55)next();}
 function text(value:string,size=10,color=ink){
  const lineHeight=size*1.55;
  for(const paragraph of clean(value).split('\n')){
   let line='';
   const flush=()=>{room(lineHeight);page.drawText(line,{x:margin,y,size,font,color});y-=lineHeight;line='';};
   for(const word of paragraph.split(/\s+/).filter(Boolean)){
    if(font.widthOfTextAtSize(line+(line?' ':'')+word,size)<=usable){line+=(line?' ':'')+word;continue;}
    if(line)flush();
    // Long filenames and identifiers must wrap too.
    for(const char of word){if(font.widthOfTextAtSize(line+char,size)>usable)flush();line+=char;}
   }
   flush();
  }
 }
 function heading(value:string){room(65);y-=12;text(value,13,blue);y-=5;}
 pdf.setTitle('OrgLens - '+t('Карта организационных изменений'));
 pdf.setAuthor('OrgLens');
 text('OrgLens',26,blue);y-=12;
 text(t('Карта организационных изменений'),16);y-=9;
 text(t(report.quality?.partial?'АНАЛИЗ НЕПОЛНЫЙ':'АНАЛИЗ ЗАВЕРШЁН'),10,blue);
 if(report.mode==='demo')text(t('ДЕМО · ПРОВЕРЕННЫЙ ПРИМЕР'),9,muted);
 text(new Date(report.createdAt).toLocaleString(language==='kk'?'kk-KZ':language==='ru'?'ru-RU':'en-GB'),9,muted);
 heading(t('Два источника'));
 for(const side of ['before','after'] as const)text(`${t(side==='before'?'ДО':'ПОСЛЕ')}: ${report.documents[side].name} (${report.documents[side].version})`);
 heading(t('Заключение по результатам сравнения'));text(report.conclusion);
 heading(t('Границы анализа'));text(report.coverage,9,muted);
 for(const warning of report.warnings){text('- '+warning,9,muted);y-=4;}
 for(const finding of report.findings){
  heading(`${finding.id} / ${t(labels[finding.kind])}`);
  text(finding.title,12);text(t(statusLabels[finding.status]),9,blue);y-=6;text(finding.description);
  for(const side of ['before','after'] as const){
   room(65);y-=8;text(`${t(side==='before'?'ДО':'ПОСЛЕ')} - ${report.documents[side].version}`,10,blue);
   const evidence=side==='before'?finding.beforeEvidence:finding.afterEvidence;
   if(!evidence.length)text(t('Подтверждающий фрагмент не найден. Отсутствие цитаты не доказывает отсутствие функции.'),9,muted);
   for(const ref of evidence){
    const source=report.sources.find(s=>s.id===ref.sourceId);
    text(`${source?.document||ref.sourceId} / § ${source?.clause||'-'} / ${source?.page?`${t('стр.')} ${source.page}`:t('страница недоступна в DOCX')}`,8,muted);
    text('«'+ref.quote+'»',10);y-=6;
   }
  }
 }
 const pages=pdf.getPages();
 pages.forEach((p,i)=>{
  p.drawText('ORGLENS / '+t('Доказательства рядом'),{x:margin,y:height-32,font,size:8,color:muted});
  p.drawLine({start:{x:margin,y:43},end:{x:width-margin,y:43},color:rgb(.85,.89,.93),thickness:.6});
  p.drawText(`${i+1} / ${pages.length}`,{x:width-margin-45,y:27,font,size:8,color:muted});
 });
 return pdf.save();
}
