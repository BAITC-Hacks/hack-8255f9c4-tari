import { comparisonSchema, extractionSchema, type ParsedDocument, type Report, type Source, type Entity } from '../schema';
import { verifyEntities,verifyFindings,conclusion } from '../evidence';
import { AppError } from '../errors';
import { createProvider, type AIProvider } from './provider';
const extractionPrompt=`Извлеки подразделения и отдельные функции/обязанности, права, подчинённость из каждого фрагмента. Не пропускай содержательные функции. Объединяй повторы, но сохраняй отдельные обязанности. Верни {"entities":[{"type":"department|function","name":"смысл функции или имя подразделения","owner":"явный исполнитель, иначе Не указан","sourceId":"точный id фрагмента","quote":"дословная непрерывная цитата 12–1400 символов"}]}. Для определения owner используй контекст заголовков, но не придумывай исполнителя. Цитаты копируй без исправлений. Не путай простое упоминание подразделения с включением в оргструктуру. До 100 сущностей.`;
const comparePrompt=`Сопоставь извлечённые сущности ДО и ПОСЛЕ ПО СМЫСЛУ, независимо от номера и формулировки. Это структурированные данные с проверенными цитатами. Найди изменения структуры, созданные/исключённые/переименованные подразделения, сохранённые, перенесённые, изменённые, новые, потенциально потерянные функции, дубли и конфликты. Сначала ищи перенос функции к другому исполнителю во всём ПОСЛЕ: перенос не потеря. Переименование не устанавливай лишь по сходству названий. Новое уточнение существующей функции — changed, а не new. Общие обязанности разных руководителей не доказывают дубль. Для риска объясни альтернативное объяснение и что проверить. При недостатке данных uncertain. Не придумывай риски для заполнения категорий. Верни {"findings":[{"id":"F1","kind":"org_created|org_removed|org_renamed|org_changed|org_preserved|preserved|transferred|changed|new|lost|duplicate|conflict","title":"заголовок","description":"объяснение из цитат и необходимая проверка","status":"confirmed|possible|uncertain","confidence":0.8,"beforeEvidence":[{"sourceId":"id","quote":"дословная цитата"}],"afterEvidence":[{"sourceId":"id","quote":"дословная цитата"}]}]}. До 120 существенных наблюдений. Для сравнительного вывода приводи обе стороны. В списки evidence копируй sourceId и quote из данных. Для duplicate/conflict нужны две цитаты ПОСЛЕ. Не возвращай иных полей. confirmed означает подтверждено текстом, не реальностью. Число confidence — эвристическая оценка, не статистическая вероятность.`;
function chunks(sources:Source[]) { const result:Source[][]=[];let current:Source[]=[];let size=0;for(const s of sources){if(size+s.text.length>12000&&current.length){result.push(current);current=[];size=0;}current.push(s);size+=s.text.length;}if(current.length)result.push(current);return result; }
export async function analyze(before:ParsedDocument,after:ParsedDocument,onProgress:(step:number,message:string)=>void,signal:AbortSignal,provider:AIProvider=createProvider()):Promise<Report> {
 const sources=[...before.sources,...after.sources],groups=[...chunks(before.sources),...chunks(after.sources)];const entities:Entity[]=[];
 for(let i=0;i<groups.length;i++){
  if(signal.aborted)throw new AppError('AI_TIMEOUT','Анализ отменён или превышен лимит времени.',504);
  onProgress(1,`Извлечение структуры: фрагмент ${i+1} из ${groups.length}`);
  const previous=sources.slice(Math.max(0,sources.indexOf(groups[i][0])-5),sources.indexOf(groups[i][0])).map(s=>({clause:s.clause,text:s.text.slice(0,160)}));
  const output=await provider.json(extractionPrompt,{contextOnly:previous,sources:groups[i]},extractionSchema,signal);
  entities.push(...verifyEntities(output.entities,groups[i]));
 }
 if(!entities.length)throw new AppError('NO_ENTITIES','AI не выделил функции и подразделения. Проверьте содержание документов.',422);
 const unique=entities.filter((e,i,a)=>a.findIndex(x=>x.type===e.type&&x.sourceId===e.sourceId&&x.name===e.name)===i);
 const data={before:unique.filter(e=>e.sourceId.startsWith('before-')),after:unique.filter(e=>e.sourceId.startsWith('after-'))};
 if(!data.before.length||!data.after.length)throw new AppError('NO_ENTITIES','AI не выделил сущности в одном из документов. Анализ не может быть полным.',422);
 if(JSON.stringify(data).length>150000)throw new AppError('CONTEXT','Извлечено слишком много функций для одного сопоставления. Разделите документы на тематические части.',422);
 onProgress(2,`Смысловое сопоставление ${unique.length} сущностей`);
 const comparison=await provider.json(comparePrompt,data,comparisonSchema,signal);
 onProgress(3,'Проверка цитат и достоверности выводов');
 const findings=verifyFindings(comparison.findings,sources);
 onProgress(4,'Формирование заключения');
 return {mode:'live',findings,sources,documents:{before:{name:before.name,version:before.version,pages:before.pages},after:{name:after.name,version:after.version,pages:after.pages}},warnings:[...before.warnings,...after.warnings,'Цитаты проверены по извлечённому тексту; смысл выводов требует экспертной проверки. Число уверенности — оценка модели, а не вероятность.'],conclusion:conclusion(findings),coverage:`Прочитаны все ${sources.length} фрагментов. Извлечено ${unique.length} сущностей. AI-извлечение и сопоставление не гарантируют полноту.`,createdAt:new Date().toISOString()};
}
