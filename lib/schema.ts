import { z } from 'zod';
export const kinds = ['org_created','org_removed','org_renamed','org_changed','org_preserved','preserved','transferred','changed','new','lost','duplicate','conflict'] as const;
export const labels: Record<typeof kinds[number], string> = { org_created:'Новое подразделение',org_removed:'Подразделение исключено',org_renamed:'Переименование',org_changed:'Изменение структуры',org_preserved:'Структура сохранена',preserved:'Сохранено',transferred:'Передано',changed:'Изменено',new:'Новая функция',lost:'Возможная потеря',duplicate:'Возможное дублирование',conflict:'Пересечение ответственности' };
export const statusLabels = { confirmed:'Подтверждено текстом',possible:'Возможно · нужна проверка',uncertain:'Недостаточно данных' };
export const referenceSchema = z.object({ sourceId:z.string().min(1), quote:z.string().min(12).max(1400) });
export const findingSchema = z.object({ id:z.string().min(1),kind:z.enum(kinds),title:z.string().min(3).max(180),description:z.string().min(10).max(2000),status:z.enum(['confirmed','possible','uncertain']),confidence:z.number().min(0).max(1),beforeEvidence:z.array(referenceSchema).max(6),afterEvidence:z.array(referenceSchema).max(6) });
export const comparisonSchema = z.object({ findings:z.array(findingSchema).max(120) });
export const extractionSchema = z.object({ entities:z.array(z.object({type:z.enum(['department','function']),name:z.string().min(3).max(350),owner:z.string().max(200),sourceId:z.string(),quote:z.string().min(12).max(1400)})).max(100) });
export type Entity = z.infer<typeof extractionSchema>['entities'][number];
export type Finding = z.infer<typeof findingSchema>;
export type Side = 'before'|'after';
export interface Source { id:string;side:Side;document:string;version:string;section:string;clause:string;page:number|null;text:string }
export interface ParsedDocument { name:string;version:string;pages:number|null;sources:Source[];warnings:string[] }
export interface Report { mode:'demo'|'live';findings:Finding[];sources:Source[];documents:{before:{name:string;version:string;pages:number|null};after:{name:string;version:string;pages:number|null}};warnings:string[];conclusion:string;coverage:string;createdAt:string }
