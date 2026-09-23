import { AppError } from './errors';
import { normalize } from './documents/structure';
import type { Entity, Finding, Source } from './schema';
export function verifyReference(ref:{sourceId:string;quote:string},sources:Source[],side?:string) {
 const source=sources.find(s=>s.id===ref.sourceId);
 if(!source || (side && source.side!==side) || !normalize(source.text).includes(normalize(ref.quote)))throw new AppError('EVIDENCE','AI вернул цитату, которая не найдена в указанном источнике. Результат отклонён; повторите анализ.',502);
 return source;
}
export function verifyEntities(entities:Entity[],sources:Source[]) { entities.forEach(e=>verifyReference(e,sources));return entities; }
export function verifyFindings(findings:Finding[],sources:Source[]) {
 if(new Set(findings.map(f=>f.id)).size!==findings.length)throw new AppError('AI_JSON','AI вернул повторяющиеся идентификаторы выводов. Повторите анализ.',502);
 return findings.map(f=>{
  if(!f.beforeEvidence.length&&!f.afterEvidence.length)throw new AppError('EVIDENCE','AI вернул вывод без доказательств. Повторите анализ.',502);
  f.beforeEvidence.forEach(e=>verifyReference(e,sources,'before'));f.afterEvidence.forEach(e=>verifyReference(e,sources,'after'));
  const result={...f};
  const requiresBoth=['preserved','transferred','changed','org_renamed','org_changed','org_preserved'];
  if(requiresBoth.includes(f.kind)&&(!f.beforeEvidence.length||!f.afterEvidence.length)){result.status='uncertain';result.confidence=Math.min(result.confidence,0.4);}
  if(['new','org_created'].includes(f.kind)&&!f.afterEvidence.length)throw new AppError('EVIDENCE','Для новой функции отсутствует источник ПОСЛЕ.',502);
  if(['lost','org_removed'].includes(f.kind)&&!f.beforeEvidence.length)throw new AppError('EVIDENCE','Для исчезнувшей функции отсутствует источник ДО.',502);
  // Text absence and shared wording do not prove actual loss, duplication or conflict.
  if(['lost','duplicate','conflict','org_removed'].includes(f.kind)&&result.status==='confirmed'){result.status='possible';result.confidence=Math.min(result.confidence,0.75);}
  if(['new','org_created'].includes(f.kind)&&!f.beforeEvidence.length){result.status='possible';result.confidence=Math.min(result.confidence,0.7);}
  if(['duplicate','conflict'].includes(f.kind)&&f.afterEvidence.length<2){result.status='uncertain';result.confidence=Math.min(result.confidence,0.4);}
  return result;
 });
}
export function conclusion(findings:Finding[]) {
 const confirmed=findings.filter(f=>f.status==='confirmed').length;
 const review=findings.length-confirmed;
 const highlights=findings.filter(f=>f.status==='confirmed'&&!['preserved','org_preserved'].includes(f.kind)).slice(0,5).map(f=>`${f.title} (${f.id})`).join('; ');
 const risks=findings.filter(f=>f.status!=='confirmed').slice(0,4).map(f=>`${f.title} (${f.id})`).join('; ');
 return `Выявлено ${findings.length} наблюдений: ${confirmed} подтверждены приведёнными фрагментами, ${review} требуют проверки. ${highlights?`Основные изменения: ${highlights}. `:''}${risks?`Проверить: ${risks}. `:''}Выводы описывают содержание двух документов; они не подтверждают фактическое выполнение функций. Отсутствие функции в новой редакции само по себе не доказывает её прекращение. Перед организационными решениями сопоставьте результат со штатным расписанием, должностными инструкциями и планом работ.`;
}
