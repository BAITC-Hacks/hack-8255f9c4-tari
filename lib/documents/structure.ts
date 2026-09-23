import type { ParsedDocument, Side, Source } from '../schema';
export const normalize = (text:string) => text.normalize('NFKC').replace(/\s+/g,' ').trim();
export function structure(pages:{page:number|null;text:string}[],name:string,side:Side):ParsedDocument {
 const first=normalize(pages[0]?.text||'');
 const version=first.match(/редакци[яи]\s*(?:№|No|N)?\s*(\d+)/i)?.[1];
 const sources:Source[]=[]; let section='Начало документа', clause='Без номера';
 for(const page of pages) {
  const text=normalize(page.text.replace(/\n\s*\d+\s*$/,''));
  // Points may occur inside a PDF line. Require a trailing dot and reject dates/references.
  const markers=[...text.matchAll(/(?:^|\s)(\d{1,2}(?:\.\d{1,3})*\.)(?=\s*[А-ЯЁA-Zа-яё])/g)].filter(m=>!/(?:п\.|пункт[ае]?|от)\s*$/i.test(text.slice(Math.max(0,m.index!-12),m.index)));
  const cuts=[0,...markers.map(m=>m.index!+(m[0].startsWith(' ')?1:0))].filter((n,i,a)=>a.indexOf(n)===i);
  for(let i=0;i<cuts.length;i++) {
   const body=text.slice(cuts[i],cuts[i+1]??text.length).trim(); if(!body)continue;
   const number=body.match(/^(\d{1,2}(?:\.\d{1,3})*\.)/);
   if(number) { clause=number[1].replace(/\.$/,''); if(!clause.includes('.')) section=body.slice(0,130); }
   for(let offset=0;offset<body.length;) {
    let end=Math.min(body.length,offset+6000);
    if(end<body.length) { const space=body.lastIndexOf(' ',end); if(space>offset) end=space; }
    sources.push({id:`${side}-${sources.length+1}`,side,document:name,version:version?`Редакция №${version}`:'Версия не указана',section,clause,page:page.page,text:body.slice(offset,end).trim()});offset=end;
   }
  }
 }
 return {name,version:version?`Редакция №${version}`:'Версия не указана',pages:pages[0]?.page===null?null:pages.length,sources,warnings:pages.some(p=>normalize(p.text).length<30)?['Есть страницы без извлекаемого текста. Изображения и сканы не анализируются.']:[]};
}
